// ============================================================
// BossLobbyPage — SCR-01 Sảnh Săn Boss
// ============================================================

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameCanvas, GameButton } from '../../design-system/game';
import { BossLobby } from '../../design-system/bossbattle';
import { useUser } from '../../hooks/useUser';
import { useBossBattleStore } from '../../stores/boss-battle';
import { useBossBattleSocketContext } from '../../hooks/useBossBattleSocketProvider';
import { ExitButton } from '../../components';

export function BossLobbyPage() {
  const navigate = useNavigate();
  const { user, error: userError } = useUser();

  const {
    lobby,
    bossHpPercent,
    bossName,
    currentBossStateImg,
    loading,
    error,
    loadLobby,
    startBattle,
  } = useBossBattleStore();

  const grade = user?.grade ?? 4;

  // Hit notifications từ socket provider (duy trì xuyên suốt các trang)
  const { hits, shaking } = useBossBattleSocketContext();

  // Redirect về error page nếu không xác thực được
  useEffect(() => {
    if (userError) {
      navigate('/error', { state: { message: userError }, replace: true });
    }
  }, [userError, navigate]);

  // Load lobby khi mount
  useEffect(() => {
    loadLobby(grade);
  }, [grade]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBattle = async () => {
    await startBattle(grade);
    navigate('/boss-battle/battle');
  };

  // ---- Loading ----
  if (loading && !lobby) {
    return (
      <GameCanvas
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <div style={{ color: '#fff', fontSize: 18 }}>Đang tải Săn Quái Vật...</div>
      </GameCanvas>
    );
  }

  // ---- Error ----
  if (error) {
    return (
      <GameCanvas
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}
      >
        <ExitButton from="/boss-battle" className="bb-exit-btn">Thoát</ExitButton>
        <div style={{ color: '#ff6a5a', fontSize: 18, fontWeight: 800 }}>Lỗi</div>
        <div style={{ color: '#fff', fontSize: 14, opacity: 0.8 }}>{error}</div>
      </GameCanvas>
    );
  }

  // ---- No boss this week ----
  if (!lobby?.hasBoss) {
    return (
      <GameCanvas
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}
      >
        <ExitButton from="/boss-battle" className="bb-exit-btn">Thoát</ExitButton>
        <div style={{ color: '#fff', fontSize: 18, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🐉</div>
          <div style={{ fontWeight: 900 }}>Chưa có Quái Vật tuần này</div>
          <div style={{ fontSize: 13, opacity: 0.7, marginTop: 6 }}>
            Hãy quay lại khi tuần mới bắt đầu!
          </div>
        </div>
      </GameCanvas>
    );
  }

  // ---- Determine CTA status ----
  const boss = lobby.boss!;
  let ctaStatus: 'ready' | 'completed' | 'defeated' | 'closed' = 'ready';
  if (boss.status === 'CLOSED') {
    ctaStatus = 'closed';
  } else if (boss.status === 'DEFEATED') {
    ctaStatus = 'defeated';
  } else if (lobby.dailyStatus === 'COMPLETED') {
    ctaStatus = 'completed';
  }

  return (
    <BossLobby
      bossName={bossName}
      hpPercent={bossHpPercent}
      currentImg={currentBossStateImg ?? undefined}
      dailyDone={lobby.dailyAnswered}
      dailyTotal={boss.config.questionsPerDay}
      ctaStatus={ctaStatus}
      onBattle={handleBattle}
      resetAt={new Date(lobby.weeklyResetAt).getTime()}
      grade={`Khối ${grade}`}
      hits={hits}
      shaking={shaking}
      topRight={<ExitButton from="/boss-battle" className="bb-exit-btn">Thoát</ExitButton>}
      nameAction={
        <GameButton size="sm" color="ghost" onClick={() => navigate('/boss-battle/leaderboard')}>
          🏆 Bảng xếp hạng
        </GameButton>
      }
    />
  );
}
