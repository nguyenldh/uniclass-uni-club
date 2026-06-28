// ============================================================
// MatchmakingPage — dùng chung cho mọi game PvP
// ============================================================

import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { GameCanvas, Banner } from "../../design-system/game";
import { MatchmakingOverlay, ExitButton } from "../../components";
import { useUser } from "../../hooks/useUser";
import { mindGameApi } from "../../services/mind-game";
import { quizArenaApi } from "../../services/quiz-arena";
import type { MatchmakingGameType } from "@uniclub/shared";
import { exitWebView } from "../../utils";

const GAME_META: Record<
  string,
  {
    title: string;
    emoji: string;
    searchingTitle: string;
    searchingSubtitle: string;
    foundTitle: string;
  }
> = {
  gomoku: {
    title: "Tìm Đối Thủ",
    emoji: "⚔️",
    searchingTitle: "Đang tìm đối thủ",
    searchingSubtitle: "Hệ thống đang ghép trận Cờ Caro phù hợp với bạn",
    foundTitle: "Đã ghép được trận!",
  },
  card_flip: {
    title: "Tìm Đối Thủ",
    emoji: "🃏",
    searchingTitle: "Đang tìm đối thủ",
    searchingSubtitle: "Hệ thống đang ghép trận Lật Thẻ phù hợp với bạn",
    foundTitle: "Đã ghép được trận!",
  },
  quiz: {
    title: "Tìm Đối Thủ",
    emoji: "🧠",
    searchingTitle: "Đang tìm đối thủ",
    searchingSubtitle: "Hệ thống đang ghép trận So Tài phù hợp với bạn",
    foundTitle: "Đã ghép được trận!",
  },
};

export function MatchmakingPage() {
  const navigate = useNavigate();
  const { gameType } = useParams<{ gameType: string }>();
  const [searchParams] = useSearchParams();
  // Card Flip: chế độ chơi người dùng chọn ở lobby (mặc định 'basic')
  const cardFlipMode = searchParams.get("mode") === "advanced" ? "advanced" : "basic";
  const { user, error: userError } = useUser();

  // Redirect về error page nếu không xác thực được
  useEffect(() => {
    if (userError) {
      navigate("/error", { state: { message: userError }, replace: true });
    }
  }, [userError, navigate]);

  const [checkingSession, setCheckingSession] = useState(true);
  const [matchmakingPhase, setMatchmakingPhase] = useState<'idle' | 'searching' | 'matched' | 'timeout'>('idle');

  const validGameType = (gameType ?? "gomoku") as MatchmakingGameType;
  const meta = GAME_META[validGameType] ?? GAME_META.gomoku;

  const userId = user?.userId ?? "user-1";

  // ---- Check active session khi mount ----
  useEffect(() => {
    let cancelled = false;

    async function checkActiveSession() {
      try {
        // Chọn API theo game type
        const res =
          validGameType === "quiz"
            ? await quizArenaApi.checkActiveSession(userId)
            : await mindGameApi.checkActiveSession(userId);

        if (cancelled) return;

        if (res.hasActiveSession && res.sessionId) {
          // Chỉ reconnect nếu active session cùng gameType với game đang vào
          if (res.gameType === validGameType) {
            if (res.gameType === "gomoku") {
              navigate("/mind-game/gomoku", {
                state: {
                  sessionId: res.sessionId,
                  opponentId: null,
                  playerSymbol: "X", // sẽ được xác định lại từ session
                  isAI: res.isBot ?? false,
                  isReconnect: true,
                },
                replace: true,
              });
            } else if (res.gameType === "card_flip") {
              navigate("/mind-game/card_flip", {
                state: {
                  sessionId: res.sessionId,
                  opponentId: null,
                  isAI: res.isBot ?? false,
                  role: "first",
                  isReconnect: true,
                },
                replace: true,
              });
            } else if (res.gameType === "quiz") {
              navigate("/quiz-arena/game", {
                state: {
                  sessionId: res.sessionId,
                  opponentId: null,
                  isAI: res.isBot ?? false,
                  role: "first",
                  isReconnect: true,
                },
                replace: true,
              });
            }
            return;
          }
          // Active session khác gameType → session cũ đã stale, cho phép vào game mới
        }
      } catch {
        // Ignore error, cho phép user tiếp tục matchmaking
      }
      setCheckingSession(false);
    }

    checkActiveSession();
    return () => {
      cancelled = true;
    };
  }, [userId, validGameType, navigate]);

  const handleEnterGame = (
    sessionId: string,
    opponentId: string | null,
    isAI: boolean,
    role: "first" | "second",
    opponentProfile?: { name: string; avatar?: string },
  ) => {
    if (validGameType === "gomoku") {
      // Map role → symbol: first = X (đi trước), second = O (đi sau)
      const playerSymbol = role === "first" ? "X" : "O";
      navigate("/mind-game/gomoku", {
        state: {
          sessionId,
          opponentId,
          playerSymbol,
          isAI,
          opponentProfile,
        },
      });
    } else if (validGameType === "card_flip") {
      navigate("/mind-game/card_flip", {
        state: {
          sessionId,
          opponentId,
          isAI,
          role,
          opponentProfile,
          mode: cardFlipMode,
        },
      });
    } else if (validGameType === "quiz") {
      navigate("/quiz-arena/game", {
        state: {
          sessionId,
          opponentId,
          isAI,
          role,
          opponentProfile,
        },
      });
    }
  };

  const handleCancel = () => {
    if (validGameType === "quiz") {
      navigate("/quiz-arena");
    } else {
      exitWebView("/mind-game");
    }
  };

  // ---- Đang kiểm tra session ----
  if (checkingSession) {
    return (
      <GameCanvas
        className={"mind-game-page no-top" + " " + matchmakingPhase}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ color: "#fff", fontSize: 18 }}>Kiểm tra trận đấu...</div>
      </GameCanvas>
    );
  }

  return (
    <GameCanvas
      className={"mind-game-page no-top mm-page" + " " + matchmakingPhase}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 24,
      }}
    >
      {(validGameType === "gomoku" || validGameType === "card_flip") && (
        <ExitButton from={`/matchmaking/${validGameType}`} className="mm-exit-btn">
          Thoát
        </ExitButton>
      )}
      <Banner variant="brown">
        <h1>
          {meta.emoji} {meta.title}
        </h1>
      </Banner>

      <MatchmakingOverlay
        userId={userId}
        gameType={validGameType}
        mode={validGameType === "card_flip" ? cardFlipMode : undefined}
        searchingTitle={meta.searchingTitle}
        searchingSubtitle={meta.searchingSubtitle}
        foundTitle={meta.foundTitle}
        onEnterGame={handleEnterGame}
        onCancel={handleCancel}
        onPhaseChange={setMatchmakingPhase}
      />
    </GameCanvas>
  );
}
