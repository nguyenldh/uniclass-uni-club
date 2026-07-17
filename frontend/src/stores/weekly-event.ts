import { create } from 'zustand';
import type {
  WeeklyEvent,
  ExamQuestionPublic,
  LeaderboardEntry,
  PersonalResultPayload,
  SystemErrorPayload,
  SessionResumePayload,
  WeeklyEventRoomStatus,
} from '@uniclub/shared';
import type { ConnState, EntryStatus } from '../design-system/weeklyevent';

export type WeeklyEventPhase =
  | 'entry'
  | 'waiting'
  | 'exam'
  | 'loading'
  | 'leaderboard'
  | 'closed';

interface WeeklyEventState {
  phase: WeeklyEventPhase;
  event: WeeklyEvent | null;
  entryStatus: EntryStatus;
  nextEventAt: string | null;
  roomId: string | null;
  socketToken: string | null;
  questions: ExamQuestionPublic[];
  currentQuestionIdx: number;
  answers: Record<string, { key: string | null; saved: boolean }>;
  answeredCount: number;
  locked: boolean;
  skewMs: number;
  examStartedAt: number | null;
  examEndAt: number | null;
  connState: ConnState;
  offlineBuffer: { questionId: string; key: string }[];
  onlineCount: number;
  leaderboard: LeaderboardEntry[];
  personalResult: PersonalResultPayload | null;
  cancelReason: string | null;
  resumeInfo: { remainingMin?: number; restoredCount?: number } | null;
  systemError: SystemErrorPayload | null;
  terminated: boolean;
  lastEvent: { _id: string; title: string } | null;

  // Actions
  setPhase: (phase: WeeklyEventPhase) => void;
  setEvent: (
    event: WeeklyEvent | null,
    entryStatus: EntryStatus,
    nextEventAt?: string | null,
    lastEvent?: { _id: string; title: string } | null
  ) => void;
  setQuestions: (
    questions: ExamQuestionPublic[],
    examStartedAt: string | number,
    examEndAt: string | number
  ) => void;
  selectAnswer: (questionId: string, key: string) => void;
  ackAnswer: (questionId: string, answeredCount: number) => void;
  setSkew: (serverTime: number, clientSentAt: number) => void;
  setConnState: (connState: ConnState) => void;
  pushOfflineBuffer: (questionId: string, key: string) => void;
  clearOfflineBuffer: () => void;
  setOnlineCount: (count: number) => void;
  setLeaderboard: (leaderboard: LeaderboardEntry[]) => void;
  setPersonalResult: (personalResult: PersonalResultPayload | null) => void;
  setCancelReason: (reason: string | null) => void;
  setResumeInfo: (
    resumeInfo: { remainingMin?: number; restoredCount?: number } | null
  ) => void;
  setSystemError: (error: SystemErrorPayload | null) => void;
  setTerminated: (terminated: boolean) => void;
  applyResume: (payload: SessionResumePayload) => void;
  updateTimer: () => {
    questionRemainingSec: number;
    perQuestionSec: number;
    totalRemainingSec: number;
    currentQuestionIdx: number;
    isFinished: boolean;
  };
  reset: () => void;
}

const initialState = {
  phase: 'entry' as WeeklyEventPhase,
  event: null,
  entryStatus: 'closed' as EntryStatus,
  nextEventAt: null,
  roomId: null,
  socketToken: null,
  questions: [],
  currentQuestionIdx: 0,
  answers: {},
  answeredCount: 0,
  locked: false,
  skewMs: 0,
  examStartedAt: null,
  examEndAt: null,
  connState: 'connected' as ConnState,
  offlineBuffer: [],
  onlineCount: 0,
  leaderboard: [],
  personalResult: null,
  cancelReason: null,
  resumeInfo: null,
  systemError: null,
  terminated: false,
  lastEvent: null,
};

export const useWeeklyEventStore = create<WeeklyEventState>((set, get) => ({
  ...initialState,

  setPhase: (phase) => set({ phase }),

  setEvent: (event, entryStatus, nextEventAt = null, lastEvent = null) =>
    set({ event, entryStatus, nextEventAt, lastEvent }),

  setQuestions: (questions, examStartedAt, examEndAt) => {
    const startMs = typeof examStartedAt === 'string' ? new Date(examStartedAt).getTime() : examStartedAt;
    const endMs = typeof examEndAt === 'string' ? new Date(examEndAt).getTime() : examEndAt;
    
    // Initialize answers object for each question if not already present
    const answers: Record<string, { key: string | null; saved: boolean }> = { ...get().answers };
    questions.forEach((q) => {
      if (!answers[q.questionId]) {
        answers[q.questionId] = { key: null, saved: false };
      }
    });

    set({
      questions,
      examStartedAt: startMs,
      examEndAt: endMs,
      answers,
    });
  },

  selectAnswer: (questionId, key) =>
    set((state) => {
      const existing = state.answers[questionId];
      const answeredCount =
        !existing || existing.key === null
          ? state.answeredCount + 1
          : state.answeredCount;

      const newAnswers = {
        ...state.answers,
        [questionId]: { key, saved: false },
      };

      return {
        answers: newAnswers,
        answeredCount,
      };
    }),

  ackAnswer: (questionId, answeredCount) =>
    set((state) => {
      const existing = state.answers[questionId];
      const newAnswers = {
        ...state.answers,
        [questionId]: {
          key: existing ? existing.key : null,
          saved: true,
        },
      };

      return {
        answers: newAnswers,
        // Server đã xác nhận → gỡ đáp án này khỏi offline buffer (nếu có)
        offlineBuffer: state.offlineBuffer.filter((b) => b.questionId !== questionId),
        // Sync answered count with server ack value to be safe
        answeredCount: Math.max(state.answeredCount, answeredCount),
      };
    }),

  setSkew: (serverTime, clientSentAt) => {
    const rtt = Date.now() - clientSentAt;
    const skewMs = serverTime - (clientSentAt + rtt / 2);
    set({ skewMs });
  },

  setConnState: (connState) => set({ connState }),

  pushOfflineBuffer: (questionId, key) =>
    set((state) => ({
      // Mỗi câu chỉ giữ ĐÁP ÁN MỚI NHẤT (đổi đáp án khi offline → ghi đè, không gửi lại bản cũ)
      offlineBuffer: [
        ...state.offlineBuffer.filter((b) => b.questionId !== questionId),
        { questionId, key },
      ],
    })),

  clearOfflineBuffer: () => set({ offlineBuffer: [] }),

  setOnlineCount: (onlineCount) => set({ onlineCount }),

  setLeaderboard: (leaderboard) => set({ leaderboard }),

  setPersonalResult: (personalResult) => set({ personalResult }),

  setCancelReason: (cancelReason) => set({ cancelReason }),

  setResumeInfo: (resumeInfo) => set({ resumeInfo }),

  setSystemError: (systemError) => set({ systemError }),

  setTerminated: (terminated) => set({ terminated }),

  applyResume: (payload) => {
    set((state) => {
      // Map payload answers to store answers format
      const answers: Record<string, { key: string | null; saved: boolean }> = { ...state.answers };
      let answeredCount = 0;
      if (payload.answers) {
        Object.entries(payload.answers).forEach(([qId, ans]) => {
          answers[qId] = { key: ans.key, saved: true };
          answeredCount++;
        });
      }

      // If payload contains questions, update them too
      const questions = payload.questions || state.questions;
      
      // Calculate start and end times if we can, otherwise we rely on remainingMs
      // remainingMs is what server sends. Let's calculate examEndAt based on server skew
      const serverNow = Date.now() + state.skewMs;
      const examEndAt = serverNow + payload.remainingMs;
      // If we don't know examStartedAt, estimate it from questions and remainingMs
      let examStartedAt = state.examStartedAt;
      if (!examStartedAt && questions.length) {
        // Assume default exam duration or reconstruct from remainingMs if we don't have it
        // A standard exam is 20 minutes (1200000 ms)
        const totalDuration = state.event?.examDuration ? state.event.examDuration * 60 * 1000 : 20 * 60 * 1000;
        examStartedAt = examEndAt - totalDuration;
      }

      return {
        answers,
        answeredCount,
        currentQuestionIdx: payload.currentQuestionIdx,
        questions,
        examEndAt,
        examStartedAt,
      };
    });
  },

  updateTimer: () => {
    const { examStartedAt, examEndAt, skewMs, questions, phase } = get();
    
    const defaultTimerVal = {
      questionRemainingSec: 0,
      perQuestionSec: 0,
      totalRemainingSec: 0,
      currentQuestionIdx: 0,
      isFinished: false,
    };

    if (!examStartedAt || !examEndAt || !questions.length) {
      return defaultTimerVal;
    }

    const serverNow = Date.now() + skewMs;
    const totalRemainingSec = Math.max(0, Math.ceil((examEndAt - serverNow) / 1000));
    
    if (totalRemainingSec <= 0) {
      return {
        ...defaultTimerVal,
        isFinished: true,
      };
    }

    const totalDurationSec = (examEndAt - examStartedAt) / 1000;
    const perQuestionSec = totalDurationSec / questions.length;
    const elapsedSec = Math.max(0, (serverNow - examStartedAt) / 1000);
    
    const currentQuestionIdx = Math.min(
      questions.length - 1,
      Math.floor(elapsedSec / perQuestionSec)
    );

    const elapsedSecInQuestion = elapsedSec - currentQuestionIdx * perQuestionSec;
    const questionRemainingSec = Math.max(0, perQuestionSec - elapsedSecInQuestion);

    // Only update index if changed
    if (get().currentQuestionIdx !== currentQuestionIdx) {
      set({ currentQuestionIdx });
    }

    return {
      questionRemainingSec,
      perQuestionSec,
      totalRemainingSec,
      currentQuestionIdx,
      isFinished: false,
    };
  },

  reset: () => set(initialState),
}));
