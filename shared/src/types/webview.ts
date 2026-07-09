// ============================================================
// WebView Message Types — contract giữa game WebView và parent app
// ============================================================

import type { GameType } from './common';
import type { KafkaGameType } from './kafka-events';

/**
 * Loại message mà game WebView có thể gửi ra parent app qua postMessage.
 *
 * Quy tắc:
 * - Mỗi message type phải có prefix theo domain (game:, app:, ...)
 * - Payload phải là plain object (JSON-serializable)
 * - Parent app lắng nghe `message` event và filter theo type
 */
export type WebViewMessageType =
  | 'app:exit'          // Yêu cầu đóng WebView / thoát game
  | 'app:ready'         // Game đã load xong, sẵn sàng nhận lệnh
  | 'game:started'      // Bắt đầu một ván game
  | 'game:ended'        // Kết thúc một ván game
  | 'game:score'        // Cập nhật điểm số giữa ván
  | 'game:error'        // Lỗi trong game
  | 'mgm:invite'        // Mời bạn vào phòng — parent app xử lý chia sẻ link
  | 'mgm:guest-reward'  // Guest bấm "Đổi quà" sau khi chơi xong
  | 'mgm:user-reward';  // User bấm nút "Thưởng" ở sảnh

/**
 * Format tổng quát cho mọi message gửi từ WebView ra parent.
 *
 * Ví dụ usage:
 * ```ts
 * postWebViewMessage('app:exit', { from: '/mind-game' });
 * postWebViewMessage('game:ended', { gameType: 'mind_game', ... });
 * ```
 */
export interface WebViewMessage<T = unknown> {
  /** Loại message — dùng hằng số từ WEBVIEW_MESSAGE_TYPES */
  type: WebViewMessageType;
  /** Dữ liệu tuỳ theo loại message */
  payload?: T;
  /** Timestamp khi gửi message */
  timestamp: number;
  /** Phiên bản format — để parent app xử lý backward compatibility */
  version: number;
}

/**
 * Payload cho message type 'app:exit'
 */
export interface WebViewExitPayload {
  /** Game đang thoát (route path) */
  from?: string;
  /** Lý do thoát (vd. 'user_action', 'error') */
  reason?: string;
}

/**
 * Payload cho message type 'mgm:invite'.
 * Bắn ra khi người chơi tạo phòng mời bạn hoặc bấm "Chia sẻ".
 * Parent app (UniClass) nhận và xử lý chia sẻ link (share sheet, sao chép, v.v.).
 */
export interface WebViewInvitePayload {
  /** profileId của người mời (host) */
  profileId: string;
  /** ID phòng chờ */
  roomId: string;
  /** Loại game của phòng (vd. 'quiz') */
  gameType: string;
  /** Đường dẫn tương đối để vào phòng (parent tự ghép domain) */
  joinUrl: string;
}

/**
 * Payload cho message type 'mgm:guest-reward'.
 * Guest bấm "Đổi quà" sau khi chơi xong — cung cấp thông tin cần thiết của guest
 * để parent app (UniClass) xử lý đổi/trao quà cho khách.
 */
export interface WebViewGuestRewardPayload {
  /** profileId của guest */
  profileId: string;
  /** Tên hiển thị của guest */
  name?: string;
  /** Loại tài khoản — luôn là 'guest' */
  type: 'guest';
  /** ID phòng mời */
  roomId?: string;
  /** Loại game (vd. 'quiz_arena') */
  gameType?: string;
  /** ID phiên chơi vừa kết thúc */
  sessionId?: string;
  /** Số câu trả lời đúng của guest */
  correctCount?: number;
  /** Tổng số câu trong trận */
  totalQuestions?: number;
  /** Guest có thắng trận không */
  isWin?: boolean;
}

/**
 * Payload cho message type 'mgm:user-reward'.
 * User bấm nút "Thưởng" ở sảnh — cung cấp thông tin user để parent app trao/đổi quà.
 */
export interface WebViewUserRewardPayload {
  /** profileId của user */
  profileId: string;
  /** Tên hiển thị */
  name?: string;
  /** Loại tài khoản — luôn là 'user' */
  type: 'user';
  /** Khối lớp */
  grade?: number;
  /** Avatar URL */
  avatar?: string;
}

/**
 * Payload cho message type 'game:ended'
 *
 * Tương thích với ClubGameResultDto (Kafka) — parent app (UniClass)
 * có thể map trực tiếp hoặc dùng kafkaGameType để gửi tiếp lên Kafka.
 */
export interface WebViewGameEndedPayload {
  /** User ID của người chơi (frontend chỉ biết userId, parent app tự map sang profileId) */
  userId: string;
  /** Loại game (internal format) — 'mind_game' | 'quiz_arena' | 'boss_battle' */
  gameType: GameType;
  /** Loại game (Kafka format) — 'SO_TAI' | 'CARO' | 'LAT_MANH_GHEP' | 'SAN_BOSS' */
  kafkaGameType: KafkaGameType;
  /** Sub-game cụ thể (chỉ cho mind_game: 'gomoku' | 'card_flip') */
  subGame?: 'gomoku' | 'card_flip';
  /** ID phiên chơi (sessionId hoặc attemptId) */
  sessionId?: string;
  /** Loại tài khoản người chơi: `user` (học sinh) hoặc `guest` (khách được mời) */
  type?: 'user' | 'guest';
  /** ID phòng mời (chỉ có khi trận đến từ phòng mời bạn) */
  roomId?: string;
  /** Số UniPoint đạt được */
  point: number;
  /** Thời gian chơi tính bằng giây */
  playTime: number;
  /** Có hoàn thành phiên chơi không (false = bỏ cuộc giữa chừng) */
  sessionCompleted: boolean;
  /** Có thắng không */
  isWin: boolean;
  /** Số câu đúng (So Tài, Săn Boss) */
  correctCount?: number;
  /** Tổng số câu hỏi (So Tài, Săn Boss) */
  totalQuestions?: number;
  /** Thời gian hoàn thành tính bằng giây (Lật Mảnh Ghép) */
  durationSeconds?: number;
  /** Số cặp ghép liên tiếp đúng (Lật Mảnh Ghép) */
  consecutivePairs?: number;
}