// ============================================================
// BossLeaderboardPage — SCR-04 Bảng xếp hạng (theo khối, real-time)
// ============================================================

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameButton } from '../../design-system/game';
import { BossLeaderboard } from '../../design-system/bossbattle';
import type { RankEntry } from '../../design-system/bossbattle/leaderboard';
import { useUser } from '../../hooks/useUser';
import { useBossBattleStore } from '../../stores/boss-battle';
import { bossBattleApi } from '../../services/boss-battle';
import type { BossLeaderboardEntry } from '@uniclub/shared';

/** Map backend BossLeaderboardEntry → design-system RankEntry */
function toRankEntry(
  entry: BossLeaderboardEntry,
  myUserId: string,
): RankEntry {
  return {
    rank: entry.rank,
    name: entry.displayName,
    avatar: entry.avatar,
    correctCount: entry.correctCountWeek,
    totalCorrectTimeSec: entry.totalCorrectTimeSec,
    pointsContributed: entry.pointsContributedWeek,
    meta: undefined, // backend không trả về class trong entry
    isMe: entry.studentId === myUserId,
  };
}

export function BossLeaderboardPage() {
  const navigate = useNavigate();
  const { user, error: userError } = useUser();
  const userId = user?.userId ?? '';

  const {
    leaderboard,
    lobby,
    loading,
    error,
    loadLobby,
    loadLeaderboard,
    loadHonors,
  } = useBossBattleStore();

  const grade = user?.grade ?? 4;
  const weekKey = lobby?.boss?.weekKey ?? '';

  // Redirect về error page nếu không xác thực được
  useEffect(() => {
    if (userError) {
      navigate('/error', { state: { message: userError }, replace: true });
    }
  }, [userError, navigate]);

  // Nếu chưa có lobby data → gọi lobby API để lấy weekKey
  useEffect(() => {
    if (!lobby) {
      loadLobby(grade);
    }
  }, [lobby, grade]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load leaderboard khi có weekKey (từ lobby data đã load)
  useEffect(() => {
    if (weekKey) {
      loadLeaderboard(weekKey, grade);
    }
  }, [weekKey, grade]); // eslint-disable-line react-hooks/exhaustive-deps

  // Socket: real-time leaderboard update đã được xử lý bởi BossBattleSocketProvider
  // Provider cập nhật store.leaderboard khi nhận leaderboard-update event

  const handleViewHonor = async () => {
    await loadHonors(grade);
    navigate('/boss-battle/honor');
  };

  // ---- Loading ----
  if (loading && !leaderboard) {
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
        Đang tải bảng xếp hạng...
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

  // ---- No leaderboard data yet ----
  if (!leaderboard || leaderboard.entries.length === 0) {
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
        <div style={{ fontSize: 48 }}>🏆</div>
        <div style={{ fontWeight: 900, fontSize: 20 }}>Chưa có bảng xếp hạng tuần này</div>
        <div style={{ fontSize: 13, opacity: 0.7 }}>
          Hãy là người đầu tiên ghi danh trên bảng xếp hạng!
        </div>
        <GameButton color="ghost" onClick={() => navigate('/boss-battle')}>
          Về sảnh
        </GameButton>
      </div>
    );
  }

  const entries: RankEntry[] = leaderboard.entries.map((e) => toRankEntry(e, userId));
  const myEntry = leaderboard.myEntry ? toRankEntry(leaderboard.myEntry, userId) : null;

  return (
    <BossLeaderboard
      entries={entries}
      myEntry={myEntry}
      questionsPerWeek={leaderboard.questionsPerWeek}
      grade={`Khối ${grade}`}
      topRight={
        <div style={{ display: 'flex', gap: 8 }}>
          <GameButton size="sm" color="ghost" onClick={() => navigate('/boss-battle')}>
            Về sảnh
          </GameButton>
          <GameButton size="sm" color="ghost" onClick={handleViewHonor}>
            Vinh danh →
          </GameButton>
        </div>
      }
    />
  );
}
