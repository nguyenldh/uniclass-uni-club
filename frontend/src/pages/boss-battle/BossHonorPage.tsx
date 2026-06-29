// ============================================================
// BossHonorPage — SCR-05 Vinh danh & Phần thưởng (cuối tuần)
// ============================================================

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameButton } from '../../design-system/game';
import { BossHonor } from '../../design-system/bossbattle';
import type { RankEntry } from '../../design-system/bossbattle/leaderboard';
import type { WeeklyAvatarFrameProps } from '../../design-system/bossbattle/honor';
import { useUser } from '../../hooks/useUser';
import { useBossBattleStore } from '../../stores/boss-battle';
import type { WeeklyHonor } from '@uniclub/shared';

/** Map backend WeeklyHonor → design-system RankEntry */
function honorToRankEntry(h: WeeklyHonor): RankEntry {
  return {
    rank: h.rank,
    name: h.displayName,
    avatar: h.avatar ?? '',
    correctCount: h.correctCountWeek,
    totalCorrectTimeSec: h.totalCorrectTimeSec,
    pointsContributed: h.pointsContributedWeek,
    isMe: false, // sẽ được set sau
  };
}

export function BossHonorPage() {
  const navigate = useNavigate();
  const { user, error: userError } = useUser();
  const userId = user?.userId ?? '';

  const {
    honors,
    loading,
    error,
    loadHonors,
  } = useBossBattleStore();

  const grade = user?.grade ?? 4;

  // Redirect về error page nếu không xác thực được
  useEffect(() => {
    if (userError) {
      navigate('/error', { state: { message: userError }, replace: true });
    }
  }, [userError, navigate]);

  // Load honors khi mount
  useEffect(() => {
    loadHonors(grade);
  }, [grade]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Loading ----
  if (loading && !honors) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100dvh',
          color: '#fff',
          fontSize: 18,
          background: '#170f24',
        }}
      >
        Đang tải vinh danh...
      </div>
    );
  }

  // ---- Error ----
  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100dvh',
          gap: 16,
          color: '#fff',
          background: '#170f24',
        }}
      >
        <div style={{ color: '#ff6a5a', fontSize: 18, fontWeight: 800 }}>Lỗi</div>
        <div style={{ fontSize: 14, opacity: 0.8 }}>{error}</div>
        <GameButton color="ghost" onClick={() => navigate('/boss-battle')}>
          Về sảnh
        </GameButton>
      </div>
    );
  }

  // ---- No honors yet ----
  if (!honors || honors.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100dvh',
          gap: 16,
          color: '#fff',
          background: '#170f24',
        }}
      >
        <div style={{ fontSize: 48 }}>👑</div>
        <div style={{ fontWeight: 900, fontSize: 20 }}>Chưa có vinh danh tuần này</div>
        <div style={{ fontSize: 13, opacity: 0.7 }}>
          Vinh danh sẽ được công bố vào đầu tuần sau!
        </div>
        <GameButton color="ghost" onClick={() => navigate('/boss-battle')}>
          Về sảnh
        </GameButton>
      </div>
    );
  }

  const top10: RankEntry[] = honors.map((h) => ({
    ...honorToRankEntry(h),
    isMe: h.studentId === userId,
  }));

  // Tìm frame player: ưu tiên user hiện tại nếu có trong top, nếu không lấy top 1
  const myHonor = honors.find((h) => h.studentId === userId);
  const framePlayer: WeeklyAvatarFrameProps | undefined = myHonor
    ? {
        name: myHonor.displayName,
        avatar: myHonor.avatar,
        frameLabel: 'Dũng sĩ diệt Boss',
        daysLeft: myHonor.frameExpiry
          ? Math.max(0, Math.ceil((new Date(myHonor.frameExpiry).getTime() - Date.now()) / 86400000))
          : 7,
      }
    : honors[0]
      ? {
          name: honors[0].displayName,
          avatar: honors[0].avatar,
          frameLabel: 'Dũng sĩ diệt Boss',
          daysLeft: 7,
        }
      : undefined;

  return (
    <BossHonor
      top10={top10}
      framePlayer={framePlayer}
      grade={`Khối ${grade}`}
      topRight={
        <GameButton size="sm" color="ghost" onClick={() => navigate('/boss-battle')}>
          Về sảnh
        </GameButton>
      }
    />
  );
}
