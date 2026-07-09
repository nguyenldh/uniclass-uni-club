import { redis } from '../config/index.js';
import { UserModel } from '../models/index.js';
import { REDIS_KEYS, USER_PROFILE_CACHE_TTL } from '@uniclub/shared';
import type { AuthUser } from '@uniclub/shared';

function cacheKey(userId: string): string {
  return `${REDIS_KEYS.USER_PROFILE}:${userId}`;
}

export class UserService {
  /**
   * Lấy thông tin người dùng.
   * Ưu tiên cache Redis, fallback MongoDB.
   * Trả về null nếu chưa từng upsert.
   */
  static async getUser(userId: string): Promise<AuthUser | null> {
    const cached = await redis.get(cacheKey(userId));
    if (cached) return JSON.parse(cached) as AuthUser;

    const doc = await UserModel.findOne({ userId }).lean();
    if (!doc) return null;

    const profile: AuthUser = {
      userId: doc.userId,
      name: doc.name,
      grade: doc.grade,
      avatar: doc.avatar,
      type: doc.type ?? 'user',
    };

    await redis.set(cacheKey(userId), JSON.stringify(profile), 'EX', USER_PROFILE_CACHE_TTL);
    return profile;
  }

  /**
   * Lưu hoặc cập nhật thông tin người dùng (upsert).
   * Gọi khi user authenticate thành công để giữ profile đồng bộ.
   * Đồng thời cập nhật lastSeenAt.
   */
  static async upsertUser(user: AuthUser): Promise<AuthUser> {
    const { userId, name, grade, avatar } = user;
    const type = user.type ?? 'user';

    await UserModel.findOneAndUpdate(
      { userId },
      { $set: { name, grade, avatar, type, lastSeenAt: new Date() } },
      { upsert: true, new: true },
    );

    const profile: AuthUser = { userId, name, grade, avatar, type };
    await redis.set(cacheKey(userId), JSON.stringify(profile), 'EX', USER_PROFILE_CACHE_TTL);
    return profile;
  }

  /**
   * Xoá cache Redis của user (dùng khi có thay đổi profile từ bên ngoài).
   */
  static async invalidateCache(userId: string): Promise<void> {
    await redis.del(cacheKey(userId));
  }
}
