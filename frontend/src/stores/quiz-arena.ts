import { create } from 'zustand';
import type {
  QuizArenaSession,
  QuizQuestionPublic,
  QuizPlayerState,
  QuizArenaResult,
  QuizPlayerSummary,
  AuthUser,
} from '@uniclub/shared';
import type { AnswerKey } from '../design-system/sotai';

// ============================================================
// Types
// ============================================================

export type QuizGamePhase =
  | 'idle'
  | 'versus'
  | 'answering'
  | 'waiting'
  | 'revealing'
  | 'finished'
  | 'no-questions';

export interface QuestionResult {
  questionIndex: number;
  correctIndex: number;
  playerA: { earned: number; responseTimeMs: number | null };
  playerB: { earned: number; responseTimeMs: number | null };
}

// ============================================================
// State
// ============================================================

interface QuizArenaState {
  session: QuizArenaSession | null;
  /** userId của người chơi hiện tại (để xác định playerA/playerB) */
  myUserId: string;
  currentQuestion: QuizQuestionPublic | null;
  phase: QuizGamePhase;
  playerAState: QuizPlayerState | null;
  playerBState: QuizPlayerState | null;
  playerAData: AuthUser | null;
  playerBData: AuthUser | null;
  /** Đáp án đã chọn (AnswerKey A/B/C/D, null = chưa chọn) */
  myAnswer: AnswerKey | null;
  lastResult: QuestionResult | null;
  gameResult: QuizArenaResult | null;
  /** Giây đã trôi trong câu hỏi hiện tại (cho DecayingBar) */
  timeElapsed: number;
  /**
   * Độ lệch đồng hồ client↔server (ms) = serverNow - clientNow, đo 1 lần khi nhận câu hỏi.
   * Dùng để tính thời gian đã trôi mà không phụ thuộc đồng hồ tuyệt đối của thiết bị.
   */
  clockSkewMs: number;
  /** Đối thủ đã gửi đáp án */
  opponentAnswered: boolean;
  /** Countdown timestamp: khi nào game bắt đầu (ms) */
  countdownStartsAt: number | null;

  setSession: (session: QuizArenaSession, myUserId: string) => void;
  setQuestion: (q: QuizQuestionPublic) => void;
  selectAnswer: (key: AnswerKey | null) => void;
  setOpponentAnswered: () => void;
  setQuestionResult: (result: QuestionResult) => void;
  setPlayerStates: (playerA: QuizPlayerState, playerB: QuizPlayerState) => void;
  endGame: (result: QuizArenaResult) => void;
  /** Khối lớp chưa có câu hỏi → chuyển sang màn "không có câu hỏi" */
  setNoQuestions: () => void;
  startCountdown: (startsAt: number) => void;
  tick: () => void;
  reset: () => void;
}

// ============================================================
// Store
// ============================================================

export const useQuizArenaStore = create<QuizArenaState>((set) => ({
  session: null,
  myUserId: '',
  currentQuestion: null,
  phase: 'idle',
  playerAState: null,
  playerBState: null,
  myAnswer: null,
  lastResult: null,
  gameResult: null,
  timeElapsed: 0,
  clockSkewMs: 0,
  opponentAnswered: false,
  countdownStartsAt: null,
  playerAData: null,
  playerBData: null,

  setSession: (session, myUserId) => {
    // Khi session đã kết thúc (ví dụ reload trang), reconstruct gameResult từ dữ liệu session
    let gameResult: QuizArenaResult | null = null;
    if (session.status === 'finished' && session.winner) {
      const uniPts = session.config.uniPointsPerCorrect;
      const loser =
        session.winner === session.playerA ? session.playerB : session.playerA;

      const toSummary = (state: typeof session.playerAState): QuizPlayerSummary => ({
        userId: state.userId,
        displayName: state.displayName,
        totalScore: state.totalScore,
        correctCount: state.correctCount,
        totalCorrectTimeMs: state.totalCorrectTimeMs,
        uniPointsEarned: state.correctCount * uniPts,
        answers: state.answers,
      });

      gameResult = {
        sessionId: session.sessionId,
        winner: session.winner,
        loser,
        isBot: session.isBot,
        playerA: toSummary(session.playerAState),
        playerB: toSummary(session.playerBState),
      };
    }

    // Xác định phase dựa trên trạng thái session
    let phase: QuizGamePhase;
    if (session.questions.length === 0) {
      // Khối lớp chưa có câu hỏi (kể cả khi reload lại session đã kết thúc kiểu này)
      phase = 'no-questions';
    } else if (session.status === 'finished') {
      phase = 'finished';
    } else if (session.status === 'playing') {
      // Reconnect vào giữa trận: chờ server gửi QUESTION, không hiện versus
      phase = 'idle';
    } else {
      // waiting: hiện versus và chờ countdown
      phase = 'versus';
    }   

    set({
      session,
      myUserId,
      phase,
      playerAState: session.playerAState,
      playerBState: session.playerBState,
      currentQuestion: null,
      myAnswer: null,
      lastResult: null,
      gameResult,
      timeElapsed: 0,
      opponentAnswered: false,
      playerAData: session.playerAData ?? null,
      playerBData: session.playerBData ?? null,
    });
  },

  setQuestion: (q) => {
    // Đo độ lệch đồng hồ 1 lần: serverNow là giờ server lúc gửi, so với giờ client lúc nhận.
    // Sau đó "giờ server ước lượng" tại client = Date.now() + clockSkewMs.
    const clockSkewMs = q.serverNow - Date.now();
    const elapsedMs = Date.now() + clockSkewMs - q.startedAt;
    const elapsedSeconds = Math.max(0, Math.floor(elapsedMs / 1000));

    set({
      currentQuestion: q,
      phase: 'answering',
      myAnswer: null,
      lastResult: null,
      clockSkewMs,
      timeElapsed: elapsedSeconds,
      opponentAnswered: false,
    });
  },

  selectAnswer: (key) =>
    set({
      myAnswer: key,
      phase: 'waiting',
    }),

  setOpponentAnswered: () => set({ opponentAnswered: true }),

  setQuestionResult: (result) =>
    set({
      lastResult: result,
      phase: 'revealing',
    }),

  setPlayerStates: (playerA, playerB) =>
    set({ playerAState: playerA, playerBState: playerB }),

  endGame: (result) =>
    set({
      gameResult: result,
      phase: 'finished',
    }),

  setNoQuestions: () => set({ phase: 'no-questions' }),

  startCountdown: (startsAt) =>
    set({
      countdownStartsAt: startsAt,
    }),

  // Tính lại timeElapsed từ mốc startedAt của server, hiệu chỉnh qua clockSkewMs (KHÔNG cộng dồn).
  // Nhờ vậy: (1) nếu setInterval bị throttle khi app xuống nền (WebView/tab ẩn), khi quay lại
  // tick sẽ tự nhảy về đúng thời gian đã trôi; (2) không phụ thuộc đồng hồ tuyệt đối của thiết bị.
  tick: () =>
    set((s) => {
      if (!s.currentQuestion) return {};
      const elapsed = Math.max(
        0,
        Math.floor((Date.now() + s.clockSkewMs - s.currentQuestion.startedAt) / 1000),
      );
      return { timeElapsed: elapsed };
    }),

  reset: () =>
    set({
      session: null,
      myUserId: '',
      currentQuestion: null,
      phase: 'idle',
      playerAState: null,
      playerBState: null,
      myAnswer: null,
      lastResult: null,
      gameResult: null,
      timeElapsed: 0,
      clockSkewMs: 0,
      opponentAnswered: false,
      countdownStartsAt: null,
    }),
}));
