import { redis } from '../config/index';

const SOCKET_REGISTRY_KEY = 'user:sockets';

export class SocketRegistry {
  /**
   * Đăng ký mapping userId -> socketId khi user kết nối hoặc cung cấp identity.
   */
  static async register(userId: string, socketId: string): Promise<void> {
    await redis.hset(SOCKET_REGISTRY_KEY, userId, socketId);
  }

  /**
   * Xóa mapping userId -> socketId khi ngắt kết nối.
   * Chỉ xóa nếu socketId hiện tại trùng khớp để tránh race conditions.
   */
  static async deregister(userId: string, socketId: string): Promise<void> {
    const current = await redis.hget(SOCKET_REGISTRY_KEY, userId);
    if (current === socketId) {
      await redis.hdel(SOCKET_REGISTRY_KEY, userId);
    }
  }

  /**
   * Lấy socketId hiện tại của user.
   */
  static async getSocketId(userId: string): Promise<string | undefined> {
    const socketId = await redis.hget(SOCKET_REGISTRY_KEY, userId);
    return socketId || undefined;
  }
}
