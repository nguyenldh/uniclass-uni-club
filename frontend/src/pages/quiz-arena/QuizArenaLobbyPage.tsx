import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GameCanvas, MatchmakingPanel, GameButton } from '../../design-system/game';
import { Lobby } from '../../design-system/sotai';
import { useUser } from '../../hooks/useUser';
import { ExitButton } from '../../components';
import { useMatchmaking } from '../../hooks/useMatchmaking';
import { quizArenaApi } from '../../services/quiz-arena';
import { AvatarImage } from '../../components/AvatarImage';
import { notifyUserReward } from '../../utils/webview';
import { RoomNotFound } from './RoomNotFound';

export function QuizArenaLobbyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, error: userError } = useUser();

  // Redirect về error page nếu không xác thực được
  useEffect(() => {
    if (userError) {
      navigate('/error', { state: { message: userError }, replace: true });
    }
  }, [userError, navigate]);

  const userId = user?.userId ?? 'user-1';
  const [checkingSession, setCheckingSession] = useState(true);
  const [checkingQuestions, setCheckingQuestions] = useState(false);
  const [inviteMultiplier, setInviteMultiplier] = useState<number | null>(null);
  const [questionCount, setQuestionCount] = useState<number | null>(null);
  // MGM (Thách đấu bạn bè) bật/tắt — mặc định bật cho tới khi có config.
  const [inviteEnabled, setInviteEnabled] = useState(true);

  // Lấy config: bật/tắt MGM + hệ số nhân điểm (nút Thách đấu) + số câu mỗi trận (chip sneak-peek)
  useEffect(() => {
    let cancelled = false;
    quizArenaApi
      .getConfig()
      .then((res) => {
        if (cancelled) return;
        setInviteEnabled(res.config?.inviteEnabled ?? true);
        setInviteMultiplier(res.config?.inviteHostWinMultiplier ?? null);
        setQuestionCount(res.config?.questionsPerMatch ?? null);
      })
      .catch(() => {
        /* Không có config → nút hiển thị nhãn mặc định */
      });
    return () => { cancelled = true; };
  }, []);

  const { phase, secondsRemaining, totalSeconds, result, startMatchmaking, cancelMatchmaking } =
    useMatchmaking({ userId, gameType: 'quiz', grade: user?.grade, displayName: user?.name });

  // Bấm "Tìm đối thủ": KIỂM TRA khối có câu hỏi TRƯỚC khi ghép trận.
  // Nếu chưa có câu hỏi → sang màn "không có câu hỏi" thay vì vào ghép trận
  // rồi mới báo (yêu cầu: check ngay từ trước khi bắt đầu ghép trận).
  const handleFindMatch = async () => {
    const grade = user?.grade;
    if (grade != null) {
      setCheckingQuestions(true);
      try {
        const res = await quizArenaApi.hasQuestions(grade);
        if (!res.hasQuestions) {
          navigate('/quiz-arena/game', { state: { noQuestions: true } });
          return;
        }
      } catch {
        // Lỗi kiểm tra → vẫn cho ghép trận (fallback an toàn, không chặn người dùng).
      } finally {
        setCheckingQuestions(false);
      }
    }
    startMatchmaking();
  };

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

  // Vào từ nút "Chơi tiếp" (state.autoFind) → tự động tìm đối thủ ngay (chỉ chạy 1 lần).
  const autoFindRef = useRef(false);
  useEffect(() => {
    const autoFind = (location.state as { autoFind?: boolean } | null)?.autoFind;
    if (autoFind && !checkingSession && phase === 'idle' && !autoFindRef.current) {
      autoFindRef.current = true;
      handleFindMatch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingSession, phase]);

  const displayName = user?.name ?? userId;
  const grade = user?.grade ? `Lớp ${user.grade}` : undefined;
  const me = { name: displayName, grade, avatar: user?.avatar };

  // Tự động vào game khi đã ghép (matched) hoặc fallback bot (timeout).
  // PHẢI nằm trong useEffect — gọi navigate() trực tiếp trong render bị React Router
  // nuốt/cảnh báo, điều hướng không chạy → kẹt ở màn "đang tìm".
  useEffect(() => {
    if ((phase === 'matched' || phase === 'timeout') && result?.sessionId) {
      navigate('/quiz-arena/game', {
        state: {
          sessionId: result.sessionId,
          opponentId: result.opponentId ?? null,
          isAI: result.isAI ?? false,
          role: result.role ?? 'first',
          opponentProfile: result.opponentProfile,
        },
        replace: true,
      });
    }
  }, [phase, result?.sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Guest KHÔNG được vào sảnh ----
  // (guest chỉ tham gia qua lời mời; nếu lỡ vào sảnh → màn không tìm thấy phòng + Thoát)
  if (user?.type === 'guest') {
    return <RoomNotFound message="Bạn chỉ có thể tham gia qua lời mời của bạn bè." />;
  }

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
        ctaLabel="Ghép trận ngẫu nhiên"
        player={{ name: displayName, grade, avatar: user?.avatar }}
        questionCount={questionCount ?? undefined}
        gradeLevel={user?.grade}
        onFindMatch={handleFindMatch}
        onInvite={inviteEnabled ? () => navigate('/quiz-arena/room') : undefined}
        inviteLabel={
          inviteMultiplier && inviteMultiplier > 1 ? (
            <span className="st-invite-label">
              Thách đấu bạn bè
              <span className="st-cup-badge">🏆 ×{inviteMultiplier} CÚP</span>
            </span>
          ) : (
            'Thách đấu bạn bè'
          )
        }
        findMatchLoading={checkingQuestions}
        inviteExtra={
          inviteEnabled ? (
          <GameButton
            color="ghost"
            size="md"
            onClick={() =>
              notifyUserReward({
                profileId: String(user?.profileId ?? userId),
                name: user?.name,
                type: 'user',
                grade: user?.grade,
                avatar: user?.avatar,
              })
            }
          >
            🎁 Thưởng
          </GameButton>
          ) : undefined
        }
        topRight={<ExitButton from="/quiz-arena" className="st-exit-btn">Thoát</ExitButton>}
      />
    );
  }

  // ---- Searching / Matched / Timeout: dùng lại panel ghép trận ----
  // Khi matched/timeout, useEffect ở trên điều hướng sang game; ở đây chỉ render
  // panel "đã ghép" trong lúc chuyển trang (tránh nháy về searching).
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
