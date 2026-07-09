// ============================================================
// Invite Room Types — game-agnostic
// Phòng chờ "Mời bạn" + Tái đấu, tái dùng cho mọi game PvP.
// ============================================================

import type { MatchmakingGameType } from './matchmaking';

/**
 * Trạng thái của một phòng mời:
 * - `waiting`: mới tạo, chỉ có host, đang chờ guest vào qua link.
 * - `ready_check`: đã đủ 2 người, chờ cả 2 bấm "Sẵn sàng" (dùng cho cả lần đầu và tái đấu).
 * - `in_game`: đang có một ván game chạy (currentSessionId).
 * - `closed`: phòng đã đóng (hết hạn, có người rời, hoặc hết lượt chơi).
 */
export type InviteRoomStatus = 'waiting' | 'ready_check' | 'in_game' | 'closed';

/** Một thành viên trong phòng — định danh theo userId để chịu được reconnect */
export interface InviteRoomMember {
  userId: string;
  displayName: string;
  avatar?: string;
  grade?: number;
  /** Là người tạo phòng */
  isHost: boolean;
  /** Đã bấm "Sẵn sàng" cho ván sắp tới chưa */
  ready: boolean;
  /**
   * Socket id hiện tại của thành viên trong phòng (server dùng để emit START đúng socket).
   * Cập nhật mỗi lần join/ready. Không dùng ở client.
   */
  socketId?: string;
}

/** Phòng mời — lưu trong Redis, sống xuyên nhiều ván (tái đấu) */
export interface InviteRoom {
  roomId: string;
  gameType: MatchmakingGameType;
  status: InviteRoomStatus;
  /** host luôn là members[0] */
  members: InviteRoomMember[];
  /** Số ván đã bắt đầu trong phòng này */
  gamesPlayed: number;
  /** Tổng số ván tối đa (tính cả ván đầu) — lấy từ config game */
  maxGames: number;
  /** Session game đang chạy (chỉ khi status = in_game) */
  currentSessionId?: string;
  /** Thời điểm tạo (ms) */
  createdAt: number;
  /** Thời điểm hết hạn (ms) — createdAt + expiryMinutes */
  expiresAt: number;
}

/**
 * Tùy chọn khi tạo PvP session (dùng cho invite room).
 * Truyền qua MatchmakingSessionFactory.createPVPSession.
 */
export interface PVPSessionOptions {
  /** Trận giao hữu — KHÔNG tính điểm/BXH/UniClass sync */
  friendly?: boolean;
  /** ID phòng mời nguồn — để game báo lại phòng khi trận kết thúc (tái đấu) */
  inviteRoomId?: string;
  /**
   * Context người chơi truyền trực tiếp (không qua pendingContext của matchmaking).
   * a = host (playerA), b = guest (playerB). Quiz Arena dùng grade của host cho cả 2.
   */
  players?: {
    a: { displayName?: string; grade?: number };
    b: { displayName?: string; grade?: number };
  };
}
