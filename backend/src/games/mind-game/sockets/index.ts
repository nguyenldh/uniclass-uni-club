// ============================================================
// Mind Game — Socket.IO Handlers
// ============================================================

import type { Socket, Server } from 'socket.io';
import { GomokuService, setGomokuServerIO } from '../services/gomoku.service';
import { CardFlipService, setCardFlipServerIO } from '../services/card-flip.service';
import { MIND_GAME_SOCKET_EVENTS, SOCKET_EVENTS } from '@uniclub/shared';

/**
 * Đăng ký tất cả socket event handlers cho nhóm Mind Game.
 * Matchmaking đã được tách ra handler riêng (game-agnostic).
 */
export function registerMindGameHandlers(io: Server, socket: Socket): void {
  // Set server IO cho các service để emit event sau timeout
  setGomokuServerIO(io);
  setCardFlipServerIO(io);

  // ============================================================
  // Join session room — client gọi khi vào game để nhận broadcast
  // ============================================================

  socket.on('join', async (data: { sessionId: string; gameType?: string; userId?: string }) => {
    if (data.sessionId) {
      socket.join(data.sessionId);
      socket.data.mindGameSessionId = data.sessionId;
      socket.data.userId = data.userId;
      if (data.gameType) {
        socket.data.mindGameType = data.gameType;
      }
      console.log(`[Socket] ${socket.id} joined room ${data.sessionId}`);

      // Reconnect: clear disconnect timer nếu session đang playing
      if (data.gameType === 'gomoku') {
        const session = await GomokuService.getSession(data.sessionId);
        if (session?.status === 'playing') {
          GomokuService.handleReconnect(data.sessionId);
        }
      } else if (data.gameType === 'card_flip') {
        const session = await CardFlipService.getSession(data.sessionId);
        if (session?.status === 'playing') {
          CardFlipService.handleReconnect(data.sessionId);
        }
      }
    }
  });

  // ============================================================
  // Gomoku Gameplay
  // ============================================================

  socket.on(MIND_GAME_SOCKET_EVENTS.GOMOKU_MOVE, async (data: { sessionId: string; userId: string; row: number; col: number }) => {
    try {
      const { sessionId, userId, row, col } = data;
      const result = await GomokuService.makeMove(sessionId, userId, row, col);

      io.to(sessionId).emit(MIND_GAME_SOCKET_EVENTS.GOMOKU_STATE, {
        board: result.session.board,
        currentTurn: result.session.currentTurn,
        lastMove: result.session.lastMove,
      });

      if (result.gameOver) {
        io.to(sessionId).emit(MIND_GAME_SOCKET_EVENTS.GOMOKU_END, {
          winner: result.winner ?? null,
          isDraw: !result.winner,
          session: result.session,
        });
      }
    } catch (error: any) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: error.message });
    }
  });

  // ============================================================
  // Card Flip Gameplay (Lật thẻ PvP)
  // ============================================================

  socket.on(MIND_GAME_SOCKET_EVENTS.CARD_FLIP_FLIP, async (data: { sessionId: string; userId: string; cardId: number }) => {
    try {
      const { sessionId, userId, cardId } = data;
      const result = await CardFlipService.flipCard(sessionId, userId, cardId);

      io.to(sessionId).emit(MIND_GAME_SOCKET_EVENTS.CARD_FLIP_STATE, {
        cards: result.session.cards,
        currentTurn: result.session.currentTurn,
        scores: result.session.scores,
        lastFlipped: result.session.lastFlipped,
        isMatch: result.isMatch,
      });

      if (result.gameOver) {
        io.to(sessionId).emit(MIND_GAME_SOCKET_EVENTS.CARD_FLIP_END, {
          winner: result.winner ?? null,
          isDraw: !result.winner,
          session: result.session,
        });
      }
    } catch (error: any) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: error.message });
    }
  });

  socket.on(MIND_GAME_SOCKET_EVENTS.CARD_FLIP_TURN, async (data: { sessionId: string }) => {
    try {
      const { sessionId } = data;
      const session = await CardFlipService.resetFlipped(sessionId);
      if (session) {
        io.to(sessionId).emit(MIND_GAME_SOCKET_EVENTS.CARD_FLIP_STATE, {
          cards: session.cards,
          currentTurn: session.currentTurn,
          scores: session.scores,
          lastFlipped: session.lastFlipped,
          isMatch: false,
        });
      }
    } catch (error: any) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: error.message });
    }
  });

  // ============================================================
  // Disconnect — xử lý mất kết nối giữa trận
  // ============================================================

  socket.on('disconnect', async () => {
    try {
      const userId: string | undefined = socket.data.userId;
      const sessionId: string | undefined = socket.data.mindGameSessionId;
      const gameType: string | undefined = socket.data.mindGameType;
      if (!userId || !sessionId) return;

      if (gameType === 'gomoku') {
        const result = await GomokuService.handleDisconnect(sessionId, userId);
        if (result) {
          io.to(sessionId).emit(MIND_GAME_SOCKET_EVENTS.GOMOKU_END, {
            winner: result.winner,
            isDraw: false,
            reason: 'opponent_disconnected',
          });
        }
      } else if (gameType === 'card_flip') {
        const result = await CardFlipService.handleDisconnect(sessionId, userId);
        if (result) {
          io.to(sessionId).emit(MIND_GAME_SOCKET_EVENTS.CARD_FLIP_END, {
            winner: result.winner,
            isDraw: false,
            reason: 'opponent_disconnected',
          });
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  });
}
