import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { WoodPanel, GameButton, GameCanvas } from "../../design-system/game";
import {
  CaroBoard,
  PlayerCard,
  Timer,
  GameStateOverlay,
  type CaroValue,
  type CaroCoord,
  type CaroWinInfo,
  type GameOverlayState,
  type GameOverlayStat,
} from "../../design-system/games";
import { useGomokuStore } from "../../stores/mind-game";
import { mindGameApi } from "../../services/mind-game";
import { useUser, useGomokuSocket } from "../../hooks";
import {
  GomokuAI,
  checkGomokuWin,
  getGomokuWinLine,
  isBoardFull,
  notifyGameEnded,
  type Board,
  type GomokuWinLine,
} from "../../utils";
import { exitWebView } from "../../utils/webview";
import type { AIDifficulty } from "@uniclub/shared";

interface MatchmakingState {
  sessionId: string;
  opponentId: string | null;
  playerSymbol: "X" | "O";
  isAI: boolean;
  opponentProfile?: { name: string; avatar?: string };
}

export function GomokuPage() {
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
    board,
    currentTurn,
    lastMove,
    win,
    winner,
    status,
    moveCount,
    timeElapsed,
    overlayState,
    overlayStats,
    setSession,
    makeMove,
    setWin,
    tick,
    endGame,
  } = useGomokuStore();

  const [difficulty, setDifficulty] = useState<AIDifficulty | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playerSymbol: "X" | "O" = matchmakingResult?.playerSymbol ?? "X";
  const isPvP: boolean = matchmakingResult ? !matchmakingResult.isAI : false;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const processingRef = useRef(false);
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameEndedSentRef = useRef(false);

  /** Phát hiện đường thắng, set win line cho board, delay overlay để người dùng thấy hiệu ứng */
  const handleWin = useCallback(
    (
      boardSnapshot: Board,
      row: number,
      col: number,
      symbol: "X" | "O",
      result: "win" | "lose",
      time: number,
      moves: number,
      score: number,
    ) => {
      const winLine = getGomokuWinLine(boardSnapshot, row, col, symbol);
      if (winLine) {
        setWin({ from: winLine.from, to: winLine.to, cells: winLine.cells });
      }
      // Delay overlay 1.5s để người dùng thấy đường thắng
      overlayTimerRef.current = setTimeout(() => {
        endGame(result, time, moves, score);
      }, 1500);
    },
    [setWin, endGame],
  );

  // Load session from matchmaking result on mount
  useEffect(() => {
    if (!matchmakingResult?.sessionId) return;

    const loadSession = async () => {
      setLoading(true);
      try {
        const res = await mindGameApi.getGomokuSession(
          matchmakingResult.sessionId,
        );
        if (res.session) {
          setSession(res.session);
          if (matchmakingResult.isAI) {
            setDifficulty("medium");
          }

          // If game already finished (e.g. after page reload), show result overlay
          if (res.session.status === "finished") {
            const moves = res.session.moveCount;
            const timeTaken =
              res.session.endedAt && res.session.startedAt
                ? Math.round(
                    (new Date(res.session.endedAt).getTime() -
                      new Date(res.session.startedAt).getTime()) /
                      1000,
                  )
                : moves;
            const won = res.session.winner === userId;
            const score = won ? res.session.config.winPoints : 0;

            // Reconstruct winning line from winningMove so it renders after F5
            if (res.session.winner && res.session.winningMove) {
              const wm = res.session.winningMove;
              const winLine = getGomokuWinLine(
                res.session.board as Board,
                wm.row,
                wm.col,
                wm.symbol,
              );
              if (winLine) {
                setWin({
                  from: winLine.from,
                  to: winLine.to,
                  cells: winLine.cells,
                });
              }
            }

            // Delay overlay to let user see the winning line animation
            overlayTimerRef.current = setTimeout(() => {
              endGame(won ? "win" : "lose", timeTaken, moves, score);
            }, 1500);
          }
        }
      } catch (err: any) {
        setError(err.message || "Không thể tải session");
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, [matchmakingResult?.sessionId]);

  // No matchmaking result — redirect back
  useEffect(() => {
    if (!matchmakingResult) {
      navigate("/matchmaking/gomoku", { replace: true });
    }
  }, [matchmakingResult, navigate]);

  // Socket.IO for real-time moves (PvP & vs AI)
  const { makeMove: emitMove } = useGomokuSocket({
    sessionId: session?.sessionId ?? "",
    userId,
    playerSymbol,
    onOpponentMove: (row, col, symbol) => {
      makeMove(row, col, symbol);
      // Check if opponent's move is a winning move — set win line for animation
      const newBoard = board.map((r) => [...r]) as Board;
      newBoard[row][col] = symbol;
      const winLine = getGomokuWinLine(newBoard, row, col, symbol);
      if (winLine) {
        setWin({ from: winLine.from, to: winLine.to, cells: winLine.cells });
      }
    },
    onGameEnd: (winner, isDraw) => {
      // Delay overlay to let user see the winning line animation
      overlayTimerRef.current = setTimeout(() => {
        if (winner) {
          const won = winner === userId;
          endGame(won ? "win" : "lose", timeElapsed, moveCount, won ? 100 : 0);
        } else {
          endGame("lose", timeElapsed, moveCount, 0);
        }
      }, 1500);
    },
    onOpponentDisconnected: () => {
      setError("Đối thủ đã ngắt kết nối");
    },
  });

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

  // Cleanup overlay timer on unmount
  useEffect(() => {
    return () => {
      if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    };
  }, []);

  // ─── Gửi game:ended khi game kết thúc (overlay hiện ra) ───
  useEffect(() => {
    console.log(overlayState);
    
    if (overlayState === 'idle' || gameEndedSentRef.current) return;
    gameEndedSentRef.current = true;

    const isWin = overlayState === 'win';
    const score = overlayStats.find(s => s.label === 'Điểm');
    const point = score ? parseInt(score.value.replace('+', ''), 10) : 0;

    notifyGameEnded({
      userId,
      gameType: 'mind_game',
      kafkaGameType: 'CARO',
      subGame: 'gomoku',
      sessionId: session?.sessionId,
      point: isWin ? point : 0,
      playTime: timeElapsed,
      sessionCompleted: true,
      isWin,
    });
  }, [overlayState]); // eslint-disable-line react-hooks/exhaustive-deps

  // AI move — computed locally on frontend
  useEffect(() => {
    if (!session || !session.isAI || session.status !== "playing") return;
    if (currentTurn === playerSymbol) return; // Player's turn
    if (processingRef.current) return;

    const aiSymbol = playerSymbol === "X" ? "O" : "X";
    const aiDifficulty = difficulty ?? "hard";

    const aiTimeout = setTimeout(() => {
      if (processingRef.current) return;
      processingRef.current = true;

      try {
        // Compute AI move locally
        const aiMove = GomokuAI.getMove(board as Board, aiSymbol, aiDifficulty);

        if (!aiMove) {
          // No moves left — draw
          endGame("lose", timeElapsed, moveCount, 0);
          processingRef.current = false;
          return;
        }

        // Apply AI move locally
        makeMove(aiMove.row, aiMove.col, aiSymbol);

        // Check win locally
        const newBoard = board.map((r) => [...r]) as Board;
        newBoard[aiMove.row][aiMove.col] = aiSymbol;

        if (checkGomokuWin(newBoard, aiMove.row, aiMove.col, aiSymbol)) {
          handleWin(
            newBoard,
            aiMove.row,
            aiMove.col,
            aiSymbol,
            "lose",
            timeElapsed,
            moveCount + 1,
            0,
          );
          // Notify server via socket (fire-and-forget)
          emitMove(session.sessionId, "AI", aiMove.row, aiMove.col);
          processingRef.current = false;
          return;
        }

        if (isBoardFull(newBoard)) {
          endGame("lose", timeElapsed, moveCount + 1, 0);
          emitMove(session.sessionId, "AI", aiMove.row, aiMove.col);
          processingRef.current = false;
          return;
        }

        // Notify server of AI move via socket (fire-and-forget)
        emitMove(session.sessionId, "AI", aiMove.row, aiMove.col);
      } finally {
        processingRef.current = false;
      }
    }, 400);

    return () => clearTimeout(aiTimeout);
  }, [
    currentTurn,
    session?.sessionId,
    session?.status,
    playerSymbol,
    difficulty,
    board,
    makeMove,
    emitMove,
    handleWin,
    endGame,
    timeElapsed,
    moveCount,
  ]);

  // Handle cell click
  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (processingRef.current || !session) return;
      if (currentTurn !== playerSymbol) return;
      if (board[row]?.[col] !== null) return;

      processingRef.current = true;
      try {
        // Emit move via socket (server will validate & broadcast state)
        emitMove(session.sessionId, userId, row, col);
        makeMove(row, col, playerSymbol);

        // Check win locally for instant feedback / overlay animation
        const newBoard = board.map((r) => [...r]) as Board;
        newBoard[row][col] = playerSymbol;

        if (checkGomokuWin(newBoard, row, col, playerSymbol)) {
          handleWin(
            newBoard,
            row,
            col,
            playerSymbol,
            "win",
            timeElapsed,
            moveCount + 1,
            session.config.winPoints,
          );
        } else if (isBoardFull(newBoard)) {
          endGame("lose", timeElapsed, moveCount + 1, 0);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        processingRef.current = false;
      }
    },
    [
      session,
      currentTurn,
      playerSymbol,
      board,
      makeMove,
      emitMove,
      handleWin,
      endGame,
      timeElapsed,
      moveCount,
      userId,
    ],
  );

  // Loading state (from matchmaking)
  if (loading && matchmakingResult) {
    return (
      <div className="mind-game-page">
        <WoodPanel variant="dark" className="game-setup">
          <h1>♟️ Cờ Caro</h1>
          <p>Đang tải trận đấu...</p>
        </WoodPanel>
      </div>
    );
  }

  // No matchmaking result — show nothing while redirecting
  if (!matchmakingResult) {
    return null;
  }

  const myData =
    playerSymbol === "X" ? session?.playerXData : session?.playerOData;
  const opponentData =
    playerSymbol === "X" ? session?.playerOData : session?.playerXData;

  return (
    <GameCanvas
      className="mind-game-page playing"
    >
      {/* HUD */}
      <div
        className="game-hud"
        style={{ width: "100%", maxWidth: 600 }}
      >
        <PlayerCard
          avatar={myData?.avatar}
          name={`Bạn`}
          mark={playerSymbol}
          score={winner === userId ? 100 : 0}
          active={currentTurn === playerSymbol}
        />
        <Timer seconds={timeElapsed} mode="up" />
        <PlayerCard
          avatar={opponentData?.avatar}
          name={opponentData?.name ?? ""}
          mark={playerSymbol === "X" ? "O" : "X"}
          active={currentTurn !== playerSymbol}
        />
        <GameButton className="exit-in-hud" color="ghost" onClick={() => {
          if (status === 'playing' && !gameEndedSentRef.current) {
            gameEndedSentRef.current = true;
            notifyGameEnded({
              userId,
              gameType: 'mind_game',
              kafkaGameType: 'CARO',
              subGame: 'gomoku',
              sessionId: session?.sessionId,
              point: 0,
              playTime: timeElapsed,
              sessionCompleted: false,
              isWin: false,
            });
          }
          exitWebView('/mind-game/gomoku');
        }}>
          ← Thoát
        </GameButton>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {/* Board */}
      <CaroBoard
        cells={board as CaroValue[][]}
        lastMove={lastMove as CaroCoord | null}
        win={win as CaroWinInfo | null}
        disabled={status !== "playing" || currentTurn !== playerSymbol}
        onCellClick={handleCellClick}
      />

      {/* Overlay */}
      {overlayState !== "idle" && (
        <GameStateOverlay
          state={overlayState as GameOverlayState}
          stats={overlayStats as GameOverlayStat[]}
          actions={
            <>
              <GameButton color="ghost" onClick={() => navigate("/matchmaking/gomoku")}>
                Về lobby
              </GameButton>
            </>
          }
        />
      )}

      <GameButton className="exit-at-bottom" color="ghost" onClick={() => {
        // Gửi forfeit message nếu đang trong trận
        if (status === 'playing' && !gameEndedSentRef.current) {
          gameEndedSentRef.current = true;
          notifyGameEnded({
            userId,
            gameType: 'mind_game',
            kafkaGameType: 'CARO',
            subGame: 'gomoku',
            sessionId: session?.sessionId,
            point: 0,
            playTime: timeElapsed,
            sessionCompleted: false,
            isWin: false,
          });
        }
        exitWebView('/mind-game/gomoku');
      }}>
        ← Thoát
      </GameButton>
    </GameCanvas>
  );
}
