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
    lastScore,
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
  // Vùng cuộn ngang của bảng — dùng để mặc định scroll ra giữa khi vào trận
  const boardScrollRef = useRef<HTMLDivElement>(null);
  const gameEndedSentRef = useRef(false);
  // Track sessionId hiện tại để tránh bắn game:ended cho game cũ khi store chưa reset
  const activeSessionIdRef = useRef<string | null>(null);
  // Guard: ngăn GOMOKU_END từ server ghi đè kết quả đã xác định local (tránh race condition)
  const gameEndedLocallyRef = useRef(false);

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
      // Đánh dấu game đã kết thúc local, ngăn GOMOKU_END từ server ghi đè
      gameEndedLocallyRef.current = true;
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
          setSession(res.session, res.serverNow);
          // Đánh dấu session hiện tại để tránh bắn game:ended cho session cũ
          activeSessionIdRef.current = res.session.sessionId;
          gameEndedSentRef.current = false;          gameEndedLocallyRef.current = false;          if (matchmakingResult.isAI) {
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
      // Nếu game đã kết thúc local, bỏ qua move từ server
      if (gameEndedLocallyRef.current) return;
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
      // Nếu game đã kết thúc local (player thắng trước), bỏ qua GOMOKU_END từ server
      if (gameEndedLocallyRef.current) return;
      // Delay overlay to let user see the winning line animation
      overlayTimerRef.current = setTimeout(() => {
        if (winner) {
          const won = winner === userId;
          const winPoints = session?.config?.winPoints ?? 100;
          endGame(won ? "win" : "lose", timeElapsed, moveCount, won ? winPoints : 0);
        } else {
          endGame("lose", timeElapsed, moveCount, 0);
        }
      }, 1500);
    },
    onOpponentDisconnected: () => {
      setError("Đối thủ đã ngắt kết nối");
    },
  });

  // Mặc định cuộn bảng ra GIỮA khi vào trận: phần trung tâm bảng nằm giữa màn hình,
  // ô dư thừa chia đều sang hai bên. Chỉ có tác dụng khi bảng tràn khỏi vùng nhìn.
  // PHẢI phụ thuộc `loading`: khi đang tải, board chưa render nên ref null; effect cần
  // chạy lại đúng lúc loading=false (board đã gắn vào DOM). Double rAF để layout xong.
  useEffect(() => {
    if (loading) return;
    const el = boardScrollRef.current;
    if (!el || !session) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [loading, session?.sessionId, board.length]);

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

  // Re-sync đồng hồ ngay khi quay lại app (WebView resume / tab hiện lại):
  // setInterval bị throttle khi nền → khi visible lại, tick ngay để nhảy về đúng thời gian.
  useEffect(() => {
    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        useGomokuStore.getState().session?.status === "playing"
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

  // Cleanup overlay timer on unmount + gửi forfeit nếu user rời trang giữa trận
  // PHẢI dùng empty deps [] để chỉ chạy khi component thực sự unmount,
  // không phải khi deps thay đổi (status đổi playing→finished sẽ clear timer → overlay không hiện)
  useEffect(() => {
    return () => {
      if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
      // Nếu vẫn đang chơi mà component unmount (browser back, v.v.) → gửi forfeit
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Handler: gửi game:ended khi user bỏ cuộc giữa chừng ───
  const handleForfeit = useCallback(() => {
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
  }, [status, userId, session?.sessionId, timeElapsed]);

  // ─── Gửi game:ended khi game kết thúc (overlay hiện ra) ───
  // PHẢI depend vào overlayStats để đảm bảo đọc được giá trị mới nhất.
  // endGame() set overlayState + overlayStats cùng lúc, nhưng nếu chỉ depend [overlayState]
  // thì overlayStats trong closure vẫn là giá trị cũ → point = 0.
  //
  // QUAN TRỌNG: Khi user chơi game mới, Zustand store vẫn giữ state cũ (overlayState='win')
  // cho đến khi setSession() chạy. Effect này sẽ trigger với state cũ → bắn game:ended sai.
  // Fix: Chỉ gửi khi sessionId khớp với session hiện tại (activeSessionIdRef).
  useEffect(() => {
    if (overlayState === 'idle' || gameEndedSentRef.current) return;
    // Guard: overlayStats phải có data mới gửi (tránh race condition)
    if (overlayStats.length === 0) return;
    // Guard: chỉ gửi cho session hiện tại, không phải session cũ còn sót trong store
    if (!session?.sessionId || session.sessionId !== activeSessionIdRef.current) return;

    gameEndedSentRef.current = true;

    const isWin = overlayState === 'win';
    // Đọc trực tiếp điểm cúp từ store (nguồn sự thật) — trùng khớp với giá trị hiển thị
    // trên overlay. KHÔNG parse ngược overlayStats (label từng lệch 'Điểm' vs 'Cúp' → luôn ra 0).
    const point = isWin ? lastScore : 0;

    notifyGameEnded({
      userId,
      gameType: 'mind_game',
      kafkaGameType: 'CARO',
      subGame: 'gomoku',
      sessionId: session.sessionId,
      point,
      playTime: timeElapsed,
      sessionCompleted: true,
      isWin,
    });
  }, [overlayState, overlayStats, lastScore]); // eslint-disable-line react-hooks/exhaustive-deps

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
      // Dùng getState() để đọc currentTurn mới nhất từ store (Zustand update đồng bộ),
      // tránh stale closure cho phép click khi không phải lượt mình
      if (useGomokuStore.getState().currentTurn !== playerSymbol) return;
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
          score={winner === userId ? (session?.config?.winPoints ?? 100) : 0}
          active={currentTurn === playerSymbol}
        />
        <Timer seconds={timeElapsed} mode="up" />
        <PlayerCard
          avatar={opponentData?.avatar}
          name={opponentData?.name ?? ""}
          mark={playerSymbol === "X" ? "O" : "X"}
          active={currentTurn !== playerSymbol}
        />
        <GameButton className="exit-in-hud" color="ghost" onClick={handleForfeit}>
          ← Thoát
        </GameButton>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {/* Board — bọc trong vùng cuộn để mặc định scroll ra giữa khi vào trận */}
      <div className="caro-board-scroll" ref={boardScrollRef}>
        <div className="caro-board-scroll-inner">
          <CaroBoard
            cells={board as CaroValue[][]}
            lastMove={lastMove as CaroCoord | null}
            win={win as CaroWinInfo | null}
            disabled={status !== "playing" || currentTurn !== playerSymbol}
            onCellClick={handleCellClick}
          />
        </div>
      </div>

      {/* Overlay */}
      {overlayState !== "idle" && (
        <GameStateOverlay
          state={overlayState as GameOverlayState}
          stats={overlayStats as GameOverlayStat[]}
          actions={
            <>
              <GameButton color="ghost" onClick={() => navigate("/matchmaking/gomoku")}>
                Về sảnh
              </GameButton>
              <GameButton color="orange" onClick={() => navigate("/matchmaking/gomoku?auto=1")}>
                Chơi tiếp
              </GameButton>
            </>
          }
        />
      )}

      <GameButton className="exit-at-bottom" color="ghost" onClick={handleForfeit}>
        ← Thoát
      </GameButton>
    </GameCanvas>
  );
}
