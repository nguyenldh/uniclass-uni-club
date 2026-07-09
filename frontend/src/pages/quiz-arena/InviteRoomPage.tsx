import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GameCanvas, GameButton } from '../../design-system/game';
import { useUser } from '../../hooks/useUser';
import { ExitButton } from '../../components';
import { AvatarImage } from '../../components/AvatarImage';
import { useInviteRoom, type InviteRoomStartPayload } from '../../hooks/useInviteRoom';
import { notifyInvite } from '../../utils/webview';
import { RoomNotFound } from './RoomNotFound';
import type { InviteRoomMember, InviteRoom } from '@uniclub/shared';

const CLOSE_MESSAGES: Record<string, string> = {
  expired: 'Phòng đã hết hạn.',
  host_left: 'Chủ phòng đã rời đi.',
  guest_left: 'Đối thủ đã rời phòng.',
  limit_reached: 'Đã hết số ván cho phép trong phòng này.',
};

const ERROR_MESSAGES: Record<string, string> = {
  ROOM_NOT_FOUND: 'Phòng không tồn tại hoặc đã hết hạn.',
  ROOM_FULL: 'Phòng đã đủ người.',
  ROOM_EXPIRED: 'Phòng đã đóng.',
  ROOM_SELF_JOIN: 'Bạn không thể tự tham gia phòng của chính mình.',
};

export function InviteRoomPage() {
  const navigate = useNavigate();
  const { roomId: roomIdParam } = useParams<{ roomId?: string }>();
  const { user, error: userError } = useUser();

  const [closedReason, setClosedReason] = useState<string | null>(null);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    if (userError) {
      navigate('/error', { state: { message: userError }, replace: true });
    }
  }, [userError, navigate]);

  const userId = user?.userId ?? '';

  const handleStart = useCallback(
    (p: InviteRoomStartPayload) => {
      navigate('/quiz-arena/game', {
        state: {
          sessionId: p.sessionId,
          opponentId: null,
          isAI: false,
          role: p.role,
          roomId: p.roomId,
          rematchRemaining: p.rematchRemaining,
          isInvite: true,
        },
        replace: true,
      });
    },
    [navigate],
  );

  const { room, error, create, join, setReady, leave } = useInviteRoom({
    userId,
    displayName: user?.name,
    grade: user?.grade,
    avatar: user?.avatar,
    gameType: 'quiz',
    onStart: handleStart,
    onClosed: (reason) => setClosedReason(reason),
  });

  // Khởi tạo 1 lần: có roomId → guest join; không có → host tạo phòng
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current || !userId) return;
    didInit.current = true;
    if (roomIdParam) join(roomIdParam);
    else create();
  }, [userId, roomIdParam, join, create]);

  // Bắn lời mời ra parent app (mgm:invite) — parent xử lý chia sẻ link.
  const fireInvite = useCallback(
    (r: InviteRoom) => {
      notifyInvite({
        profileId: String(user?.profileId ?? userId),
        roomId: r.roomId,
        gameType: r.gameType,
        joinUrl: `/quiz-arena/room/${r.roomId}`,
      });
    },
    [user?.profileId, userId],
  );

  // Tự động bắn 1 lần khi tạo/vào phòng thành công với vai trò host
  const invitePostedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!room || !userId) return;
    const meMember = room.members.find((m) => m.userId === userId);
    if (!meMember?.isHost) return;
    if (invitePostedRef.current === room.roomId) return;
    invitePostedRef.current = room.roomId;
    fireInvite(room);
  }, [room, userId, fireInvite]);

  const handleShare = () => {
    if (!room) return;
    fireInvite(room);
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  };

  const handleLeave = () => {
    leave();
    navigate('/quiz-arena', { replace: true });
  };

  const shell = (children: React.ReactNode) => (
    <GameCanvas
      className="quiz-arena-lobby no-top"
      style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        style={{
          position: 'relative',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
          width: '100%', maxWidth: 460, padding: '28px 26px',
          background: 'rgba(12, 17, 28, 0.86)',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: 20,
          boxShadow: '0 14px 44px rgba(0,0,0,0.5)',
        }}
      >
        {children}
      </div>
    </GameCanvas>
  );

  const isGuest = user?.type === 'guest';

  // ---- Phòng đã đóng ----
  if (closedReason) {
    const msg = CLOSE_MESSAGES[closedReason] ?? 'Phòng đã kết thúc.';
    // Guest không có sảnh để về → màn không tìm thấy phòng + Thoát
    if (isGuest) return <RoomNotFound message={msg} />;
    return shell(
      <>
        <div style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>Phòng đã đóng</div>
        <div style={{ color: '#cbd5e1' }}>{msg}</div>
        <GameButton color="orange" size="md" onClick={() => navigate('/quiz-arena', { replace: true })}>
          Về sảnh
        </GameButton>
      </>,
    );
  }

  // ---- Lỗi vào phòng (phòng không tồn tại / hết hạn / đầy...) ----
  if (error) {
    const msg = ERROR_MESSAGES[error.code ?? ''] ?? error.message;
    if (isGuest) return <RoomNotFound message={msg} />;
    return shell(
      <>
        <div style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>Không vào được phòng</div>
        <div style={{ color: '#fca5a5' }}>{msg}</div>
        <GameButton color="orange" size="md" onClick={() => navigate('/quiz-arena', { replace: true })}>
          Về sảnh
        </GameButton>
      </>,
    );
  }

  // ---- Đang khởi tạo ----
  if (!room) {
    return shell(<div style={{ color: '#fff', fontSize: 18 }}>Đang tạo phòng…</div>);
  }

  const me: InviteRoomMember | undefined = room.members.find((m) => m.userId === userId);
  const opponent: InviteRoomMember | undefined = room.members.find((m) => m.userId !== userId);
  const myReady = me?.ready ?? false;
  const isHost = me?.isHost ?? false;
  const waitingForGuest = room.members.length < 2;

  const PlayerCard = ({ member, isMe }: { member?: InviteRoomMember; isMe: boolean }) => (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
        width: 150, height: 190, boxSizing: 'border-box', padding: 16, borderRadius: 16,
        background: member?.ready ? 'rgba(76,175,125,.18)' : 'rgba(255,255,255,.06)',
        border: member?.ready ? '2px solid #4caf7d' : '2px solid rgba(255,255,255,.14)',
      }}
    >
      {member ? (
        <>
          <AvatarImage src={member.avatar} name={member.displayName} size="lg" />
          <div
            style={{
              color: '#fff', fontWeight: 700, maxWidth: 130,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}
          >
            {member.displayName}{isMe ? ' (bạn)' : ''}
          </div>
          <div style={{ fontSize: 13, color: member.ready ? '#4caf7d' : '#94a3b8', fontWeight: 700 }}>
            {member.ready ? '✓ Sẵn sàng' : 'Chưa sẵn sàng'}
          </div>
        </>
      ) : (
        <>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>⏳</div>
          <div style={{ color: '#94a3b8' }}>Đang chờ…</div>
        </>
      )}
    </div>
  );

  const isRematch = room.gamesPlayed > 0;

  return shell(
    <>
      <div style={{ position: 'absolute', top: 12, right: 12 }}>
        <ExitButton from="/quiz-arena" className="st-exit-btn">Thoát</ExitButton>
      </div>

      <div style={{ color: '#fff', fontSize: 22, fontWeight: 900, letterSpacing: '.02em' }}>
        {isRematch ? 'TÁI ĐẤU' : 'PHÒNG MỜI BẠN'}
      </div>
      <div style={{ color: '#cbd5e1', fontSize: 13, textAlign: 'center' }}>
        Ván {Math.min(room.gamesPlayed + 1, room.maxGames)}/{room.maxGames} ·{' '}
        {isHost ? 'Bạn là người mời — thắng được nhân điểm 🔥' : 'Trận giao hữu với bạn bè'}
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
        <PlayerCard member={me} isMe />
        <div style={{ color: '#f59e0b', fontWeight: 900, fontSize: 20 }}>VS</div>
        <PlayerCard member={opponent} isMe={false} />
      </div>

      {waitingForGuest ? (
        <>
          <div style={{ color: '#cbd5e1', textAlign: 'center' }}>
            Nhấn "Chia sẻ" để mời bạn bè vào phòng (phòng hết hạn sau 30 phút).
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <GameButton color="orange" size="md" onClick={handleShare}>
              {shared ? '✓ Đã gửi lời mời' : '📤 Chia sẻ'}
            </GameButton>
            <GameButton color="ghost" size="md" onClick={handleLeave}>
              ← Hủy phòng
            </GameButton>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <GameButton
              color={myReady ? 'ghost' : 'orange'}
              size="md"
              onClick={() => setReady(!myReady)}
            >
              {myReady ? 'Huỷ sẵn sàng' : (isRematch ? 'Tái đấu' : 'Sẵn sàng')}
            </GameButton>
            <GameButton color="ghost" size="md" onClick={handleLeave}>
              ← Rời phòng
            </GameButton>
          </div>
          <div style={{ color: '#94a3b8', fontSize: 13 }}>
            {myReady && !opponent?.ready ? 'Đang chờ đối thủ sẵn sàng…' : 'Cả 2 sẵn sàng sẽ tự động vào trận.'}
          </div>
        </>
      )}
    </>,
  );
}

export default InviteRoomPage;
