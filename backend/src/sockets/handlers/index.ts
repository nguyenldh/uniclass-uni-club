import type { Socket, Server } from 'socket.io';
import { registerMindGameHandlers } from '../../games/mind-game/sockets/index';
import { registerMatchmakingHandlers } from './matchmaking.handler';
import { registerInviteRoomHandlers } from './invite-room.handler';
import { registerQuizArenaHandlers } from '../../games/quiz-arena/sockets/index';
import { registerBossBattleHandlers } from '../../games/boss-battle/sockets/index';

/**
 * Đăng ký tất cả socket event handlers.
 * Mỗi nhóm game có file handler riêng, được mount tại đây.
 */
export function registerGameHandlers(io: Server, socket: Socket): void {
  // Matchmaking — game-agnostic, dùng chung cho mọi game PvP
  registerMatchmakingHandlers(io, socket);

  // Invite Room — phòng chờ "Mời bạn" + Tái đấu, game-agnostic
  registerInviteRoomHandlers(io, socket);

  // Nhóm Mind Game (Đấu trí) — Gomoku & Card Flip
  registerMindGameHandlers(io, socket);

  // Quiz Arena (So Tài)
  registerQuizArenaHandlers(io, socket);

  // Boss Battle (Săn Boss) — chỉ join/leave room broadcast BXH
  registerBossBattleHandlers(io, socket);

  // TODO: Nhóm game khác sẽ mount ở đây
  // registerActionGameHandlers(io, socket);
}
