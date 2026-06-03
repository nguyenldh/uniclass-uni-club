// ============================================================
// Quiz Arena — Bot Service
// Giả lập hành vi bot theo profile độ khó
// ============================================================

import type { QuizQuestion, QuizBotProfile } from '@uniclub/shared';

export interface BotDecision {
  /** null nếu bot không trả lời (giả lập hết giờ) */
  selectedIndex: number | null;
  /** Thời gian phản xạ giả lập (ms) */
  responseTimeMs: number;
}

export class QuizBotService {
  /**
   * Tính toán quyết định của bot cho một câu hỏi.
   * Trả về selectedIndex và responseTimeMs để scheduler dùng.
   */
  static decide(question: QuizQuestion, profile: QuizBotProfile): BotDecision {
    const { correctRate, minResponseMs, maxResponseMs, } = profile;
    const timeLimitMs = question.timeLimitSeconds * 1000;

    // Random thời gian phản xạ trong khoảng [min, max], clamp xuống timeLimit
    const responseTimeMs = Math.min(
      Math.floor(Math.random() * (maxResponseMs - minResponseMs + 1)) + minResponseMs,
      timeLimitMs - 100, // clamp: trả lời trước khi hết giờ 100ms
    );

    // Random xem có trả lời đúng không
    const isCorrect = Math.random() < correctRate;

    if (isCorrect) {
      return { selectedIndex: question.correctIndex, responseTimeMs };
    }

    // Trả lời sai: chọn ngẫu nhiên trong 3 đáp án còn lại
    const wrongOptions = [0, 1, 2, 3].filter((i) => i !== question.correctIndex);
    const selectedIndex = wrongOptions[Math.floor(Math.random() * wrongOptions.length)];

    return { selectedIndex, responseTimeMs };
  }
}
