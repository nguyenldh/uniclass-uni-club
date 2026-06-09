import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { GameCanvas, GameButton } from "../../design-system/game";
import {
  CardFlipBoard,
  CardFlipHUD,
  GameStateOverlay,
  type GameOverlayState,
  type GameOverlayStat,
} from "../../design-system/games";
import { useCardFlipStore } from "../../stores/mind-game";
import { mindGameApi } from "../../services/mind-game";
import { useUser, useCardFlipSocket } from "../../hooks";
import type { CardFlipStateData } from "../../hooks/useCardFlipSocket";
import { CardFlipAI, notifyGameEnded } from "../../utils";
import { exitWebView } from "../../utils/webview";

interface MatchmakingState {
  sessionId: string;
  opponentId: string | null;
  isAI: boolean;
  role: "first" | "second";
  opponentProfile?: { name: string; avatar?: string };
}

export function CardFlipPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const matchmakingResult = location.state as MatchmakingState | null;
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
    cards,
    currentTurn,
    scores,
    timeElapsed,
    overlayState,
    overlayStats,
    setSession,
    syncFromServer,
    tick,
    endGame,
  } = useCardFlipStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAI: boolean = matchmakingResult?.isAI ?? false;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const processingRef = useRef(false);
  const aiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameEndedSentRef = useRef(false);
  // Track sessionId hiện tại để tránh bắn game:ended cho game cũ khi store chưa reset
  const activeSessionIdRef = useRef<string | null>(null);

  // Promise resolver để AI đợi socket state update
  const aiStateResolveRef = useRef<((data: CardFlipStateData) => void) | null>(
    null,
  );

  // Refs để tránh stale closure trong socket callbacks
  const sessionIdRef = useRef(session?.sessionId ?? "");
  sessionIdRef.current = session?.sessionId ?? "";

  // Determine player names and roles
  const isPlayerA = session?.playerA === userId;
  const opponentId = isAI
    ? "AI"
    : isPlayerA
      ? (session?.playerB ?? "")
      : (session?.playerA ?? "");
  // Dùng opponentProfile.name nếu có (ẩn danh tính AI)
  const opponentName =
    matchmakingResult?.opponentProfile?.name ??
    (isAI ? opponentId : opponentId);
  const myScore = isPlayerA ? scores.playerA : scores.playerB;
  const opponentScore = isPlayerA ? scores.playerB : scores.playerA;
  const myData = isPlayerA ? session?.playerAData : session?.playerBData;
  const opponentData = isPlayerA ? session?.playerBData : session?.playerAData;

  // Load session from matchmaking result on mount (chỉ dùng REST cho lần đầu)
  useEffect(() => {
    console.log(matchmakingResult);
    if (!matchmakingResult?.sessionId) return;

    const loadSession = async () => {
      setLoading(true);
      try {
        const res = await mindGameApi.getCardFlipSession(
          matchmakingResult.sessionId,
        );
        if (res.session) {
          console.log(res.session);

          CardFlipAI.reset();
          setSession(res.session);
          // Đánh dấu session hiện tại để tránh bắn game:ended cho session cũ
          activeSessionIdRef.current = res.session.sessionId;
          gameEndedSentRef.current = false;

          if (res.session.status === "finished") {
            const elapsed =
              res.session.endedAt && res.session.startedAt
                ? Math.round(
                    (new Date(res.session.endedAt).getTime() -
                      new Date(res.session.startedAt).getTime()) /
                      1000,
                  )
                : 0;
            const myS =
              res.session.playerA === userId
                ? res.session.scores.playerA
                : res.session.scores.playerB;
            const oppS =
              res.session.playerA === userId
                ? res.session.scores.playerB
                : res.session.scores.playerA;
            const won = myS > oppS;
            endGame(won ? "win" : "lose", elapsed, myS, oppS);
          }
        } else {
          navigate("/matchmaking/card_flip", { replace: true });
        }
      } catch (err: any) {
        setError(err.message || "Không thể tải session");
        navigate("/matchmaking/card_flip", { replace: true });
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, [matchmakingResult?.sessionId]);

  // No matchmaking result — redirect back
  useEffect(() => {
    if (!matchmakingResult) {
      navigate("/matchmaking/card_flip", { replace: true });
    }
  }, [matchmakingResult, navigate]);

  // ─── Socket.IO — mọi hành động gameplay qua socket ───
  const { flipCard, resetFlipped } = useCardFlipSocket({
    sessionId: session?.sessionId ?? "",
    userId,
    onStateUpdate: (data: CardFlipStateData) => {
      syncFromServer(data);

      // Tự động reset thẻ sau khi không match — chỉ khi đã lật đủ 2 thẻ
      if (data.isMatch === false && data.lastFlipped.length === 2) {
        const hasFlippedCards = data.cards.some((c) => c.flipped && !c.matched);
        if (hasFlippedCards) {
          const sid = sessionIdRef.current;
          if (sid) {
            setTimeout(() => {
              resetFlipped(sid);
            }, 800);
          }
        }
      }

      // Giải phóng lock — server là nguồn truth cho state
      processingRef.current = false;

      // Resolve AI promise nếu đang đợi
      if (aiStateResolveRef.current) {
        aiStateResolveRef.current(data);
        aiStateResolveRef.current = null;
      }
    },
    onGameEnd: (winner, _isDraw) => {
      const result = !winner ? "draw" : winner === userId ? "win" : "lose";
      endGame(result, timeElapsed, myScore, opponentScore);
    },
  });

  // Preload card images to avoid delay/blank cards when flipped
  useEffect(() => {
    cards.forEach((card) => {
      if (card.type === "image" && typeof card.content === "string") {
        const img = new Image();
        img.src = card.content;
      }
    });
  }, [cards]);

  // Timer
  useEffect(() => {
    if (!session || session.status !== "playing") {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => tick(), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session?.sessionId, session?.status, tick]);

  // Cleanup AI timeout on unmount + gửi forfeit nếu user rời trang giữa trận
  useEffect(() => {
    return () => {
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
      // Nếu vẫn đang chơi mà component unmount (browser back, v.v.) → gửi forfeit
      if (session?.status === "playing" && !gameEndedSentRef.current) {
        gameEndedSentRef.current = true;
        notifyGameEnded({
          userId,
          gameType: "mind_game",
          kafkaGameType: "LAT_MANH_GHEP",
          subGame: "card_flip",
          sessionId: session?.sessionId,
          point: 0,
          playTime: timeElapsed,
          sessionCompleted: false,
          isWin: false,
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Handler: gửi game:ended khi user bỏ cuộc giữa chừng ───
  const handleForfeit = useCallback(() => {
    if (session?.status === "playing" && !gameEndedSentRef.current) {
      gameEndedSentRef.current = true;
      notifyGameEnded({
        userId,
        gameType: "mind_game",
        kafkaGameType: "LAT_MANH_GHEP",
        subGame: "card_flip",
        sessionId: session?.sessionId,
        point: 0,
        playTime: timeElapsed,
        sessionCompleted: false,
        isWin: false,
      });
    }
    exitWebView("/mind-game/card_flip");
  }, [session?.status, session?.sessionId, userId, timeElapsed]);

  // ─── Gửi game:ended khi game kết thúc (overlay hiện ra) ───
  // PHẢI depend vào overlayStats để đảm bảo đọc được giá trị mới nhất.
  // QUAN TRỌNG: Khi user chơi game mới, Zustand store vẫn giữ state cũ (overlayState='win')
  // cho đến khi setSession() chạy. Effect này sẽ trigger với state cũ → bắn game:ended sai.
  // Fix: Chỉ gửi khi sessionId khớp với session hiện tại (activeSessionIdRef).
  useEffect(() => {
    if (overlayState === "idle" || gameEndedSentRef.current) return;
    // Guard: overlayStats phải có data mới gửi (tránh race condition)
    if (overlayStats.length === 0) return;
    // Guard: chỉ gửi cho session hiện tại, không phải session cũ còn sót trong store
    if (!session?.sessionId || session.sessionId !== activeSessionIdRef.current)
      return;

    gameEndedSentRef.current = true;

    const isWin = overlayState === "win";

    notifyGameEnded({
      userId,
      gameType: "mind_game",
      kafkaGameType: "LAT_MANH_GHEP",
      subGame: "card_flip",
      sessionId: session.sessionId,
      point: isWin ? (session?.config?.winPoints ?? 0) : 0,
      playTime: timeElapsed,
      sessionCompleted: true,
      isWin,
      durationSeconds: timeElapsed,
      consecutivePairs: isPlayerA
        ? session?.maxConsecutivePairsA
        : session?.maxConsecutivePairsB,
    });
  }, [overlayState, overlayStats]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── AI move (tính toán trên client, gửi qua socket) ───
  useEffect(() => {
    if (!session || !session.isAI || session.status !== "playing") return;
    if (currentTurn !== "AI") return;
    if (processingRef.current) return;

    // Kiểm tra nếu còn thẻ đang revealed (chưa reset) — đợi reset xong trước
    const hasUnresetCards = cards.some((c) => c.state === "revealed");
    if (hasUnresetCards) {
      // Không bắt đầu AI move — đợi state update từ resetFlipped
      return;
    }

    const runAIMove = async () => {
      if (processingRef.current) return;
      processingRef.current = true;

      try {
        // Dùng cards từ store (đã được sync qua socket) — không cần fetch lại
        const aiMove = CardFlipAI.getMove(
          cards.map((c) => ({
            id: Number(c.id),
            pairId: Number(c.pairId),
            value: String(c.content ?? ""),
            flipped: c.state === "revealed" || c.state === "matched",
            matched: c.state === "matched",
          })),
        );

        if (!aiMove || aiMove.length < 2) {
          processingRef.current = false;
          return;
        }

        const [cardId1, cardId2] = aiMove;

        // Flip thẻ 1 qua socket
        flipCard(session.sessionId, "AI", cardId1);
        await new Promise<void>((resolve) => {
          aiStateResolveRef.current = () => resolve();
        });

        // Ghi nhớ thẻ 1
        const c1 = cards.find((c) => c.id === String(cardId1));
        if (c1) CardFlipAI.remember(cardId1, String(c1.content ?? ""));

        // Delay nhỏ giữa 2 lần lật
        await new Promise((r) => setTimeout(r, 600));

        // Flip thẻ 2 qua socket
        flipCard(session.sessionId, "AI", cardId2);
        const stateData = await new Promise<CardFlipStateData>((resolve) => {
          aiStateResolveRef.current = resolve;
        });

        // Ghi nhớ thẻ 2
        const c2 = cards.find((c) => c.id === String(cardId2));
        if (c2) CardFlipAI.remember(cardId2, String(c2.content ?? ""));

        if (!stateData.isMatch) {
          // Không match — đợi reset (được trigger bởi onStateUpdate)
          await new Promise<void>((resolve) => {
            aiStateResolveRef.current = () => resolve();
          });
        }
        // Nếu match: state đã được sync, AI giữ lượt → effect sẽ chạy lại
      } catch (err: any) {
        console.error("AI move error:", err);
      } finally {
        processingRef.current = false;
      }
    };

    const aiTimeout = setTimeout(runAIMove, 800);
    aiTimeoutRef.current = aiTimeout;
    return () => clearTimeout(aiTimeout);
  }, [
    currentTurn,
    session?.sessionId,
    session?.status,
    cards,
    flipCard,
    resetFlipped,
  ]);

  // ─── Handle card click (người chơi) ───
  const handleCardClick = useCallback(
    (cardId: string) => {
      if (processingRef.current || !session) return;
      if (currentTurn !== userId) return;

      // Lock ngay lập tức — chỉ mở lại khi nhận state từ server (onStateUpdate)
      processingRef.current = true;

      // Gửi flip qua socket — state sẽ về qua onStateUpdate
      flipCard(session.sessionId, userId, Number(cardId));

      // AI học từ nước đi của người chơi
      const clickedCard = cards.find((c) => c.id === cardId);
      if (clickedCard)
        CardFlipAI.remember(Number(cardId), String(clickedCard.content ?? ""));
    },
    [session, currentTurn, userId, cards, flipCard],
  );

  // Loading state
  if (loading && matchmakingResult) {
    return (
      <div className="mind-game-page">
        <div style={{ textAlign: "center", padding: 40 }}>
          <h1>🃏 Lật Thẻ</h1>
          <p>Đang tải trận đấu...</p>
        </div>
      </div>
    );
  }

  // No matchmaking result — show nothing while redirecting
  if (!matchmakingResult) {
    return null;
  }

  return (
    <GameCanvas className="mind-game-page">
      {/* HUD */}
      <CardFlipHUD
        playerAName="Bạn"
        playerAScore={myScore}
        playerAAvatar={myData?.avatar}
        playerBName={opponentName}
        playerBScore={opponentScore}
        playerBAvatar={opponentData?.avatar}
        currentTurn={currentTurn}
        myUserId={userId}
        timeElapsed={timeElapsed}
      >
        <GameButton
          className="exit-in-hud"
          color="ghost"
          onClick={handleForfeit}
        >
          ← Thoát
        </GameButton>
      </CardFlipHUD>

      {error && <div className="error-msg">{error}</div>}

      {/* Board */}
      <CardFlipBoard
        cards={cards}
        disabled={
          session?.status !== "playing" ||
          currentTurn !== userId ||
          processingRef.current
        }
        onCardClick={handleCardClick}
      />

      {/* Overlay */}
      {overlayState !== "idle" && (
        <GameStateOverlay
          state={overlayState as GameOverlayState}
          stats={overlayStats as GameOverlayStat[]}
          actions={
            <>
              <GameButton
                color="ghost"
                onClick={() => navigate("/matchmaking/card_flip")}
              >
                Về lobby
              </GameButton>
            </>
          }
        />
      )}

      <GameButton
        className="exit-at-bottom"
        color="ghost"
        onClick={handleForfeit}
      >
        ← Thoát
      </GameButton>
    </GameCanvas>
  );
}
