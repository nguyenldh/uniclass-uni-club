// ============================================================
// BossResultPage — SCR-03 Màn hình Kết quả lượt ngày
// ============================================================

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameButton } from '../../design-system/game';
import { BossResult } from '../../design-system/bossbattle';
import { DEFAULT_BOSS_STATES } from '../../design-system/bossbattle/lobby';
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
  // Máu Boss cuối lượt = máu THẬT từ server (100 − progressPercent).
  // "Trước" = máu thật + % HP người chơi vừa đánh (suy từ điểm / hpMax) → delta hiển thị đúng
  // bằng sát thương của người chơi, và thanh máu dừng ở đúng máu thật. Không phụ thuộc state
  // client nên an toàn cả khi F5 màn kết quả.
  const hpMax = boss.config?.hpMax ?? 0;
  const myDamagePct = hpMax > 0 ? Math.min(100, (attempt.pointsEarned / hpMax) * 100) : 0;
  const hpAfter = Math.max(0, Math.min(100, 100 - boss.progressPercent));
  const hpBefore = Math.max(0, Math.min(100, hpAfter + myDamagePct));
  const bossDefeated = boss.status === 'DEFEATED';

  // States từ config để suy nhãn/ảnh theo mốc HP (giống màn chiến đấu). Ảnh cuối lượt
  // ưu tiên currentBossStateImg do server chốt lúc finalize.
  const bossStates = boss.config?.bossStates?.map((s) => ({
    min: s.minPercent,
    max: s.maxPercent,
    label: s.minPercent >= 71 ? 'BÌNH THƯỜNG' : s.minPercent >= 31 ? 'BỊ THƯƠNG' : s.minPercent >= 1 ? 'HUNG HÃN' : 'BỊ HẠ GỤC',
    tone: (s.minPercent >= 71 ? 'normal' : s.minPercent >= 31 ? 'injured' : s.minPercent >= 1 ? 'rage' : 'defeated') as any,
    img: s.img,
  }));

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
      totalTime={attempt.correctResponseTime}
      pointsContributed={attempt.pointsEarned}
      hpBefore={hpBefore}
      hpAfter={hpAfter}
      states={bossStates ?? DEFAULT_BOSS_STATES}
      bossImg={boss.currentBossStateImg}
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
