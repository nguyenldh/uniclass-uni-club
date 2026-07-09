// ============================================================
// Invite Room Service — game-agnostic
// Phòng chờ "Mời bạn" + Tái đấu, tái dùng cho mọi game PvP.
// State lưu Redis, mutation chạy dưới distributed lock theo roomId.
// ============================================================

import crypto from 'node:crypto';
import { redis } from '../config/index';
import { withRedisLock } from '../utils/redis-lock';
import {
  INVITE_ROOM_REDIS_KEYS,
  INVITE_ROOM_CONFIG,
} from '@uniclub/shared';
import type {
  InviteRoom,
  InviteRoomMember,
  MatchmakingGameType,
} from '@uniclub/shared';

const EXPIRY_MS = INVITE_ROOM_CONFIG.expiryMinutes * 60 * 1000;

export interface InviteRoomMemberInput {
  userId: string;
  displayName: string;
  avatar?: string;
  grade?: number;
  /** Socket id hiện tại (để emit START đúng socket phòng) */
  socketId?: string;
  /** Vân tay TRÌNH DUYỆT (browser fingerprint) */
  fingerprint?: string;
  /** Device class — đặc trưng phần cứng độc lập trình duyệt */
  deviceClass?: string;
  /** IP nguồn (server đọc từ socket handshake) */
  ip?: string;
}

/** Lỗi nghiệp vụ của phòng — mang theo `code` để client hiển thị đúng */
export class InviteRoomError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

type DeviceSignals = { fingerprint?: string; deviceClass?: string; ip?: string };

/**
 * Xác định 2 định danh có phải "cùng một máy" không (chống tự chơi với mình).
 * Kết hợp 2 tín hiệu để bắt cả 2 kiểu gian lận mà vẫn hạn chế false-positive:
 *
 * 1) Cùng TRÌNH DUYỆT (nhân bản tab/ẩn danh/đăng nhập 2 acc): fingerprint trùng.
 *    - Trừ khi biết rõ cả 2 IP mà KHÁC nhau (vd 2 điện thoại cùng model khác mạng
 *      cho ra fingerprint giống) → tha.
 * 2) Cùng MÁY nhưng KHÁC trình duyệt (vd Chrome vs Edge): fingerprint khác nhau
 *    nhưng deviceClass (phần cứng) trùng VÀ cùng IP.
 *    - Yêu cầu cùng IP để không đụng 2 người dùng máy KHÁC nhau chung mạng
 *      (device class của họ khác nhau nên đằng nào cũng không dính).
 *
 * Thiếu tín hiệu → fail-open (không kết luận) để tránh chặn nhầm.
 */
function isSameDevice(a: DeviceSignals, b: DeviceSignals): boolean {
  // (1) Cùng trình duyệt
  if (a.fingerprint && b.fingerprint && a.fingerprint === b.fingerprint) {
    if (a.ip && b.ip && a.ip !== b.ip) return false; // khác mạng → coi như khác máy
    return true;
  }
  // (2) Cùng máy khác trình duyệt: phần cứng trùng + cùng IP
  if (
    a.deviceClass &&
    b.deviceClass &&
    a.deviceClass === b.deviceClass &&
    a.ip &&
    b.ip &&
    a.ip === b.ip
  ) {
    return true;
  }
  return false;
}

export class InviteRoomService {
  // ---- Redis helpers ----

  private static roomKey(roomId: string): string {
    return `${INVITE_ROOM_REDIS_KEYS.ROOM}:${roomId}`;
  }

  /** Index phòng đang host của một user (để rejoin thay vì tạo mới) */
  private static hostKey(userId: string): string {
    return `${INVITE_ROOM_REDIS_KEYS.HOST}:${String(userId)}`;
  }

  private static lockKey(roomId: string): string {
    return `lock:${this.roomKey(roomId)}`;
  }

  static async getRoom(roomId: string): Promise<InviteRoom | null> {
    const raw = await redis.get(this.roomKey(roomId));
    return raw ? (JSON.parse(raw) as InviteRoom) : null;
  }

  /**
   * Lưu phòng, gia hạn TTL theo expiresAt (tối thiểu 60s).
   * Đồng thời giữ index host→roomId đồng bộ TTL để host quay lại đúng phòng.
   */
  private static async save(room: InviteRoom): Promise<void> {
    const ttlSec = Math.max(60, Math.ceil((room.expiresAt - Date.now()) / 1000));
    await redis.set(this.roomKey(room.roomId), JSON.stringify(room), 'EX', ttlSec);
    const host = room.members.find((m) => m.isHost);
    if (host) {
      await redis.set(this.hostKey(host.userId), room.roomId, 'EX', ttlSec);
    }
  }

  static async deleteRoom(roomId: string): Promise<void> {
    // Dọn index host nếu đang trỏ đúng phòng này
    const room = await this.getRoom(roomId);
    const host = room?.members.find((m) => m.isHost);
    if (host) {
      const cur = await redis.get(this.hostKey(host.userId));
      if (cur === roomId) await redis.del(this.hostKey(host.userId));
    }
    await redis.del(this.roomKey(roomId));
  }

  // ---- Mutations (dưới lock) ----

  /**
   * Tạo phòng mới; host tự động là thành viên đầu tiên.
   * Nếu host đã có một phòng đang mở (chưa đóng/chưa hết hạn) → trả lại phòng đó
   * (rejoin) thay vì tạo phòng mới. Chạy dưới lock theo host để chống double-click.
   */
  static async createRoom(
    host: InviteRoomMemberInput,
    gameType: MatchmakingGameType,
    maxGames: number,
    blockSameDevice = false,
  ): Promise<InviteRoom> {
    const hostId = String(host.userId);
    return withRedisLock(`lock:${this.hostKey(hostId)}`, async () => {
      // Đã có phòng mở → quay lại phòng cũ
      const existingId = await redis.get(this.hostKey(hostId));
      if (existingId) {
        const existing = await this.getRoom(existingId);
        if (existing && existing.status !== 'closed') {
          const hostMember = existing.members.find((m) => m.isHost);
          if (hostMember) {
            hostMember.socketId = host.socketId ?? hostMember.socketId;
            hostMember.fingerprint = host.fingerprint ?? hostMember.fingerprint;
            hostMember.deviceClass = host.deviceClass ?? hostMember.deviceClass;
            hostMember.ip = host.ip ?? hostMember.ip;
          }
          // Áp lại policy theo config hiện tại
          existing.blockSameDevice = blockSameDevice;
          existing.expiresAt = Date.now() + EXPIRY_MS;
          await this.save(existing);
          return existing;
        }
        // Phòng cũ đã đóng/không còn → dọn index và tạo mới
        await redis.del(this.hostKey(hostId));
      }

      const now = Date.now();
      const room: InviteRoom = {
        roomId: crypto.randomUUID(),
        gameType,
        status: 'waiting',
        members: [
          {
            userId: hostId,
            displayName: host.displayName,
            avatar: host.avatar,
            grade: host.grade,
            isHost: true,
            ready: false,
            socketId: host.socketId,
            fingerprint: host.fingerprint,
            deviceClass: host.deviceClass,
            ip: host.ip,
          },
        ],
        gamesPlayed: 0,
        maxGames: Math.max(1, maxGames),
        blockSameDevice,
        createdAt: now,
        expiresAt: now + EXPIRY_MS,
      };
      await this.save(room);
      return room;
    });
  }

  /**
   * Vào phòng. Nếu userId đã là thành viên → coi như reconnect (cập nhật profile).
   * Ngược lại thêm guest nếu còn chỗ.
   */
  static async joinRoom(roomId: string, member: InviteRoomMemberInput): Promise<InviteRoom> {
    return withRedisLock(this.lockKey(roomId), async () => {
      const room = await this.getRoom(roomId);
      if (!room) throw new InviteRoomError('ROOM_NOT_FOUND', 'Phòng không tồn tại hoặc đã hết hạn');
      if (room.status === 'closed') throw new InviteRoomError('ROOM_EXPIRED', 'Phòng đã đóng');

      const userId = String(member.userId);
      const existing = room.members.find((m) => m.userId === userId);
      if (existing) {
        // Reconnect — cập nhật profile + socketId, giữ nguyên ready/isHost
        existing.displayName = member.displayName ?? existing.displayName;
        existing.avatar = member.avatar ?? existing.avatar;
        existing.grade = member.grade ?? existing.grade;
        existing.socketId = member.socketId ?? existing.socketId;
        existing.fingerprint = member.fingerprint ?? existing.fingerprint;
        existing.deviceClass = member.deviceClass ?? existing.deviceClass;
        existing.ip = member.ip ?? existing.ip;
      } else {
        if (room.members.length >= 2) {
          throw new InviteRoomError('ROOM_FULL', 'Phòng đã đủ người');
        }
        // Chống gian lận: guest MỚI không được cùng thiết bị/máy với thành viên đang có
        if (room.blockSameDevice) {
          const clash = room.members.some((m) =>
            isSameDevice(m, {
              fingerprint: member.fingerprint,
              deviceClass: member.deviceClass,
              ip: member.ip,
            }),
          );
          if (clash) {
            throw new InviteRoomError(
              'ROOM_SAME_DEVICE',
              'Không thể tham gia: bạn đang dùng cùng thiết bị với người mời.',
            );
          }
        }
        room.members.push({
          userId,
          displayName: member.displayName,
          avatar: member.avatar,
          grade: member.grade,
          isHost: false,
          ready: false,
          socketId: member.socketId,
          fingerprint: member.fingerprint,
          deviceClass: member.deviceClass,
          ip: member.ip,
        });
        // Đủ 2 người và chưa vào trận → chuyển sang chờ sẵn sàng
        if (room.members.length === 2 && room.status === 'waiting') {
          room.status = 'ready_check';
        }
      }

      // Hoạt động mới → gia hạn cửa sổ 30 phút
      room.expiresAt = Date.now() + EXPIRY_MS;
      await this.save(room);
      return room;
    });
  }

  /** Đặt trạng thái sẵn sàng của một thành viên */
  static async setReady(roomId: string, userId: string, ready: boolean, socketId?: string): Promise<InviteRoom> {
    return withRedisLock(this.lockKey(roomId), async () => {
      const room = await this.getRoom(roomId);
      if (!room) throw new InviteRoomError('ROOM_NOT_FOUND', 'Phòng không tồn tại hoặc đã hết hạn');
      const member = room.members.find((m) => m.userId === String(userId));
      if (!member) throw new InviteRoomError('ROOM_NOT_FOUND', 'Bạn không ở trong phòng này');
      member.ready = ready;
      if (socketId) member.socketId = socketId;
      room.expiresAt = Date.now() + EXPIRY_MS;
      await this.save(room);
      return room;
    });
  }

  /** Kiểm tra phòng đủ điều kiện bắt đầu một ván mới */
  static canStart(room: InviteRoom): boolean {
    return (
      room.status === 'ready_check' &&
      room.members.length === 2 &&
      room.members.every((m) => m.ready) &&
      room.gamesPlayed < room.maxGames
    );
  }

  /**
   * Thử bắt đầu một ván — atomic dưới lock để chống double-start xuyên instance.
   * `createSession(room)` do handler cung cấp (tạo session game cụ thể), trả về sessionId.
   * Trả về `{ room, sessionId }` nếu bắt đầu được, `null` nếu chưa đủ điều kiện (bên kia
   * chưa sẵn sàng, hoặc instance khác đã bắt đầu).
   */
  static async tryStart(
    roomId: string,
    createSession: (room: InviteRoom) => Promise<string>,
  ): Promise<{ room: InviteRoom; sessionId: string } | null> {
    return withRedisLock(
      this.lockKey(roomId),
      async () => {
        const room = await this.getRoom(roomId);
        if (!room || !this.canStart(room)) return null;

        const sessionId = await createSession(room);

        room.gamesPlayed += 1;
        room.status = 'in_game';
        room.currentSessionId = sessionId;
        room.members.forEach((m) => (m.ready = false));
        room.expiresAt = Date.now() + EXPIRY_MS;
        await this.save(room);
        return { room, sessionId };
      },
      { ttlMs: 20_000, maxWaitMs: 8_000 },
    );
  }

  /**
   * Được gọi khi một ván kết thúc. Đưa phòng về ready_check (chờ tái đấu) nếu còn lượt,
   * ngược lại đóng phòng. Trả về room (đã cập nhật) hoặc null nếu không còn phòng.
   */
  static async onGameEnded(roomId: string): Promise<InviteRoom | null> {
    return withRedisLock(this.lockKey(roomId), async () => {
      const room = await this.getRoom(roomId);
      if (!room) return null;

      room.currentSessionId = undefined;
      room.members.forEach((m) => (m.ready = false));

      if (room.gamesPlayed >= room.maxGames || room.members.length < 2) {
        room.status = 'closed';
      } else {
        room.status = 'ready_check';
      }
      room.expiresAt = Date.now() + EXPIRY_MS;
      await this.save(room);
      return room;
    });
  }

  /**
   * Rời phòng. Trả về `{ room, closed, reason }`.
   * - Host rời → đóng phòng.
   * - Guest rời khi chưa chơi ván nào → quay lại `waiting` (host chờ người khác).
   * - Guest rời sau khi đã chơi → đóng phòng.
   */
  static async leaveRoom(
    roomId: string,
    userId: string,
  ): Promise<{ room: InviteRoom | null; closed: boolean; reason: string | null }> {
    return withRedisLock(this.lockKey(roomId), async () => {
      const room = await this.getRoom(roomId);
      if (!room) return { room: null, closed: false, reason: null };

      const uid = String(userId);
      const member = room.members.find((m) => m.userId === uid);
      if (!member) return { room, closed: false, reason: null };

      if (member.isHost) {
        room.status = 'closed';
        await this.save(room);
        return { room, closed: true, reason: 'host_left' };
      }

      // Guest rời
      if (room.gamesPlayed > 0) {
        room.status = 'closed';
        await this.save(room);
        return { room, closed: true, reason: 'guest_left' };
      }

      room.members = room.members.filter((m) => m.userId !== uid);
      room.status = 'waiting';
      room.expiresAt = Date.now() + EXPIRY_MS;
      await this.save(room);
      return { room, closed: false, reason: 'guest_left' };
    });
  }

  /** Số lượt tái đấu còn lại tính từ trạng thái hiện tại của phòng */
  static rematchRemaining(room: InviteRoom): number {
    return Math.max(0, room.maxGames - room.gamesPlayed);
  }
}
