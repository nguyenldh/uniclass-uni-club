import { redis } from '../config/index';

// Key riêng cho từng user (thay vì 1 hash chung) để đặt được TTL —
// nếu instance crash trước khi deregister, entry stale tự hết hạn
// thay vì nằm vĩnh viễn và nuốt mất event matched của lần ghép sau.
const SOCKET_REGISTRY_PREFIX = 'user:socket';

/** TTL 24h — register được refresh mỗi lần user join matchmaking / join session */
const SOCKET_REGISTRY_TTL_SECONDS = 24 * 60 * 60;

function registryKey(userId: string): string {
  return `${SOCKET_REGISTRY_PREFIX}:${userId}`;
}

export class SocketRegistry {
  /**
   * Đăng ký mapping userId -> socketId khi user kết nối hoặc cung cấp identity.
   */
  static async register(userId: string, socketId: string): Promise<void> {
    await redis.set(registryKey(userId), socketId, 'EX', SOCKET_REGISTRY_TTL_SECONDS);
  }

  /**
   * Xóa mapping userId -> socketId khi ngắt kết nối.
   * Chỉ xóa nếu socketId hiện tại trùng khớp để tránh race conditions.
   */
  static async deregister(userId: string, socketId: string): Promise<void> {
    const current = await redis.get(registryKey(userId));
    if (current === socketId) {
      await redis.del(registryKey(userId));
    }
  }

  /**
   * Lấy socketId hiện tại của user.
   */
  static async getSocketId(userId: string): Promise<string | undefined> {
    const socketId = await redis.get(registryKey(userId));
    return socketId || undefined;
  }
}
