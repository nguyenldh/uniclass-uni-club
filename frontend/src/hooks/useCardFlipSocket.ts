// ============================================================
// useCardFlipSocket — Socket.IO hook cho Card Flip PvP
// ============================================================

import { useEffect, useRef, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { MIND_GAME_SOCKET_EVENTS } from '@uniclub/shared';
import type { CardFlipCard, AIDifficulty } from '@uniclub/shared';

export interface CardFlipStateData {
  cards: CardFlipCard[];
  currentTurn: string;
  scores: { playerA: number; playerB: number };
  lastFlipped: number[];
  isMatch?: boolean;
}

export interface UseCardFlipSocketOptions {
  sessionId: string;
  userId: string;
  /** Called on every CARD_FLIP_STATE broadcast — sync full state from server */
  onStateUpdate: (data: CardFlipStateData) => void;
  /** Called when game ends */
  onGameEnd: (winner: string | null, isDraw: boolean) => void;
  /** Called when server creates a new session (response to CARD_FLIP_START) */
  onSessionCreated?: (session: { sessionId: string; playerA: string; playerB: string; isAI: boolean }) => void;
}

export interface CardFlipSocketActions {
  /** Emit để bắt đầu game vs AI */
  startVsAI: (userId: string, difficulty: AIDifficulty) => void;
  /** Emit để lật 1 thẻ */
  flipCard: (sessionId: string, userId: string, cardId: number) => void;
  /** Emit để reset thẻ sau khi không match */
  resetFlipped: (sessionId: string) => void;
}

export function useCardFlipSocket({
  sessionId,
  userId,
  onStateUpdate,
  onGameEnd,
  onSessionCreated,
}: UseCardFlipSocketOptions): CardFlipSocketActions {
  const socketRef = useRef<Socket | null>(null);
  const onStateUpdateRef = useRef(onStateUpdate);
  const onGameEndRef = useRef(onGameEnd);
  const onSessionCreatedRef = useRef(onSessionCreated);

  onStateUpdateRef.current = onStateUpdate;
  onGameEndRef.current = onGameEnd;
  onSessionCreatedRef.current = onSessionCreated;

  useEffect(() => {
    const socket = io(import.meta.env.VITE_SOCKET_URL || '/', {
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[CardFlipSocket] Connected, joining room:', sessionId);
      socket.emit('join', { sessionId, gameType: 'card_flip', userId });
    });

    socket.on(
      MIND_GAME_SOCKET_EVENTS.CARD_FLIP_STATE,
      (data: CardFlipStateData) => {
        onStateUpdateRef.current(data);
      },
    );

    socket.on(
      MIND_GAME_SOCKET_EVENTS.CARD_FLIP_END,
      (data: { winner: string | null; isDraw: boolean }) => {
        onGameEndRef.current(data.winner, data.isDraw);
      },
    );

    socket.on(
      MIND_GAME_SOCKET_EVENTS.CARD_FLIP_START,
      (data: { sessionId: string; playerA: string; playerB: string; isAI: boolean }) => {
        onSessionCreatedRef.current?.(data);
      },
    );

    return () => {
      console.log('[CardFlipSocket] Disconnecting');
      socket.disconnect();
    };
  }, [sessionId]);

  const startVsAI = useCallback((userId: string, difficulty: AIDifficulty) => {
    socketRef.current?.emit(MIND_GAME_SOCKET_EVENTS.CARD_FLIP_START, { userId, difficulty });
  }, []);

  const flipCard = useCallback((sid: string, userId: string, cardId: number) => {
    socketRef.current?.emit(MIND_GAME_SOCKET_EVENTS.CARD_FLIP_FLIP, { sessionId: sid, userId, cardId });
  }, []);

  const resetFlipped = useCallback((sid: string) => {
    socketRef.current?.emit(MIND_GAME_SOCKET_EVENTS.CARD_FLIP_TURN, { sessionId: sid });
  }, []);

  return { startVsAI, flipCard, resetFlipped };
}
