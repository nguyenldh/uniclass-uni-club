import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameCanvas, MatchmakingPanel, GameButton } from '../../design-system/game';
import { Lobby } from '../../design-system/sotai';
import { useUser } from '../../hooks/useUser';
import { ExitButton } from '../../components';
import { useMatchmaking } from '../../hooks/useMatchmaking';
import { quizArenaApi } from '../../services/quiz-arena';
import { AvatarImage } from '../../components/AvatarImage';

export function QuizArenaLobbyPage() {
  const navigate = useNavigate();
  const { user, error: userError } = useUser();

  // Redirect về error page nếu không xác thực được
  useEffect(() => {
    if (userError) {
      navigate('/error', { state: { message: userError }, replace: true });
    }
  }, [userError, navigate]);

  const userId = user?.userId ?? 'user-1';
  const [checkingSession, setCheckingSession] = useState(true);

  const { phase, secondsRemaining, totalSeconds, result, startMatchmaking, cancelMatchmaking } =
    useMatchmaking({ userId, gameType: 'quiz', grade: user?.grade, displayName: user?.name });

  // ---- Check active session khi mount ----
  useEffect(() => {
    let cancelled = false;

    async function checkActiveSession() {
      try {
        const res = await quizArenaApi.checkActiveSession(userId);
        if (cancelled) return;

        if (res.hasActiveSession && res.sessionId) {
          // Có session đang diễn ra → tự động vào game
          navigate('/quiz-arena/game', {
            state: {
              sessionId: res.sessionId,
              opponentId: null,
              isAI: res.isBot ?? false,
              role: 'first',
              isReconnect: true,
            },
            replace: true,
          });
          return;
        }
      } catch {
        // Ignore error, cho phép user tiếp tục sử dụng lobby
      }
      setCheckingSession(false);
    }

    checkActiveSession();
    return () => { cancelled = true; };
  }, [userId, navigate]);

  const displayName = user?.name ?? userId;
  const grade = user?.grade ? `Lớp ${user.grade}` : undefined;
  const me = { name: displayName, grade, avatar: user?.avatar };

  const handleEnterGame = () => {
    if (!result?.sessionId) return;
    navigate('/quiz-arena/game', {
      state: {
        sessionId: result.sessionId,
        opponentId: result.opponentId ?? null,
        isAI: result.isAI ?? false,
        role: result.role ?? 'first',
        opponentProfile: result.opponentProfile,
      },
    });
  };

  // ---- Đang kiểm tra session ----
  if (checkingSession) {
    return (
      <GameCanvas
        className="quiz-arena-lobby no-top"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
      >
        <div style={{ color: '#fff', fontSize: 18 }}>Kiểm tra trận đấu...</div>
      </GameCanvas>
    );
  }

  // ---- Idle: sảnh chờ ----
  if (phase === 'idle') {
    return (
      <Lobby
        player={{ name: displayName, grade, avatar: user?.avatar }}
        onFindMatch={startMatchmaking}
        topRight={<ExitButton from="/quiz-arena" className="st-exit-btn">Thoát</ExitButton>}
      />
    );
  }

  // ---- Searching / Matched / Timeout: dùng lại panel ghép trận ----
  const isFound = phase === 'matched' || phase === 'timeout';
  
  // Hiển thị opponent dựa trên opponentProfile (ẩn danh tính AI)
  const opponent = result?.opponentProfile
    ? {
        name: result.opponentProfile.name,
        avatar: result.opponentProfile.avatar,
      }
    : result?.opponentId
      ? { name: result.opponentId }
      : undefined;

  return (
    <GameCanvas
      className="quiz-arena-lobby no-top"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}
    >
      <MatchmakingPanel
        state={isFound ? 'found' : 'searching'}
        me={me}
        opponent={opponent}
        secondsRemaining={secondsRemaining}
        totalSeconds={totalSeconds}
        searchingTitle="Đang tìm đối thủ"
        searchingSubtitle="Hệ thống đang ghép trận So Tài phù hợp với bạn"
        foundTitle="Đã ghép được trận!"
        foundSubtitle={undefined}
        actions={
          isFound ? (
            <>
              <GameButton color="orange" onClick={handleEnterGame}>
                ⚔️ Vào trận
              </GameButton>
            </>
          ) : (
            <GameButton color="ghost" onClick={cancelMatchmaking}>
              ← Hủy
            </GameButton>
          )
        }
      />
    </GameCanvas>
  );
}
