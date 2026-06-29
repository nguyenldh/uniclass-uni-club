// ============================================================
// CMS — Weekly Event Zustand Store
// ============================================================

import { create } from 'zustand';
import type {
  WeeklyEventGeneralConfig,
  WeeklyEvent,
  ExamBank,
  CreateExamInput,
  UpdateExamInput,
  CreateEventInput,
  UpdateEventInput,
  AssignExamInput,
  UpdateGeneralConfigInput,
} from '@uniclub/shared';
import { weeklyEventService } from '../services/weekly-event.service';

interface WeeklyEventState {
  // General Config
  generalConfig: WeeklyEventGeneralConfig | null;

  // Events
  events: WeeklyEvent[];
  eventsTotal: number;
  currentEvent: WeeklyEvent | null;

  // Exams
  exams: ExamBank[];
  examsTotal: number;
  currentExam: ExamBank | null;

  // Rooms
  rooms: Array<{
    grade: number;
    status: string;
    participantCount: number;
    submittedCount: number;
    examId?: string;
  }>;

  // UI State
  isLoading: boolean;
  error: string | null;

  // Actions — General Config
  loadGeneralConfig: () => Promise<void>;
  updateGeneralConfig: (input: UpdateGeneralConfigInput) => Promise<void>;

  // Actions — Events
  loadEvents: (params?: { status?: string; page?: number; pageSize?: number }) => Promise<void>;
  loadEvent: (id: string) => Promise<void>;
  createEvent: (input: CreateEventInput) => Promise<WeeklyEvent>;
  updateEvent: (id: string, input: UpdateEventInput) => Promise<void>;
  publishEvent: (id: string) => Promise<void>;
  cancelEvent: (id: string, reason: string) => Promise<void>;
  assignExam: (eventId: string, input: AssignExamInput) => Promise<void>;
  loadRooms: (eventId: string) => Promise<void>;

  // Actions — Exams
  loadExams: (params?: { grade?: number; search?: string; page?: number; pageSize?: number }) => Promise<void>;
  loadExamsByGrade: (grade: number) => Promise<ExamBank[]>;
  loadExam: (id: string) => Promise<void>;
  createExam: (input: CreateExamInput) => Promise<ExamBank>;
  updateExam: (id: string, input: UpdateExamInput) => Promise<void>;
  deleteExam: (id: string) => Promise<void>;

  // Helpers
  clearError: () => void;
}

export const useWeeklyEventStore = create<WeeklyEventState>((set, get) => ({
  generalConfig: null,
  events: [],
  eventsTotal: 0,
  currentEvent: null,
  exams: [],
  examsTotal: 0,
  currentExam: null,
  rooms: [],
  isLoading: false,
  error: null,

  // ---- General Config ----
  loadGeneralConfig: async () => {
    set({ isLoading: true, error: null });
    try {
      const config = await weeklyEventService.getGeneralConfig();
      set({ generalConfig: config, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false, error: error.response?.data?.error || 'Không thể tải cấu hình' });
    }
  },

  updateGeneralConfig: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const config = await weeklyEventService.updateGeneralConfig(input);
      set({ generalConfig: config, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false, error: error.response?.data?.error || 'Không thể cập nhật cấu hình' });
      throw error;
    }
  },

  // ---- Events ----
  loadEvents: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const result = await weeklyEventService.listEvents(params);
      set({ events: result.items, eventsTotal: result.total, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false, error: error.response?.data?.error || 'Không thể tải danh sách sự kiện' });
    }
  },

  loadEvent: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const event = await weeklyEventService.getEvent(id);
      set({ currentEvent: event, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false, error: error.response?.data?.error || 'Không thể tải sự kiện' });
    }
  },

  createEvent: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const event = await weeklyEventService.createEvent(input);
      set({ isLoading: false });
      return event;
    } catch (error: any) {
      set({ isLoading: false, error: error.response?.data?.error || 'Không thể tạo sự kiện' });
      throw error;
    }
  },

  updateEvent: async (id, input) => {
    set({ isLoading: true, error: null });
    try {
      const event = await weeklyEventService.updateEvent(id, input);
      set({ currentEvent: event, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false, error: error.response?.data?.error || 'Không thể cập nhật sự kiện' });
      throw error;
    }
  },

  publishEvent: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const event = await weeklyEventService.publishEvent(id);
      set({ currentEvent: event, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false, error: error.response?.data?.error || 'Không thể publish sự kiện' });
      throw error;
    }
  },

  cancelEvent: async (id, reason) => {
    set({ isLoading: true, error: null });
    try {
      const event = await weeklyEventService.cancelEvent(id, reason);
      set({ currentEvent: event, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false, error: error.response?.data?.error || 'Không thể hủy sự kiện' });
      throw error;
    }
  },

  assignExam: async (eventId, input) => {
    set({ isLoading: true, error: null });
    try {
      const event = await weeklyEventService.assignExam(eventId, input);
      set({ currentEvent: event, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false, error: error.response?.data?.error || 'Không thể gán đề' });
      throw error;
    }
  },

  loadRooms: async (eventId) => {
    try {
      const rooms = await weeklyEventService.getRooms(eventId);
      set({ rooms });
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Không thể tải danh sách phòng' });
    }
  },

  // ---- Exams ----
  loadExams: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const result = await weeklyEventService.listExams(params);
      set({ exams: result.items, examsTotal: result.total, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false, error: error.response?.data?.error || 'Không thể tải ngân hàng đề' });
    }
  },

  loadExamsByGrade: async (grade) => {
    try {
      return await weeklyEventService.getExamsByGrade(grade);
    } catch {
      return [];
    }
  },

  loadExam: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const exam = await weeklyEventService.getExam(id);
      set({ currentExam: exam, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false, error: error.response?.data?.error || 'Không thể tải đề thi' });
    }
  },

  createExam: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const exam = await weeklyEventService.createExam(input);
      set({ isLoading: false });
      return exam;
    } catch (error: any) {
      set({ isLoading: false, error: error.response?.data?.error || 'Không thể tạo đề thi' });
      throw error;
    }
  },

  updateExam: async (id, input) => {
    set({ isLoading: true, error: null });
    try {
      const exam = await weeklyEventService.updateExam(id, input);
      set({ currentExam: exam, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false, error: error.response?.data?.error || 'Không thể cập nhật đề thi' });
      throw error;
    }
  },

  deleteExam: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await weeklyEventService.deleteExam(id);
      set({ isLoading: false });
    } catch (error: any) {
      set({ isLoading: false, error: error.response?.data?.error || 'Không thể xóa đề thi' });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
