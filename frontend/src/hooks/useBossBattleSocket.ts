// ============================================================
// useBossBattleSocket — Socket.IO hook cho Săn Boss
// Chỉ dùng cho BXH real-time + trạng thái defeated.
// Gameplay (battle/answer) đi qua REST.
// ============================================================

import { useEffect, useRef, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { BOSS_BATTLE_SOCKET_EVENTS } from '@uniclub/shared';
import type { BossLeaderboardEntry } from '@uniclub/shared';

export interface BossHpUpdateData {
  weekKey: string;
  gradeLevel: number;
  totalPointsEarned: number;
  progressPercent: number;
  currentBossStateImg: string;
  status: string;
  /** Hit notification data */
  hitBy?: string;
  hitByName?: string;
  hitPoints?: number;
}

export interface UseBossBattleSocketOptions {
  weekKey: string;
  gradeLevel: number;
  /** Called when leaderboard updates (real-time) */
  onLeaderboardUpdate?: (data: {
    weekKey: string;
    gradeLevel: number;
    questionsPerWeek: number;
    entries: BossLeaderboardEntry[];
  }) => void;
  /** Called when Boss HP changes (someone hit the boss) */
  onHpUpdate?: (data: BossHpUpdateData) => void;
  /** Called when Boss is defeated */
  onBossDefeated?: (data: { weekKey: string; gradeLevel: number; defeatedAt: string }) => void;
}

export function useBossBattleSocket({
  weekKey,
  gradeLevel,
  onLeaderboardUpdate,
  onHpUpdate,
  onBossDefeated,
}: UseBossBattleSocketOptions) {
  const socketRef = useRef<Socket | null>(null);

  // Callback refs to avoid stale closures
  const onLeaderboardUpdateRef = useRef(onLeaderboardUpdate);
  const onHpUpdateRef = useRef(onHpUpdate);
  const onBossDefeatedRef = useRef(onBossDefeated);
  onLeaderboardUpdateRef.current = onLeaderboardUpdate;
  onHpUpdateRef.current = onHpUpdate;
  onBossDefeatedRef.current = onBossDefeated;

  useEffect(() => {
    if (!weekKey || gradeLevel == null) return;

    const socket = io(import.meta.env.VITE_SOCKET_URL || '/', {
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[BossBattle] Socket connected, joining room:', { weekKey, gradeLevel });
      socket.emit(BOSS_BATTLE_SOCKET_EVENTS.JOIN_ROOM, { weekKey, gradeLevel });
    });

    socket.on(
      BOSS_BATTLE_SOCKET_EVENTS.LEADERBOARD_UPDATE,
      (data: {
        weekKey: string;
        gradeLevel: number;
        questionsPerWeek: number;
        entries: BossLeaderboardEntry[];
      }) => {
        console.log('[BossBattle] 🏆 leaderboard-update received:', data);
        onLeaderboardUpdateRef.current?.(data);
      },
    );

    socket.on(
      BOSS_BATTLE_SOCKET_EVENTS.BOSS_HP_UPDATE,
      (data: BossHpUpdateData) => {
        console.log('[BossBattle] ⚔️ hp-update received:', data);
        onHpUpdateRef.current?.(data);
      },
    );

    socket.on(
      BOSS_BATTLE_SOCKET_EVENTS.BOSS_DEFEATED,
      (data: { weekKey: string; gradeLevel: number; defeatedAt: string }) => {
        console.log('[BossBattle] 💀 defeated received:', data);
        onBossDefeatedRef.current?.(data);
      },
    );

    return () => {
      socket.emit(BOSS_BATTLE_SOCKET_EVENTS.LEAVE_ROOM, { weekKey, gradeLevel });
      socket.disconnect();
    };
  }, [weekKey, gradeLevel]);

  /** Manual leave (nếu cần rời room sớm) */
  const leaveRoom = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit(BOSS_BATTLE_SOCKET_EVENTS.LEAVE_ROOM, { weekKey, gradeLevel });
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, [weekKey, gradeLevel]);

  return { leaveRoom };
}
