// ============================================================
// useGomokuSocket — Socket.IO hook cho Gomoku PvP & vs AI
// ============================================================

import { useEffect, useRef, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { MIND_GAME_SOCKET_EVENTS } from '@uniclub/shared';
import type { CellValue, GomokuMove } from '@uniclub/shared';

export interface UseGomokuSocketOptions {
  sessionId: string;
  userId: string;
  playerSymbol: 'X' | 'O';
  /** Called when opponent makes a move */
  onOpponentMove: (row: number, col: number, symbol: 'X' | 'O') => void;
  /** Called when game ends */
  onGameEnd: (winner: string | null, isDraw: boolean) => void;
  /** Called when opponent disconnects */
  onOpponentDisconnected: () => void;
}

export interface GomokuSocketActions {
  /** Emit a move to the server (works both for player and local-AI relay) */
  makeMove: (sessionId: string, userId: string, row: number, col: number) => void;
}

export function useGomokuSocket({
  sessionId,
  userId,
  playerSymbol,
  onOpponentMove,
  onGameEnd,
  onOpponentDisconnected,
}: UseGomokuSocketOptions): GomokuSocketActions {
  const socketRef = useRef<Socket | null>(null);
  // Use refs for callbacks to avoid stale closures
  const onOpponentMoveRef = useRef(onOpponentMove);
  const onGameEndRef = useRef(onGameEnd);
  const onOpponentDisconnectedRef = useRef(onOpponentDisconnected);
  const playerSymbolRef = useRef(playerSymbol);

  onOpponentMoveRef.current = onOpponentMove;
  onGameEndRef.current = onGameEnd;
  onOpponentDisconnectedRef.current = onOpponentDisconnected;
  playerSymbolRef.current = playerSymbol;

  useEffect(() => {
    const socket = io(import.meta.env.VITE_SOCKET_URL || '/', {
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[GomokuSocket] Connected, joining room:', sessionId);
      socket.emit('join', { sessionId, gameType: 'gomoku', userId });
    });

    socket.on(
      MIND_GAME_SOCKET_EVENTS.GOMOKU_STATE,
      (data: {
        board: CellValue[][];
        currentTurn: 'X' | 'O';
        lastMove?: GomokuMove;
      }) => {
        const { lastMove } = data;
        // Apply opponent's last move (skip own moves)
        if (lastMove && lastMove.symbol !== playerSymbolRef.current) {
          onOpponentMoveRef.current(lastMove.row, lastMove.col, lastMove.symbol);
        }
      },
    );

    socket.on(
      MIND_GAME_SOCKET_EVENTS.GOMOKU_END,
      (data: { winner: string | null; isDraw: boolean }) => {
        onGameEndRef.current(data.winner, data.isDraw);
      },
    );

    socket.on(MIND_GAME_SOCKET_EVENTS.GOMOKU_OPPONENT_DISCONNECTED, () => {
      onOpponentDisconnectedRef.current();
    });

    return () => {
      console.log('[GomokuSocket] Disconnecting');
      socket.disconnect();
    };
  }, [sessionId]); // Only reconnect if sessionId changes

  const makeMove = useCallback(
    (sid: string, uid: string, row: number, col: number) => {
      socketRef.current?.emit(MIND_GAME_SOCKET_EVENTS.GOMOKU_MOVE, {
        sessionId: sid,
        userId: uid,
        row,
        col,
      });
    },
    [],
  );

  return { makeMove };
}
