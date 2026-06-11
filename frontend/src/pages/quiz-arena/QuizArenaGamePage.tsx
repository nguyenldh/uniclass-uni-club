// ============================================================
// QuizArenaGamePage — màn chơi chính của So Tài
// Flow: VersusScreen (3s) → join-session → câu hỏi × 10 → kết quả
// ============================================================

import { useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { GameButton, GameCanvas } from "../../design-system/game";
import {
  VersusScreen,
  QuestionCard,
  VersusBar,
  MatchProgress,
  ResultCompare,
  FloatingPoints,
  QuizCallout,
  type AnswerKey,
  type ProgressPip,
} from "../../design-system/sotai";
import { useQuizArenaStore } from "../../stores/quiz-arena";
import { quizArenaApi } from "../../services/quiz-arena";
import { useUser } from "../../hooks/useUser";
import { useQuizArenaSocket } from "../../hooks/useQuizArenaSocket";
import { notifyGameEnded } from "../../utils";
import { exitWebView } from "../../utils/webview";
import type { QuizPlayerAnswer } from "@uniclub/shared";

// ============================================================
// Helpers
// ============================================================

const KEYS: AnswerKey[] = ["A", "B", "C", "D"];
const KEY_TO_IDX: Record<AnswerKey, number> = { A: 0, B: 1, C: 2, D: 3 };

function computePips(
  answers: QuizPlayerAnswer[] | undefined,
  currentIndex: number,
  total: number,
): ProgressPip[] {
  const ans = answers ?? [];
  return Array.from({ length: total }, (_, i): ProgressPip => {
    if (i < ans.length) {
      return ans[i].isCorrect ? "correct" : "wrong";
    }
    if (i === currentIndex) return "current";
    return "pending";
  });
}

// ============================================================
// Navigation state (từ MatchmakingPage)
// ============================================================

interface NavState {
  sessionId: string;
  opponentId: string | null;
  isAI: boolean;
  role: "first" | "second";
}

// ============================================================
// Page
// ============================================================

export function QuizArenaGamePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state as NavState | null;
  const { user, error: userError } = useUser();

  // Redirect về error page nếu không xác thực được
  useEffect(() => {
    if (userError) {
      navigate("/error", { state: { message: userError }, replace: true });
    }
  }, [userError, navigate]);

  const userId = user?.userId ?? "user-1";

  const {
    session,
    currentQuestion,
    phase,
    playerAState,
    playerBState,
    playerAData,
    playerBData,
    myAnswer,
    lastResult,
    gameResult,
    timeElapsed,
    opponentAnswered,
    countdownStartsAt,
    setSession,
    setQuestion,
    selectAnswer,
    setOpponentAnswered,
    setQuestionResult,
    setPlayerStates,
    endGame,
    startCountdown,
    tick,
    reset,
  } = useQuizArenaStore();

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittedRef = useRef(false); // tránh double-submit khi timeout
  const gameEndedSentRef = useRef(false);

  // ─── Handler: thoát giữa trận (forfeit) ───
  const handleForfeit = useCallback(() => {
    exitWebView("/quiz-arena/game");
  }, [userId, session?.sessionId, timeElapsed]);

  // Xác định mình là playerA hay playerB
  const amIPlayerA = session?.playerA === userId;
  const myState = amIPlayerA ? playerAState : playerBState;
  const oppState = amIPlayerA ? playerBState : playerAState;
  const myData = amIPlayerA ? playerAData : playerBData;
  const oppData = amIPlayerA ? playerBData : playerAData;

  // ---- Socket ----
  const { joinSession, submitAnswer } = useQuizArenaSocket({
    sessionId: navState?.sessionId ?? "",
    userId,
    onCountdown: useCallback(
      (startsAt) => startCountdown(startsAt),
      [startCountdown],
    ),
    onQuestion: useCallback(
      (q) => {
        setQuestion(q);
        submittedRef.current = false;
      },
      [setQuestion],
    ),
    onOpponentAnswered: useCallback(
      (_qIdx) => setOpponentAnswered(),
      [setOpponentAnswered],
    ),
    onQuestionResult: useCallback(
      (result) => setQuestionResult(result),
      [setQuestionResult],
    ),
    onStateUpdate: useCallback(
      (pA, pB) => setPlayerStates(pA, pB),
      [setPlayerStates],
    ),
    onGameEnd: useCallback((result) => endGame(result), [endGame]),
    onOpponentDisconnected: useCallback(() => {
      console.warn("[QuizArena] Opponent disconnected");
    }, []),
  });

  // ---- Load session & join immediately ----
  useEffect(() => {
    if (!navState?.sessionId) {
      navigate("/quiz-arena", { replace: true });
      return;
    }

    // Reset đồng bộ ngay đầu effect để đảm bảo không render state cũ
    reset();

    let cancelled = false;
    
    quizArenaApi
      .getSession(navState.sessionId)
      .then((res) => {
        if (cancelled) return;

        setSession(res.session, userId);
        // Join session ngay khi load xong để server biết client đã sẵn sàng
        // (session.status === 'playing' → reconnect, 'waiting' → chờ opponent)
        joinSession();
      })
      .catch(() => {
        if (!cancelled) navigate("/quiz-arena", { replace: true });
      });

    return () => {
      cancelled = true;
      reset();
    };
  }, [navState?.sessionId]); // eslint-disable-line

  // ---- Timer khi đang trả lời ----
  useEffect(() => {
    if (phase === "answering") {
      timerRef.current = setInterval(() => tick(), 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [phase]); // eslint-disable-line

  // ---- Re-sync đồng hồ ngay khi quay lại app (WebView resume / tab hiện lại) ----
  // setInterval bị throttle khi nền → khi visible lại, tick ngay để timeElapsed
  // nhảy về đúng thời gian đã trôi thay vì chờ tới nhịp interval kế tiếp.
  useEffect(() => {
    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        useQuizArenaStore.getState().phase === "answering"
      ) {
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [tick]);

  // ---- Auto-submit khi hết giờ ----
  useEffect(() => {
    if (
      phase === "answering" &&
      currentQuestion &&
      timeElapsed >= currentQuestion.timeLimitSeconds &&
      !submittedRef.current
    ) {
      submittedRef.current = true;
      submitAnswer(null);
      selectAnswer(null);
    }
  }, [timeElapsed]); // eslint-disable-line

  // ---- Handlers ----
  const handleSelect = useCallback(
    (key: AnswerKey) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      const idx = KEY_TO_IDX[key];
      submitAnswer(idx);
      selectAnswer(key);
    },
    [submitAnswer, selectAnswer],
  );

  // ---- Render ----

  if (!session || phase === "idle") {
    return (
      <GameCanvas className="quiz-arena-page no-top">
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "100dvh",
          }}
        >
          <span
            style={{
              color: "#fff",
              fontFamily: "Nunito, sans-serif",
              fontWeight: 700,
            }}
          >
            Đang tải...
          </span>
        </div>
      </GameCanvas>
    );
  }

  // ---- Versus screen ----
  if (phase === "versus") {
    return (
      <VersusScreen
        me={{
          name: myData?.name,
          avatar: myData?.avatar,
          grade: myData?.grade,
        }}
        opponent={{
          name: oppData?.name,
          avatar: oppData?.avatar,
          grade: oppData?.grade,
        }}
        startsAt={countdownStartsAt}
      />
    );
  }

  // ---- Result screen ----
  if (phase === "finished") {
    const result = gameResult;
    if (!result) {
      // Session finished nhưng chưa có result (hiếm) — về lobby
      return null;
    }

    // ─── Gửi game:ended khi result screen hiện ra (1 lần duy nhất) ───
    if (!gameEndedSentRef.current) {
      gameEndedSentRef.current = true;
      const amIWinner = result.winner === userId;
      const mySummary =
        result.playerA.userId === userId ? result.playerA : result.playerB;
      const totalQ = session?.config.questionsPerMatch ?? 10;

      notifyGameEnded({
        userId,
        gameType: 'quiz_arena',
        kafkaGameType: 'SO_TAI',
        sessionId: result.sessionId,
        point: mySummary.uniPointsEarned,
        playTime: Math.round(mySummary.totalCorrectTimeMs / 1000),
        sessionCompleted: true,
        isWin: amIWinner,
        correctCount: mySummary.correctCount,
        totalQuestions: totalQ,
      });
    }
    const amIWinner = result.winner === userId;
    const mySummary =
      result.playerA.userId === userId ? result.playerA : result.playerB;
    const myData =
      session.playerAState.userId === userId
        ? session.playerAData
        : session.playerBData;
    const oppData =
      session.playerAState.userId === userId
        ? session.playerBData
        : session.playerAData;
    const oppSummary =
      result.playerA.userId === userId ? result.playerB : result.playerA;
    const totalQ = session.config.questionsPerMatch;

    return (
      <ResultCompare
        outcome={amIWinner ? "win" : "lose"}
        me={{
          name: myData?.name,
          avatar: myData?.avatar,
          correct: mySummary.correctCount,
          totalScore: mySummary.totalScore,
          correctResponseTime: Math.round(mySummary.totalCorrectTimeMs / 1000),
        }}
        opponent={{
          name: oppData?.name,
          avatar: oppData?.avatar,
          correct: oppSummary.correctCount,
          totalScore: oppSummary.totalScore,
          correctResponseTime: Math.round(oppSummary.totalCorrectTimeMs / 1000),
        }}
        totalQuestions={totalQ}
        uniPointsEarned={mySummary.uniPointsEarned}
        actions={
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              marginTop: 8,
            }}
          >
            <GameButton
              color="ghost"
              size="md"
              onClick={() => exitWebView("/quiz-arena/game")}
            >
              Thoát
            </GameButton>
            <GameButton
              color="orange"
              size="md"
              onClick={() => navigate("/quiz-arena")}
            >
              Chơi tiếp
            </GameButton>
          </div>
        }
      />
    );
  }

  // ---- Active game: answering / waiting / revealing ----
  const qIndex = currentQuestion?.questionIndex ?? 0;
  const totalQ =
    currentQuestion?.totalQuestions ?? session.config.questionsPerMatch;
  const timeLimit = currentQuestion?.timeLimitSeconds ?? 20;

  const meScore = myState?.totalScore ?? 0;
  const oppScore = oppState?.totalScore ?? 0;
  const myDisplayName = myState?.displayName ?? "";
  const oppDisplayName = oppState?.displayName ?? "";

  const mePips = myState ? computePips(myState.answers, qIndex, totalQ) : [];
  const oppPips = oppState ? computePips(oppState.answers, qIndex, totalQ) : [];

  const correctKey: AnswerKey | null =
    phase === "revealing" && lastResult != null
      ? (KEYS[lastResult.correctIndex] ?? null)
      : null;

  const myEarned =
    phase === "revealing" && lastResult
      ? amIPlayerA
        ? lastResult.playerA.earned
        : lastResult.playerB.earned
      : 0;

  const questionPhase =
    phase === "revealing"
      ? "revealing"
      : phase === "waiting"
        ? "waiting"
        : "answering";

  const options = currentQuestion
    ? KEYS.map((k, i) => ({ key: k, label: currentQuestion.options[i] }))
    : [];

  return (
    <GameCanvas
      className="quiz-arena-page no-top"
      style={{ display: "flex", flexDirection: "column" }}
    >
      {/* Nút thoát (X) */}
      <button
        type="button"
        className="exit-button"
        onClick={handleForfeit}
        aria-label="Thoát"
        title="Thoát"
        // top/right do class .exit-button quản lý (đã tôn trọng safe-area); chỉ giữ zIndex để nổi trên HUD
        style={{ zIndex: 100 }}
      >
        ✕
      </button>

      {/* Top scorebar */}
      <VersusBar
        me={{ name: myData?.name, avatar: myData?.avatar, score: meScore }}
        opponent={{
          name: oppData?.name,
          avatar: oppData?.avatar,
          score: oppScore,
        }}
      />

      {/* Progress */}
      <MatchProgress current={qIndex + 1} total={totalQ} mePips={mePips} />

      {/* Question card */}
      {currentQuestion && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            position: "relative",
            padding: "0 16px",
          }}
        >
          <QuestionCard
            index={qIndex + 1}
            total={totalQ}
            question={currentQuestion.content}
            options={options}
            timeLimit={timeLimit}
            timeElapsed={timeElapsed}
            selected={myAnswer}
            correct={correctKey}
            phase={questionPhase}
            opponentAnswered={opponentAnswered}
            onSelect={handleSelect}
          />

          {/* Floating points overlay */}
          {phase === "revealing" && (
            // Điểm của học sinh (me) nằm bên TRÁI thanh VersusBar → điểm cộng cũng float bên trái
            // để học sinh dễ theo dõi (trước đây đặt bên phải, lệch sang phía đối thủ).
            <FloatingPoints
              points={myEarned}
              style={{ position: "absolute", top: 8, left: 24 }}
            />
          )}

          {/* Câu hô ganh đua khi lộ đáp án — đúng thì khen, sai thì khích lệ */}
          {phase === "revealing" && (
            <QuizCallout
              variant={myEarned > 0 ? "win" : "miss"}
              seed={qIndex}
              style={{
                position: "absolute",
                top: -8,
                left: 0,
                right: 0,
                zIndex: 6,
              }}
            />
          )}
        </div>
      )}
    </GameCanvas>
  );
}
