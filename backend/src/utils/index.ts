import crypto from 'node:crypto';

// ============================================================
// Common Utils — dùng chung cho mọi nhóm game
// ============================================================

/** Tạo ID duy nhất cho session */
export function generateSessionId(): string {
  return crypto.randomUUID();
}

/** Shuffle mảng (Fisher-Yates) */
export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
