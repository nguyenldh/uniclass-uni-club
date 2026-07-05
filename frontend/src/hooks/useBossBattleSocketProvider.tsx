// ============================================================
// BossBattleSocketProvider — Giữ socket connection xuyên suốt
// tất cả boss-battle routes, tránh mất event khi chuyển trang.
// ============================================================

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { BOSS_BATTLE_SOCKET_EVENTS } from '@uniclub/shared';
import type { BossLeaderboardEntry } from '@uniclub/shared';
import { useBossBattleStore } from '../stores/boss-battle';

// ---- Types ----
export interface BossHpUpdateData {
  weekKey: string;
  gradeLevel: number;
  totalPointsEarned: number;
  progressPercent: number;
  currentBossStateImg: string;
  status: string;
  hitBy?: string;
  hitByName?: string;
  hitPoints?: number;
}

export interface HitNotification {
  id: string;
  name: string;
  points: number;
  x: string;
  y: string;
}

interface BossBattleSocketContextValue {
  hits: HitNotification[];
  shaking: boolean;
}

const BossBattleSocketContext = createContext<BossBattleSocketContextValue>({
  hits: [],
  shaking: false,
});

export function useBossBattleSocketContext() {
  return useContext(BossBattleSocketContext);
}

// ---- Provider ----
interface BossBattleSocketProviderProps {
  children: ReactNode;
}

export function BossBattleSocketProvider({ children }: BossBattleSocketProviderProps) {
  const socketRef = useRef<Socket | null>(null);
  const [hits, setHits] = useState<HitNotification[]>([]);
  const [shaking, setShaking] = useState(false);
  const hitIdRef = useRef(0);

  // Lấy weekKey và gradeLevel từ store
  const weekKey = useBossBattleStore((s) => s.lobby?.boss?.weekKey ?? '');
  const gradeLevel = useBossBattleStore((s) => s.lobby?.boss?.gradeLevel ?? 4);

  // Callback refs để tránh stale closures
  const onLeaderboardUpdateRef = useRef<(data: any) => void>();
  const onHpUpdateRef = useRef<(data: BossHpUpdateData) => void>();
  const onBossDefeatedRef = useRef<(data: any) => void>();

  // Setup callbacks
  onLeaderboardUpdateRef.current = (data: {
    weekKey: string;
    gradeLevel: number;
    questionsPerWeek: number;
    entries: BossLeaderboardEntry[];
  }) => {
    console.log('[BossBattle] 🏆 leaderboard-update received:', data);
    // Cập nhật leaderboard trong store
    useBossBattleStore.setState({
      leaderboard: {
        weekKey: data.weekKey,
        gradeLevel: data.gradeLevel,
        questionsPerWeek: data.questionsPerWeek,
        entries: data.entries,
        myEntry: null,
      },
    });
  };

  onHpUpdateRef.current = (data: BossHpUpdateData) => {
    console.log('[BossBattle] ⚔️ hp-update received:', data);
    // Hiển thị hit notification
    if (data.hitByName && data.hitPoints != null) {
      const id = `hit-${++hitIdRef.current}`;
      const pos = randomHitPosition();
      const newHit: HitNotification = {
        id,
        name: data.hitByName,
        points: data.hitPoints,
        x: pos.x,
        y: pos.y,
      };
      setHits((prev) => [...prev.slice(-4), newHit]);
      setTimeout(() => {
        setHits((prev) => prev.filter((h) => h.id !== id));
      }, 2400);
    }
    // Rung lắc boss
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
    // Cập nhật HP trong store. Cộng lại phần sát thương optimistic của lượt đang chơi
    // (server chưa xác nhận) để BOSS_HP_UPDATE từ người khác không làm "boss hồi máu".
    // KHÔNG round để các đòn nhỏ (<1%) vẫn làm thanh máu nhích.
    const { optimisticDamagePercent } = useBossBattleStore.getState();
    const displayedProgress = Math.min(100, data.progressPercent + optimisticDamagePercent);
    const newHp = Math.max(0, Math.min(100, 100 - displayedProgress));
    useBossBattleStore.setState({
      bossHpPercent: newHp,
      bossProgressPercent: displayedProgress,
      currentBossStateImg: data.currentBossStateImg || null,
    });
    // Cập nhật boss state nếu bị hạ
    if (data.status === 'DEFEATED') {
      useBossBattleStore.getState().updateBossDefeated();
    }
  };

  onBossDefeatedRef.current = (data: { weekKey: string; gradeLevel: number; defeatedAt: string }) => {
    console.log('[BossBattle] 💀 defeated received:', data);
    useBossBattleStore.getState().updateBossDefeated();
  };

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

    socket.on(BOSS_BATTLE_SOCKET_EVENTS.LEADERBOARD_UPDATE, (data: any) => {
      onLeaderboardUpdateRef.current?.(data);
    });

    socket.on(BOSS_BATTLE_SOCKET_EVENTS.BOSS_HP_UPDATE, (data: BossHpUpdateData) => {
      onHpUpdateRef.current?.(data);
    });

    socket.on(BOSS_BATTLE_SOCKET_EVENTS.BOSS_DEFEATED, (data: any) => {
      onBossDefeatedRef.current?.(data);
    });

    return () => {
      socket.emit(BOSS_BATTLE_SOCKET_EVENTS.LEAVE_ROOM, { weekKey, gradeLevel });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [weekKey, gradeLevel]);

  return (
    <BossBattleSocketContext.Provider value={{ hits, shaking }}>
      {children}
    </BossBattleSocketContext.Provider>
  );
}

// ---- Helpers ----
function randomHitPosition(): { x: string; y: string } {
  const angle = Math.random() * Math.PI * 2;
  const radius = 30 + Math.random() * 25; // 30–55% từ tâm → rìa ngoài
  const cx = 50 + Math.cos(angle) * radius;
  const cy = 45 + Math.sin(angle) * radius;
  return { x: `${Math.max(0, Math.min(100, cx))}%`, y: `${Math.max(0, Math.min(100, cy))}%` };
}