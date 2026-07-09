// ============================================================
// JWT Payload normalize — xử lý thay đổi format token từ UniClass
// ============================================================

import type { AuthUser } from '../types/common';

/**
 * JWT payload format cũ (flat):
 *   { userId, name, grade, avatar, profileId? }
 *
 * JWT payload format mới (user wrapper):
 *   { user: { userId, name, grade, avatar, profileId? } }
 *
 * Helper này normalize cả 2 format về AuthUser,
 * giúp code backend không cần sửa khi UniClass đổi format.
 */
export function normalizeAuthUser(payload: unknown): AuthUser {
  const raw = payload as Record<string, unknown>;

  // Format mới: thông tin user nằm trong field "user"
  if (raw.user && typeof raw.user === 'object') {
    const inner = raw.user as Record<string, unknown>;
    return {
      userId: inner.userId as string,
      name: inner.name as string,
      grade: inner.grade as number | undefined,
      avatar: inner.avatar as string | undefined,
      profileId: inner.profileId as string | undefined,
      type: inner.type === 'guest' ? 'guest' : 'user',
    };
  }

  // Format cũ: thông tin user nằm ngay ở root
  return {
    userId: raw.userId as string,
    name: raw.name as string,
    grade: raw.grade as number | undefined,
    avatar: raw.avatar as string | undefined,
    profileId: raw.profileId as string | undefined,
    type: raw.type === 'guest' ? 'guest' : 'user',
  };
}