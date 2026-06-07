import { apiRequest } from './auth';
import type { CurrentEventResponse, JoinEventResponse, LeaderboardEntry, PersonalResultPayload } from '@uniclub/shared';

const API_BASE = `${import.meta.env.VITE_API_BASE_URL || '/api'}/game/weekly-event`;

export const weeklyEventApi = {
  getCurrent: () =>
    apiRequest<{ success: boolean; lastEvent?: { _id: string; title: string } | null } & CurrentEventResponse>(
      API_BASE,
      '/current'
    ),

  joinEvent: (eventId: string, grade: number) =>
    apiRequest<{ success: boolean } & JoinEventResponse>(API_BASE, `/${eventId}/join`, {
      method: 'POST',
      body: JSON.stringify({ grade }),
    }),

  getLeaderboard: (eventId: string, grade: number) =>
    apiRequest<{ success: boolean; leaderboard: LeaderboardEntry[] }>(
      API_BASE,
      `/leaderboard/${eventId}/${grade}`
    ),

  getPersonalResult: (eventId: string) =>
    apiRequest<{ success: boolean; result: PersonalResultPayload }>(
      API_BASE,
      `/result/${eventId}`
    ),
};
