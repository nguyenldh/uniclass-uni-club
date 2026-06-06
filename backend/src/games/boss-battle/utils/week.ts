// ============================================================
// Boss Battle — Week / Date helpers
// ============================================================

/**
 * Format `weekKey` theo ISO 8601 (YYYY-Www, vd "2026-W23").
 * Tuần bắt đầu Thứ Hai theo ISO.
 */
export function formatWeekKey(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/** Format dateKey theo "YYYY-MM-DD" (UTC) */
export function formatDateKey(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Lấy dayIndex (1..7) trong tuần ISO của ngày hiện tại — Thứ Hai = 1, Chủ Nhật = 7 */
export function getDayIndex(date: Date = new Date()): number {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

/**
 * Mốc reset tuần kế tiếp: 00:00 giờ Việt Nam (UTC+7) của Thứ Hai tuần kế.
 * Tương đương Chủ Nhật 17:00 UTC.
 * Trả về ISO string.
 */
export function getNextWeeklyResetAt(date: Date = new Date()): string {
  // Monday 00:00 Vietnam (UTC+7) = Sunday 17:00 UTC
  const now = date.getTime();

  // Today at 17:00 UTC
  const today17Utc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    17, 0, 0, 0,
  );

  // Days until next Sunday (0 = Sunday in UTC)
  const dayOfWeek = date.getUTCDay();
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;

  let target = today17Utc + daysUntilSunday * 86400000;

  // If already past this Sunday 17:00 UTC, go to next Sunday
  if (now >= target) {
    target += 7 * 86400000;
  }

  return new Date(target).toISOString();
}

/** Tính weekKey của tuần trước weekKey hiện tại (ISO week math via Monday anchor) */
export function getPreviousWeekKey(weekKey: string): string {
  // Parse YYYY-Www
  const match = weekKey.match(/^(\d{4})-W(\d{1,2})$/);
  if (!match) return weekKey;
  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);

  // ISO week 1 = week containing first Thursday → Monday of week 1 may be Dec prev year
  // Đơn giản: tính Monday của tuần week, trừ 7 ngày, rồi formatWeekKey lại
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const currentMonday = new Date(week1Monday);
  currentMonday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  const prevMonday = new Date(currentMonday);
  prevMonday.setUTCDate(currentMonday.getUTCDate() - 7);
  return formatWeekKey(prevMonday);
}

/** Trả `[year, weekNumber]` từ weekKey để dùng cho Kafka `week`/`year` */
export function parseWeekKey(weekKey: string): { year: number; week: number } {
  const match = weekKey.match(/^(\d{4})-W(\d{1,2})$/);
  if (!match) return { year: new Date().getUTCFullYear(), week: 1 };
  return { year: parseInt(match[1], 10), week: parseInt(match[2], 10) };
}

/**
 * Mốc bắt đầu tuần ISO (Thứ Hai 00:00 UTC) cho weekKey.
 * Trả về null nếu weekKey sai format.
 */
export function getWeekStartAt(weekKey: string): Date | null {
  const match = weekKey.match(/^(\d{4})-W(\d{1,2})$/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const monday = new Date(week1Monday);
  monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return monday;
}

/** Tuần đã bắt đầu chạy (now >= Monday 00:00 UTC của weekKey). Format sai → false. */
export function isWeekStarted(weekKey: string, now: Date = new Date()): boolean {
  const start = getWeekStartAt(weekKey);
  if (!start) return false;
  return now.getTime() >= start.getTime();
}
