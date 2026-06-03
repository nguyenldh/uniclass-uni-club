// ============================================================
// Kafka Producer Service — Gửi events sang UniClass
// ============================================================

import { getKafkaProducer } from '../config/index';
import {
  ClubGameResultDto,
  ClubWeeklyEventDto,
  KAFKA_TOPICS,
} from '@uniclub/shared';

export class KafkaProducerService {
  /**
   * Gửi kết quả game lên Kafka topic `club-game-result`.
   * Fire-and-forget: không throw error để không block game flow.
   */
  static async sendGameResult(payload: ClubGameResultDto): Promise<boolean> {
    const producer = getKafkaProducer();

    if (!producer) {
      console.log('[KafkaProducer] Producer not available, skipping sendGameResult');
      return false;
    }

    try {
      await producer.send({
        topic: KAFKA_TOPICS.CLUB_GAME_RESULT,
        messages: [
          {
            key: payload.profileId,
            value: JSON.stringify(payload),
          },
        ],
      });

      console.log(
        `[KafkaProducer] Sent game result: profile=${payload.profileId} ` +
        `game=${payload.gameType} point=${payload.point} win=${payload.isWin}`,
      );
      return true;
    } catch (error) {
      console.error('[KafkaProducer] Failed to send game result:', error);
      return false;
    }
  }

  /**
   * Gửi kết quả Weekly Event lên Kafka topic `club-weekly-event`.
   * Fire-and-forget: không throw error để không block game flow.
   */
  static async sendWeeklyEvent(payload: ClubWeeklyEventDto): Promise<boolean> {
    const producer = getKafkaProducer();

    if (!producer) {
      console.log('[KafkaProducer] Producer not available, skipping sendWeeklyEvent');
      return false;
    }

    try {
      await producer.send({
        topic: KAFKA_TOPICS.CLUB_WEEKLY_EVENT,
        messages: [
          {
            key: payload.profileId,
            value: JSON.stringify(payload),
          },
        ],
      });

      console.log(
        `[KafkaProducer] Sent weekly event: profile=${payload.profileId} ` +
        `week=${payload.data.quiz.week} point=${payload.data.quiz.point}`,
      );
      return true;
    } catch (error) {
      console.error('[KafkaProducer] Failed to send weekly event:', error);
      return false;
    }
  }
}
