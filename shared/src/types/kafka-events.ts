// ============================================================
// Kafka Event DTOs — Gửi kết quả game sang UniClass
// ============================================================

/**
 * Game type trong Kafka event (UniClass format).
 * Mapping từ internal game types.
 */
export type KafkaGameType = 'SO_TAI' | 'CARO' | 'LAT_MANH_GHEP' | 'SAN_BOSS' | 'SU_KIEN_TUAN';

/**
 * Kafka topic: club-game-result
 * Kết quả từ các game So Tài, Đấu Trí, Cờ Caro, Lật mảnh ghép, Săn Boss.
 */
export interface ClubGameResultDto {
  /** Profile ID của user (từ UniClass) */
  profileId: string;
  /** Loại tài khoản: `user` (học sinh thường) hoặc `guest` (khách được mời) */
  type?: 'user' | 'guest';
  /** Loại game */
  gameType: KafkaGameType;
  /** Số UniPoint được cộng trực tiếp từ kết quả game */
  point: number;
  /** Thời gian chơi tính bằng giây */
  playTime: number;
  /** Đã hoàn thành phiên chơi (không thoát giữa chừng) */
  sessionCompleted: boolean;
  /** Có thắng không (dùng cho task thắng liên tiếp) */
  isWin: boolean;
  /** Số câu đúng (dùng cho task So Tài) */
  correctCount?: number;
  /** Tổng số câu hỏi (dùng cho task So Tài) */
  totalQuestions?: number;
  /** Thời gian hoàn thành (dùng cho task Lật mảnh ghép 60s) */
  durationSeconds?: number;
  /** Số cặp ghép liên tiếp đúng (dùng cho task 10) */
  consecutivePairs?: number;
}

/**
 * Kafka topic: club-weekly-event
 * Kết quả Săn Boss trong Weekly Event.
 */
export interface ClubWeeklyEventDto {
  /** Profile ID của user (từ UniClass) */
  profileId: string;
  /** Type cố định */
  type: 'WEEKLY_EVENT';
  /** Data chi tiết */
  data: {
    quiz: {
      /** Tuần trong năm (1-52) */
      week: number;
      /** Năm */
      year: number;
      /** Điểm đạt được */
      point: number;
      /** Số câu đúng */
      correctCount: number;
      /** Tổng số câu hỏi */
      totalQuestions: number;
      /** Đã hoàn thành session */
      sessionCompleted: boolean;
      /** Thời gian chơi (giây) */
      playTime: number;
      /** Timestamp bắt đầu tuần (ms) */
      startTime: number;
      /** Timestamp kết thúc tuần (ms) */
      endTime: number;
    };
  };
}

// ---- Kafka Topics ----

export const KAFKA_TOPICS = {
  /** Kết quả game thông thường */
  CLUB_GAME_RESULT: 'club-game-result',
  /** Kết quả Weekly Event */
  CLUB_WEEKLY_EVENT: 'club-weekly-event',
} as const;

// ---- Mapping helpers ----

/** Map internal game type → Kafka game type */
export const GAME_TYPE_TO_KAFKA: Record<string, KafkaGameType> = {
  quiz_arena: 'SO_TAI',
  quiz: 'SO_TAI',
  gomoku: 'CARO',
  card_flip: 'LAT_MANH_GHEP',
  boss_battle: 'SAN_BOSS',
  weekly_event: 'SU_KIEN_TUAN',
};
