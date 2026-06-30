// ============================================================
// Analytics — Types cho CMS Dashboard
// ============================================================

/**
 * Tổng quan chỉ số KPI cho CMS Analytics Dashboard.
 * Backend tính qua MongoDB aggregation, CMS hiển thị trực tiếp.
 */
export interface AnalyticsOverview {
  /** Khoảng thời gian được filter */
  period: { from: string; to: string; label: string };

  // ---- Traffic / Participation ----

  /** Tổng số HS đã truy cập UniClub (User collection) */
  totalUniclubUsers: number;
  /** Tổng số HS đã chơi ít nhất 1 game (regular) */
  totalGamePlayers: number;
  /** Tỷ lệ tham gia game = totalGamePlayers / totalUniclubUsers (%) */
  participationRateGame: number;

  // ---- Retention ----

  /** Retention rate tuần (%) */
  retentionRateWeekly: number;

  // ---- Completion rates ----

  /** Tỷ lệ hoàn thành So Tài (%) */
  completionRateQuizArena: number;
  /** Tỷ lệ hoàn thành Đấu Trí (%) — gộp gomoku + card_flip */
  completionRateMindGame: number;
  /** Tỷ lệ hoàn thành Săn Boss (%) */
  completionRateBossBattle: number;
  /** Tỷ lệ hoàn thành Weekly Event (%) */
  completionRateWeeklyEvent: number;

  // ---- Average scores ----

  /** Điểm trung bình So Tài */
  avgScoreQuizArena: number;
  /** Điểm trung bình Đấu Trí */
  avgScoreMindGame: number;
  /** Điểm trung bình Săn Boss */
  avgScoreBossBattle: number;
  /** Điểm trung bình Weekly Event */
  avgScoreWeeklyEvent: number;

  // ---- Average times ----

  /** Thời gian trung bình hoàn thành So Tài (giây) */
  avgTimeQuizArena: number;
  /** Thời gian trung bình hoàn thành Đấu Trí (giây) */
  avgTimeMindGame: number;
  /** Thời gian trung bình hoàn thành Săn Boss (giây) */
  avgTimeBossBattle: number;
  /** Thời gian trung bình hoàn thành Weekly Event (giây) */
  avgTimeWeeklyEvent: number;
}
