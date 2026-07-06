// ============================================================
// Boss Battle (Săn Boss) — Zustand Store
// ============================================================

import { create } from 'zustand';
import type {
  BossLobbyResponse,
  BossBattleStartResponse,
  BossAnswerResponse,
  BossDailyResultResponse,
  BossLeaderboardResponse,
  WeeklyHonor,
  BossQuestionPublic,
} from '@uniclub/shared';
import type { QuestionPip } from '../design-system/bossbattle/battle';
import { bossBattleApi } from '../services/boss-battle';

// ============================================================
// Types
// ============================================================

export type BossBattlePhase =
  | 'lobby'
  | 'battle'
  | 'answering'
  | 'revealing'
  | 'result'
  | 'leaderboard'
  | 'honor';

// ============================================================
// State
// ============================================================

interface BossBattleState {
  // ---- Lobby ----
  lobby: BossLobbyResponse | null;

  // ---- Battle ----
  questions: BossQuestionPublic[];
  currentQuestionIndex: number;
  attemptId: string | null;
  phase: BossBattlePhase;
  selectedAnswer: number | null;
  lastAnswerResponse: BossAnswerResponse | null;
  pips: QuestionPip[];
  timeRemaining: number;
  /** HP Boss (%) — dùng cho sảnh & màn kết quả. KHÔNG mô phỏng trong lúc chơi. */
  bossHpPercent: number;
  /** progressPercent (0–100, có lẻ) lấy từ server. */
  bossProgressPercent: number;
  /** Tổng HP (điểm) người chơi đã đánh trong lượt hiện tại — chỉ để hiển thị,
   *  KHÔNG trừ trực tiếp vào thanh máu Boss (tránh lệch số liệu + tốn hiệu năng đồng bộ). */
  damageDealtThisTurn: number;
  /** Ảnh boss state hiện tại (từ API/socket), ưu tiên hơn bossStateFor */
  currentBossStateImg: string | null;
  /** Tên Boss */
  bossName: string;

  // ---- Result ----
  dailyResult: BossDailyResultResponse | null;

  // ---- Leaderboard ----
  leaderboard: BossLeaderboardResponse | null;

  // ---- Honor ----
  honors: WeeklyHonor[] | null;

  // ---- Common ----
  error: string | null;
  loading: boolean;

  // ---- Actions ----
  loadLobby: (grade: number) => Promise<void>;
  startBattle: (grade: number) => Promise<void>;
  selectAnswer: (index: number | null) => void;
  applyAnswerResponse: (res: BossAnswerResponse) => void;
  nextQuestion: () => void;
  completeAttempt: (attemptId: string) => Promise<void>;
  loadLeaderboard: (weekKey: string, grade: number) => Promise<void>;
  loadHonors: (grade: number) => Promise<void>;
  updateBossDefeated: () => void;
  tick: () => void;
  setPhase: (phase: BossBattlePhase) => void;
  reset: () => void;
}

// ============================================================
// Initial state
// ============================================================

const initialState = {
  lobby: null,
  questions: [],
  currentQuestionIndex: 0,
  attemptId: null,
  phase: 'lobby' as BossBattlePhase,
  selectedAnswer: null,
  lastAnswerResponse: null,
  pips: [] as QuestionPip[],
  timeRemaining: 60,
  bossHpPercent: 100,
  bossProgressPercent: 0,
  damageDealtThisTurn: 0,
  currentBossStateImg: null as string | null,
  bossName: 'Hắc Long Tri Thức',
  dailyResult: null,
  leaderboard: null,
  honors: null,
  error: null,
  loading: false,
};

// ============================================================
// Store
// ============================================================

export const useBossBattleStore = create<BossBattleState>((set, get) => ({
  ...initialState,

  /** FLW-03: Load lobby data */
  loadLobby: async (grade) => {
    set({ loading: true, error: null });
    try {
      const data = await bossBattleApi.getLobby(grade);
      const hpPercent = data.hasBoss && data.boss
        ? Math.max(0, 100 - data.boss.progressPercent)
        : 100;
      const name = data.hasBoss && data.boss
        ? data.boss.config.bossName
        : 'Hắc Long Tri Thức';

      set({
        lobby: data,
        bossHpPercent: hpPercent,
        bossProgressPercent: data.hasBoss && data.boss ? data.boss.progressPercent : 0,
        currentBossStateImg: data.hasBoss && data.boss ? data.boss.currentBossStateImg : null,
        bossName: name,
        phase: 'lobby',
        loading: false,
      });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  /** FLW-04: Start or resume battle */
  startBattle: async (grade) => {
    set({ loading: true, error: null });
    try {
      const data = await bossBattleApi.startBattle(grade);
      const total = data.questions.length;
      // Dùng currentQuestionIndex từ server (quan trọng khi resume sau reload)
      const currentIdx = data.currentQuestionIndex ?? 0;

      // Init pips: tất cả pending, trừ những câu đã làm (nếu resume)
      const pips: QuestionPip[] = Array.from({ length: total }, (_, i) =>
        i < currentIdx ? 'correct' : i === currentIdx ? 'current' : 'pending',
      );

      set({
        questions: data.questions,
        currentQuestionIndex: currentIdx,
        attemptId: data.attemptId,
        phase: 'battle',
        selectedAnswer: null,
        lastAnswerResponse: null,
        pips,
        timeRemaining: data.questions[currentIdx]?.tMaxSec ?? 60,
        damageDealtThisTurn: 0,
        loading: false,
      });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  /** User chọn đáp án → chuyển sang answering (đợi API) */
  selectAnswer: (index) => {
    set({
      selectedAnswer: index,
      phase: 'answering',
    });
  },

  /** FLW-05: Nhận kết quả từ submitAnswer */
  applyAnswerResponse: (res) => {
    const { pips, currentQuestionIndex, damageDealtThisTurn } = get();
    const newPips = [...pips];
    newPips[currentQuestionIndex] = res.isCorrect ? 'correct' : 'wrong';

    const patch: Partial<BossBattleState> = {
      lastAnswerResponse: res,
      pips: newPips,
      phase: 'revealing',
    };

    // KHÔNG mô phỏng trừ máu Boss trong lúc chơi. Chỉ cộng dồn HP (điểm) đã đánh để hiển thị.
    // Máu thật của Boss được server chốt ở finalizeAttempt và hiển thị ở màn kết quả.
    if (res.isCorrect && res.pointsAwarded > 0) {
      patch.damageDealtThisTurn = damageDealtThisTurn + res.pointsAwarded;
    }

    set(patch);
  },

  /** Chuyển sang câu tiếp theo */
  nextQuestion: () => {
    const { currentQuestionIndex, questions } = get();
    const nextIdx = currentQuestionIndex + 1;
    const newPips = [...get().pips];
    if (nextIdx < questions.length) {
      newPips[nextIdx] = 'current';
    }

    set({
      currentQuestionIndex: nextIdx,
      selectedAnswer: null,
      lastAnswerResponse: null,
      pips: newPips,
      timeRemaining: questions[nextIdx]?.tMaxSec ?? 60,
      phase: 'battle',
    });
  },

  /** FLW-06: Hoàn thành lượt → lấy kết quả tổng */
  completeAttempt: async (attemptId) => {
    set({ loading: true, error: null });
    try {
      const data = await bossBattleApi.getAttemptResult(attemptId);
      set({
        dailyResult: data,
        phase: 'result',
        loading: false,
      });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  /** Load bảng xếp hạng */
  loadLeaderboard: async (weekKey, grade) => {
    set({ loading: true, error: null });
    try {
      const data = await bossBattleApi.getLeaderboard(weekKey, grade);
      set({ leaderboard: data, phase: 'leaderboard', loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  /** Load vinh danh */
  loadHonors: async (grade) => {
    set({ loading: true, error: null });
    try {
      const data = await bossBattleApi.getCurrentHonors(grade);
      set({ honors: data.honors, phase: 'honor', loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  /** Socket: Boss bị hạ → cập nhật lobby */
  updateBossDefeated: () => {
    const { lobby } = get();
    if (lobby?.boss) {
      set({
        lobby: {
          ...lobby,
          boss: { ...lobby.boss, status: 'DEFEATED' as const },
        },
        bossHpPercent: 0,
        bossProgressPercent: 100,
      });
    }
  },

  /** Per-question timer tick */
  tick: () => {
    set((s) => ({ timeRemaining: Math.max(0, s.timeRemaining - 1) }));
  },

  setPhase: (phase) => set({ phase }),

  reset: () => set({ ...initialState }),
}));
