// ============================================================
// CMS — Weekly Event API Service
// ============================================================

import api from './api';
import type {
  WeeklyEventGeneralConfig,
  WeeklyEvent,
  WeeklyEventRoom,
  ExamBank,
  CreateExamInput,
  UpdateExamInput,
  CreateEventInput,
  UpdateEventInput,
  AssignExamInput,
  UpdateGeneralConfigInput,
} from '@uniclub/shared';

export interface ListEventsParams {
  status?: string;
  weekNumber?: number;
  year?: number;
  page?: number;
  pageSize?: number;
}

export interface ListEventsResult {
  items: WeeklyEvent[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListExamsParams {
  grade?: number;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface ListExamsResult {
  items: ExamBank[];
  total: number;
  page: number;
  pageSize: number;
}

export const weeklyEventService = {
  // ---- General Config ----
  async getGeneralConfig(): Promise<WeeklyEventGeneralConfig> {
    const res = await api.get<{ success: boolean; config: WeeklyEventGeneralConfig }>(
      '/weekly-event/general-config',
    );
    return res.data.config;
  },

  async updateGeneralConfig(input: UpdateGeneralConfigInput): Promise<WeeklyEventGeneralConfig> {
    const res = await api.put<{ success: boolean; config: WeeklyEventGeneralConfig }>(
      '/weekly-event/general-config',
      input,
    );
    return res.data.config;
  },

  // ---- Events ----
  async listEvents(params: ListEventsParams = {}): Promise<ListEventsResult> {
    const res = await api.get<{ success: boolean } & ListEventsResult>(
      '/weekly-event/events',
      { params },
    );
    return {
      items: res.data.items,
      total: res.data.total,
      page: res.data.page,
      pageSize: res.data.pageSize,
    };
  },

  async getEvent(id: string): Promise<WeeklyEvent | null> {
    try {
      const res = await api.get<{ success: boolean; event: WeeklyEvent }>(
        `/weekly-event/events/${id}`,
      );
      return res.data.event;
    } catch {
      return null;
    }
  },

  async createEvent(input: CreateEventInput): Promise<WeeklyEvent> {
    const res = await api.post<{ success: boolean; event: WeeklyEvent }>(
      '/weekly-event/events',
      input,
    );
    return res.data.event;
  },

  async updateEvent(id: string, input: UpdateEventInput): Promise<WeeklyEvent> {
    const res = await api.put<{ success: boolean; event: WeeklyEvent }>(
      `/weekly-event/events/${id}`,
      input,
    );
    return res.data.event;
  },

  async publishEvent(id: string): Promise<WeeklyEvent> {
    const res = await api.post<{ success: boolean; event: WeeklyEvent }>(
      `/weekly-event/events/${id}/publish`,
    );
    return res.data.event;
  },

  async cancelEvent(id: string, reason: string): Promise<WeeklyEvent> {
    const res = await api.post<{ success: boolean; event: WeeklyEvent }>(
      `/weekly-event/events/${id}/cancel`,
      { reason },
    );
    return res.data.event;
  },

  async assignExam(eventId: string, input: AssignExamInput): Promise<WeeklyEvent> {
    const res = await api.post<{ success: boolean; event: WeeklyEvent }>(
      `/weekly-event/events/${eventId}/assign-exam`,
      input,
    );
    return res.data.event;
  },

  async getRooms(eventId: string): Promise<Array<{
    grade: number;
    status: string;
    participantCount: number;
    submittedCount: number;
    examId?: string;
  }>> {
    const res = await api.get<{ success: boolean; rooms: any[] }>(
      `/weekly-event/events/${eventId}/rooms`,
    );
    return res.data.rooms;
  },

  async getRoomLeaderboard(eventId: string, grade: number): Promise<any[]> {
    const res = await api.get<{ success: boolean; leaderboard: any[] }>(
      `/weekly-event/events/${eventId}/rooms/${grade}/leaderboard`,
    );
    return res.data.leaderboard;
  },

  async getRoomParticipants(
    eventId: string,
    grade: number,
    params: { page?: number; pageSize?: number; search?: string },
  ): Promise<{ items: any[]; total: number; page: number; pageSize: number }> {
    const res = await api.get<{
      success: boolean;
      items: any[];
      total: number;
      page: number;
      pageSize: number;
    }>(`/weekly-event/events/${eventId}/rooms/${grade}/participants`, { params });
    return res.data;
  },

  async getStudentAnswers(
    eventId: string,
    grade: number,
    studentId: string,
  ): Promise<{ result: any; answers: any[]; exam: any }> {
    const res = await api.get<{
      success: boolean;
      result: any;
      answers: any[];
      exam: any;
    }>(`/weekly-event/events/${eventId}/rooms/${grade}/participants/${studentId}/answers`);
    return res.data;
  },

  // ---- Exam Bank ----
  async listExams(params: ListExamsParams = {}): Promise<ListExamsResult> {
    const res = await api.get<{ success: boolean } & ListExamsResult>(
      '/weekly-event/exams',
      { params },
    );
    return {
      items: res.data.items,
      total: res.data.total,
      page: res.data.page,
      pageSize: res.data.pageSize,
    };
  },

  async getExamsByGrade(grade: number): Promise<ExamBank[]> {
    const res = await api.get<{ success: boolean; exams: ExamBank[] }>(
      `/weekly-event/exams/by-grade/${grade}`,
    );
    return res.data.exams;
  },

  async getExam(id: string): Promise<ExamBank | null> {
    try {
      const res = await api.get<{ success: boolean; exam: ExamBank }>(
        `/weekly-event/exams/${id}`,
      );
      return res.data.exam;
    } catch {
      return null;
    }
  },

  async createExam(input: CreateExamInput): Promise<ExamBank> {
    const res = await api.post<{ success: boolean; exam: ExamBank }>(
      '/weekly-event/exams',
      input,
    );
    return res.data.exam;
  },

  async updateExam(id: string, input: UpdateExamInput): Promise<ExamBank> {
    const res = await api.put<{ success: boolean; exam: ExamBank }>(
      `/weekly-event/exams/${id}`,
      input,
    );
    return res.data.exam;
  },

  async deleteExam(id: string): Promise<boolean> {
    try {
      await api.delete(`/weekly-event/exams/${id}`);
      return true;
    } catch {
      return false;
    }
  },

  async bulkCreateExams(exams: CreateExamInput[]): Promise<{
    createdCount: number;
    errorCount: number;
    errors: Array<{ index: number; title?: string; error: string }>;
  }> {
    const res = await api.post<{
      success: boolean;
      createdCount: number;
      errorCount: number;
      errors: Array<{ index: number; title?: string; error: string }>;
    }>('/weekly-event/exams/bulk', { exams });
    return {
      createdCount: res.data.createdCount,
      errorCount: res.data.errorCount,
      errors: res.data.errors,
    };
  },
};

export default weeklyEventService;
