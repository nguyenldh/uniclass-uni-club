// ============================================================
// QuizArenaGamePage — màn chơi chính của So Tài
// Flow: VersusScreen (3s) → join-session → câu hỏi × 10 → kết quả
// ============================================================

import { useEffect, useRef, useCallback, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { GameButton, GameCanvas } from "../../design-system/game";
import { ExitButton } from "../../components";
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
import { useInviteRoom, type InviteRoomStartPayload } from "../../hooks/useInviteRoom";
import { notifyGameEnded } from "../../utils";
import { exitWebView, notifyGuestReward } from "../../utils/webview";
import type { QuizPlayerAnswer } from "@uniclub/shared";

// ============================================================
// Helpers
// ============================================================

const KEYS: AnswerKey[] = ["A", "B", "C", "D"];
const KEY_TO_IDX: Record<AnswerKey, number> = { A: 0, B: 1, C: 2, D: 3 };

/** Thông báo khi phòng mời đóng (hiển thị ở màn kết quả) */
const REMATCH_CLOSE_MESSAGES: Record<string, string> = {
  limit_reached: "Đã hết lượt tái đấu",
  // Guest chỉ rời qua nút "Đổi quà" → thông điệp trung tính
  guest_left: "Đối thủ đã kết thúc trận đấu",
  host_left: "Đối thủ đã rời phòng",
  not_found: "Đối thủ đã rời trận đấu",
  expired: "Phòng đã hết hạn",
};

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
  /** Khối lớp chưa có câu hỏi (đã check ở lobby trước khi ghép trận) → vào thẳng màn no-questions. */
  noQuestions?: boolean;
  /** Trận qua phòng mời (friendly) — mang theo roomId để hỗ trợ tái đấu. */
  isInvite?: boolean;
  roomId?: string;
  /** Số lượt tái đấu còn lại sau ván hiện tại. */
  rematchRemaining?: number;
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
    setNoQuestions,
    startCountdown,
    tick,
    reset,
  } = useQuizArenaStore();

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittedRef = useRef(false); // tránh double-submit khi timeout
  const gameEndedSentRef = useRef(false);

  // ---- Tái đấu (phòng mời) ----
  const isInvite = !!navState?.roomId;
  const isGuest = user?.type === 'guest';
  const rematchRemaining = navState?.rematchRemaining ?? 0;
  const [waitingRematch, setWaitingRematch] = useState(false);
  const [rematchClosed, setRematchClosed] = useState<string | null>(null);

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
    onNoQuestions: useCallback(() => setNoQuestions(), [setNoQuestions]),
  });

  // ---- Phòng mời: giữ kết nối phòng xuyên suốt ván để hỗ trợ Tái đấu ----
  const handleRematchStart = useCallback(
    (p: InviteRoomStartPayload) => {
      navigate("/quiz-arena/game", {
        state: {
          sessionId: p.sessionId,
          opponentId: null,
          isAI: false,
          role: p.role,
          roomId: p.roomId,
          rematchRemaining: p.rematchRemaining,
          isInvite: true,
        },
        replace: true,
      });
    },
    [navigate],
  );

  const invite = useInviteRoom({
    userId,
    displayName: user?.name,
    grade: user?.grade,
    avatar: user?.avatar,
    gameType: "quiz",
    enabled: isInvite,
    onStart: handleRematchStart,
    onClosed: useCallback((reason: string) => setRematchClosed(reason), []),
  });

  // Join lại phòng (reconnect) để socket nằm trong room khi ván kết thúc
  const roomId = navState?.roomId;
  useEffect(() => {
    if (roomId) invite.join(roomId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Reconnect (vd F5) mà phòng đã bị đóng/không còn (đối thủ đã thoát) → join trả
  // lỗi ROOM_NOT_FOUND/ROOM_EXPIRED (không phải event CLOSED). Coi như phòng đã đóng
  // để ẩn nút Tái đấu.
  useEffect(() => {
    const code = invite.error?.code;
    if (code === "ROOM_NOT_FOUND" || code === "ROOM_EXPIRED") {
      setRematchClosed(code === "ROOM_EXPIRED" ? "expired" : "not_found");
    }
  }, [invite.error]);

  // ---- Load session & join immediately ----
  useEffect(() => {
    // Ván mới (kể cả tái đấu) → reset trạng thái chờ tái đấu của ván trước
    setWaitingRematch(false);
    setRematchClosed(null);

    // Khối lớp chưa có câu hỏi (check ở lobby) → hiển thị màn no-questions ngay,
    // không cần session, không ghép trận.
    if (navState?.noQuestions) {
      reset();
      setNoQuestions();
      return;
    }

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

  // ---- No questions screen ----
  // Khối lớp chưa có câu hỏi → hiển thị thông báo thay vì màn kết quả chiến thắng.
  // Đặt TRƯỚC guard "đang tải" vì lúc này session = null (chưa/không ghép trận).
  if (phase === "no-questions") {
    return (
      <GameCanvas className="quiz-arena-page no-top">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: 20,
            minHeight: "100dvh",
            padding: "0 24px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 64, lineHeight: 1 }}>📭</div>
          <div
            style={{
              color: "#fff",
              fontFamily: "var(--f-game, Nunito, sans-serif)",
              fontWeight: 900,
              fontSize: 22,
              textShadow: "0 2px 0 rgba(0,0,0,.25)",
            }}
          >
            Chưa có câu hỏi cho khối này
          </div>
          <div
            style={{
              color: "rgba(255,255,255,.9)",
              fontFamily: "Nunito, sans-serif",
              fontWeight: 600,
              fontSize: 15,
              maxWidth: 420,
            }}
          >
            Hiện chưa có câu hỏi nào cho khối lớp của bạn. Vui lòng quay lại sau
            khi quản trị viên bổ sung câu hỏi.
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
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
              Về sảnh
            </GameButton>
          </div>
        </div>
      </GameCanvas>
    );
  }

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
        type: user?.type ?? 'user',
        roomId: navState?.roomId,
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

    // Đối thủ đã bấm "Tái đấu" (ready) trong phòng chưa — để thông báo cho mình
    const opponentWantsRematch = !!invite.room?.members.find(
      (m) => m.userId !== userId,
    )?.ready;

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
        showReward={!isGuest}
        actions={
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              marginTop: 8,
            }}
          >
            {isInvite &&
              !rematchClosed &&
              rematchRemaining > 0 &&
              opponentWantsRematch &&
              !waitingRematch && (
                <div style={{ color: "#fbbf24", fontWeight: 800 }}>
                  🔥 Đối thủ muốn tái đấu!
                </div>
              )}

            <div
              style={{
                display: "flex",
                gap: 12,
                justifyContent: "center",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              {isGuest ? (
                <GameButton
                  color="green"
                  size="md"
                  className="st-reward-btn"
                  onClick={() => {
                    // Guest Đổi quà = kết thúc trận → rời phòng để host biết đối thủ đã
                    // xong (host hiện thông điệp trung tính, và F5 không còn nút Tái đấu).
                    if (isInvite) invite.leave();
                    notifyGuestReward({
                      profileId: String(user?.profileId ?? userId),
                      name: user?.name,
                      type: "guest",
                      roomId: navState?.roomId,
                      gameType: "quiz_arena",
                      sessionId: result.sessionId,
                      correctCount: mySummary.correctCount,
                      totalQuestions: totalQ,
                      isWin: amIWinner,
                    });
                  }}
                >
                  🎁 Đổi quà
                </GameButton>
              ) : (
                <GameButton
                  color="ghost"
                  size="md"
                  onClick={() => {
                    if (isInvite) invite.leave();
                    navigate("/quiz-arena");
                  }}
                >
                  Về sảnh
                </GameButton>
              )}

              {isInvite ? (
                rematchClosed ? (
                  <div style={{ color: "#fca5a5", fontWeight: 700 }}>
                    {REMATCH_CLOSE_MESSAGES[rematchClosed] ?? "Phòng đã đóng"}
                  </div>
                ) : rematchRemaining > 0 ? (
                  <span className="st-btn-ribbon">
                    <GameButton
                      color="orange"
                      size="md"
                      disabled={waitingRematch}
                      title={`Còn ${rematchRemaining} lượt tái đấu`}
                      onClick={() => {
                        setWaitingRematch(true);
                        invite.setReady(true);
                      }}
                    >
                      {waitingRematch
                        ? "Đang chờ đối thủ…"
                        : opponentWantsRematch
                          ? "Tái đấu ngay"
                          : "Tái đấu"}
                    </GameButton>
                    <span className="st-ribbon">Còn {rematchRemaining} lượt</span>
                  </span>
                ) : (
                  <div style={{ color: "#94a3b8", fontWeight: 700 }}>
                    Đã hết lượt tái đấu
                  </div>
                )
              ) : (
                <GameButton
                  color="orange"
                  size="md"
                  onClick={() => navigate("/quiz-arena", { state: { autoFind: true } })}
                >
                  Chơi tiếp
                </GameButton>
              )}
            </div>
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
      {/* Nút thoát (X) — có modal xác nhận (giống các trang khác) */}
      {/* top/right do class .exit-button quản lý (đã tôn trọng safe-area); chỉ giữ zIndex để nổi trên HUD */}
      <ExitButton
        from="/quiz-arena/game"
        style={{ zIndex: 100 }}
        confirmTitle="Thoát trận đấu?"
        confirmMessage="Bạn đang trong trận. Thoát bây giờ có thể bị xử thua. Bạn có chắc không?"
      />

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
            maxScore={session.config.maxPointsPerQuestion}
            minRatio={session.config.minScoreRetention}
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
