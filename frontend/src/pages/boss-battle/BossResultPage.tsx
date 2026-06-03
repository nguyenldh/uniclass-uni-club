// ============================================================
// BossResultPage — SCR-03 Màn hình Kết quả lượt ngày
// ============================================================

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameButton } from '../../design-system/game';
import { BossResult } from '../../design-system/bossbattle';
import { useUser } from '../../hooks/useUser';
import { useBossBattleStore } from '../../stores/boss-battle';
import { notifyGameEnded } from '../../utils';

export function BossResultPage() {
  const navigate = useNavigate();
  const { user, error: userError } = useUser();
  const gameEndedSentRef = useRef(false);

  const {
    dailyResult,
    attemptId,
    bossHpPercent,
    bossProgressPercent,
    bossStates,
    bossName,
    loading,
    error,
    completeAttempt,
  } = useBossBattleStore();

  // Redirect về error page nếu không xác thực được
  useEffect(() => {
    if (userError) {
      navigate('/error', { state: { message: userError }, replace: true });
    }
  }, [userError, navigate]);

  // Nếu F5, gọi lại API để lấy result
  useEffect(() => {
    if (!dailyResult && attemptId) {
      completeAttempt(attemptId);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect về lobby nếu không có dữ liệu (truy cập trực tiếp hoặc F5 không có attempt)
  useEffect(() => {
    if (!attemptId && !dailyResult) {
      navigate('/boss-battle', { replace: true });
    }
  }, [attemptId, dailyResult, navigate]);

  // ---- Loading ----
  if (loading || !dailyResult) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 600,
          color: '#fff',
          fontSize: 18,
          background: '#170f24',
          borderRadius: 22,
        }}
      >
        Đang tải kết quả...
      </div>
    );
  }

  const { attempt, boss, myProgress } = dailyResult;
  // Dùng giá trị thập phân chính xác để tránh làm tròn mất delta nhỏ
  const hpBefore = Math.max(0, Math.min(100, 100 - bossProgressPercent));
  const hpAfter = Math.max(0, Math.min(100, 100 - boss.progressPercent));
  const bossDefeated = boss.status === 'DEFEATED';

  // ─── Gửi game:ended khi result data available (1 lần duy nhất) ───
  if (!gameEndedSentRef.current) {
    gameEndedSentRef.current = true;
    const totalQuestions = myProgress
      ? (attempt.correctCount + (attempt.correctCount > 0 ? 0 : 0)) // fallback
      : 5; // default questionsPerDay
    notifyGameEnded({
      userId: user?.userId ?? '',
      gameType: 'boss_battle',
      kafkaGameType: 'SAN_BOSS',
      sessionId: attemptId ?? undefined,
      point: attempt.pointsEarned,
      playTime: Math.round(attempt.totalResponseTime),
      sessionCompleted: true,
      isWin: attempt.correctCount > 0,
      correctCount: attempt.correctCount,
      totalQuestions,
    });
  }

  return (
    <BossResult
      correctCount={attempt.correctCount}
      totalQuestions={myProgress ? undefined : 5}
      totalTime={attempt.totalResponseTime}
      pointsContributed={attempt.pointsEarned}
      hpBefore={bossHpPercent}
      hpAfter={hpAfter}
      states={bossStates}
      bossName={bossName}
      bossDefeated={bossDefeated}
      onViewLeaderboard={() => navigate('/boss-battle/leaderboard')}
      extraActions={
        <GameButton color="ghost" onClick={() => navigate('/boss-battle')}>
          Về sảnh
        </GameButton>
      }
    />
  );
}
