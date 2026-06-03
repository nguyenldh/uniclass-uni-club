// ============================================================
// Boss Battle (Săn Boss) — REST API client
// ============================================================

import type {
  BossLobbyResponse,
  BossBattleStartResponse,
  BossAnswerResponse,
  BossDailyResultResponse,
  BossLeaderboardResponse,
  WeeklyHonor,
} from '@uniclub/shared';
import { apiRequest } from './auth';

const API_BASE = `${import.meta.env.VITE_API_BASE_URL || '/api'}/game/boss-battle`;

export const bossBattleApi = {
  /** FLW-03: Lấy dữ liệu sảnh (BossInstance + DailyAttempt hôm nay + tiến độ cá nhân) */
  getLobby: (grade: number) =>
    apiRequest<{ success: boolean } & BossLobbyResponse>(API_BASE, `/lobby?grade=${grade}`),

  /** FLW-04: Bắt đầu / resume lượt chiến đấu hôm nay */
  startBattle: (grade: number) =>
    apiRequest<{ success: boolean } & BossBattleStartResponse>(API_BASE, '/battle/start', {
      method: 'POST',
      body: JSON.stringify({ grade }),
    }),

  /** FLW-05: Nộp đáp án 1 câu */
  submitAnswer: (attemptId: string, questionId: string, selectedIndex: number | null) =>
    apiRequest<{ success: boolean } & BossAnswerResponse>(API_BASE, '/battle/answer', {
      method: 'POST',
      body: JSON.stringify({ attemptId, questionId, selectedIndex }),
    }),

  /** FLW-06: Lấy kết quả lượt sau khi hoàn thành (hoặc F5 ở result page) */
  getAttemptResult: (attemptId: string) =>
    apiRequest<{ success: boolean } & BossDailyResultResponse>(API_BASE, `/attempt/${attemptId}/result`),

  /** Lấy bảng xếp hạng theo tuần + khối */
  getLeaderboard: (weekKey: string, grade: number, limit?: number) => {
    const params = new URLSearchParams({ weekKey, grade: String(grade) });
    if (limit != null) params.set('limit', String(limit));
    return apiRequest<{ success: boolean } & BossLeaderboardResponse>(API_BASE, `/leaderboard?${params}`);
  },

  /** Lấy danh sách vinh danh tuần hiện tại (nếu có) */
  getCurrentHonors: (grade: number) =>
    apiRequest<{ success: boolean; honors: WeeklyHonor[] }>(API_BASE, `/honor/current?grade=${grade}`),
};
