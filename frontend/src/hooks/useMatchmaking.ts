// ============================================================
// useMatchmaking — reusable hook for any PvP game
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  MATCHMAKING_SOCKET_EVENTS,
  DEFAULT_MATCHMAKING_CONFIG,
} from '@uniclub/shared';
import type { MatchmakingGameType, MatchmakingResult } from '@uniclub/shared';

export type MatchmakingPhase = 'idle' | 'searching' | 'matched' | 'timeout';

export interface MatchmakingState {
  phase: MatchmakingPhase;
  secondsRemaining: number;
  result: MatchmakingResult | null;
  error: string | null;
}

export interface UseMatchmakingOptions {
  userId: string;
  gameType: MatchmakingGameType;
  /** Override default timeout (seconds). Falls back to server-provided value. */
  timeout?: number;
  /** Quiz Arena: khối lớp của học sinh (lấy từ JWT) */
  grade?: number;
  /** Quiz Arena: tên hiển thị */
  displayName?: string;
}

export interface UseMatchmakingReturn extends MatchmakingState {
  startMatchmaking: () => void;
  cancelMatchmaking: () => void;
  /** Tổng thời gian chờ (giây) từ config của game, dùng để vẽ progress ring */
  totalSeconds: number;
}

export function useMatchmaking({
  userId,
  gameType,
  timeout: customTimeout,
  grade,
  displayName,
}: UseMatchmakingOptions): UseMatchmakingReturn {
  const [phase, setPhase] = useState<MatchmakingPhase>('idle');
  const [secondsRemaining, setSecondsRemaining] = useState(
    customTimeout ?? DEFAULT_MATCHMAKING_CONFIG.timeout,
  );
  const [totalSeconds, setTotalSeconds] = useState(
    customTimeout ?? DEFAULT_MATCHMAKING_CONFIG.timeout,
  );
  const [result, setResult] = useState<MatchmakingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<MatchmakingPhase>(phase);
  // Keep ref in sync with state
  phaseRef.current = phase;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (socketRef.current) {
        socketRef.current.emit(MATCHMAKING_SOCKET_EVENTS.LEAVE_MATCHMAKING, {
          userId,
          gameType,
        });
        socketRef.current.disconnect();
      }
    };
  }, []);

  const startMatchmaking = useCallback(() => {
    setError(null);
    setResult(null);
    setSecondsRemaining(customTimeout ?? DEFAULT_MATCHMAKING_CONFIG.timeout);
    setTotalSeconds(customTimeout ?? DEFAULT_MATCHMAKING_CONFIG.timeout);
    setPhase('searching');

    const socket = io(import.meta.env.VITE_SOCKET_URL || '/', {
      transports: ['websocket'],
      reconnection: false,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit(MATCHMAKING_SOCKET_EVENTS.JOIN_MATCHMAKING, {
        userId,
        gameType,
        grade,
        displayName,
      });
    });

    socket.on(
      MATCHMAKING_SOCKET_EVENTS.MATCHMAKING_MATCHED,
      (data: MatchmakingResult & { role?: 'first' | 'second'; timeout?: number }) => {
        if (data.status === 'searching') {
          // Server confirmed — use server timeout if provided
          if (data.timeout) {
            setSecondsRemaining(data.timeout);
            setTotalSeconds(data.timeout);
          }
          return;
        }

        // Matched!
        if (timerRef.current) clearInterval(timerRef.current);
        setResult(data);
        setPhase('matched');
      },
    );

    socket.on(
      MATCHMAKING_SOCKET_EVENTS.MATCHMAKING_TIMEOUT,
      (data: {
        sessionId: string;
        gameType: string;
        isAI: boolean;
        aiDifficulty: string;
        opponentProfile?: { name: string; avatar?: string };
      }) => {
        // Bỏ qua timeout nếu đã được ghép trận (race condition với server)
        if (phaseRef.current === 'matched') return;

        if (timerRef.current) clearInterval(timerRef.current);
        setResult({
          status: 'timeout',
          gameType: data.gameType as MatchmakingGameType,
          sessionId: data.sessionId,
          isAI: data.isAI,
          aiDifficulty: data.aiDifficulty as MatchmakingResult['aiDifficulty'],
          symbol: 'X', // Khi đấu AI, người chơi luôn đi trước (X)
          opponentProfile: data.opponentProfile,
        } as MatchmakingResult);
        setPhase('timeout');
      },
    );

    socket.on('connect_error', () => {
      setError('Không thể kết nối đến máy chủ. Vui lòng thử lại.');
      setPhase('idle');
    });

    // Countdown timer
    timerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [userId, gameType, customTimeout]);

  const cancelMatchmaking = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (socketRef.current) {
      socketRef.current.emit(MATCHMAKING_SOCKET_EVENTS.LEAVE_MATCHMAKING, {
        userId,
        gameType,
      });
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setPhase('idle');
    setSecondsRemaining(customTimeout ?? DEFAULT_MATCHMAKING_CONFIG.timeout);
    setTotalSeconds(customTimeout ?? DEFAULT_MATCHMAKING_CONFIG.timeout);
  }, [userId, gameType, customTimeout]);

  return {
    phase,
    secondsRemaining,
    totalSeconds,
    result,
    error,
    startMatchmaking,
    cancelMatchmaking,
  };
}
