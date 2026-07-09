/* ============================================================
   So Tài · Lobby (Sảnh chờ)
   Single CTA "Tìm đối thủ" — no rank, no difficulty selection.
   ============================================================ */
import React, { type ReactNode, type HTMLAttributes } from 'react';
import { GameButton, GamePill } from '../game';
import { StarIcon, FlameIcon } from '../icons';
import { AvatarImage } from '../../components/AvatarImage';

const cn = (...xs: Array<string | false | null | undefined>) =>
  xs.filter(Boolean).join(' ');

export interface LobbyPlayer {
  name: ReactNode;
  /** Avatar content — initials, emoji, or <img>. Defaults to first char of name. */
  avatar?: ReactNode;
  /** Custom background for the avatar (default wood gradient). */
  avatarBg?: string;
  /** Grade / class label, e.g. "Lớp 5". */
  grade?: ReactNode;
  /** Total UniPoints accumulated. */
  uniPoints?: number;
  /** Current streak count (optional). */
  streak?: number;
}

export interface LobbyProps extends HTMLAttributes<HTMLDivElement> {
  player: LobbyPlayer;
  /** Called when user taps the big "Tìm Đối Thủ" CTA. */
  onFindMatch?: () => void;
  /** Called when user taps the "Mời bạn bè" secondary CTA. Nút chỉ hiện khi có prop này. */
  onInvite?: () => void;
  /** Override nhãn nút "Mời bạn bè" (vd kèm hệ số nhân điểm). */
  inviteLabel?: ReactNode;
  /** Nội dung phụ hiển thị NGAY BÊN PHẢI nút "Mời bạn bè", cùng hàng (vd nút Thưởng). */
  inviteExtra?: ReactNode;
  /** Đang xử lý trước khi ghép trận (vd: kiểm tra câu hỏi) → khoá CTA. */
  findMatchLoading?: boolean;
  /** Override CTA label. */
  ctaLabel?: ReactNode;
  /** Top-right slot (e.g. settings icon, exit). */
  topRight?: ReactNode;
  /** Show electric sparks decoration. Default true. */
  sparks?: boolean;
}

/** Sảnh chờ — full-bleed stage with player card + single CTA. */
export function Lobby({
  player,
  onFindMatch,
  onInvite,
  inviteLabel = '👥 Mời bạn bè',
  inviteExtra,
  findMatchLoading = false,
  ctaLabel = 'Tìm Đối Thủ',
  topRight,
  sparks = true,
  className,
  ...rest
}: LobbyProps) {
  return (
    <div className={cn('st-stage is-lobby', className)} {...rest}>
      {sparks && (
        <div className="st-sparks" aria-hidden>
          <i /><i /><i /><i /><i /><i />
        </div>
      )}

      <div className="st-lobby">
        <div className="st-lobby-top">
          <h1 className="st-lobby-title">
            <span className="ic-sword" aria-hidden>⚔️</span>
            SO TÀI
          </h1>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {player.grade && <span className="st-lobby-grade">{player.grade}</span>}
            {topRight}
          </div>
        </div>

        <div className="st-lobby-center">
          <div className="st-lobby-hero">
            <AvatarImage
              src={typeof player.avatar === 'string' ? player.avatar : undefined}
              name={typeof player.name === 'string' ? player.name : '?'}
              avatarBg={player.avatarBg}
              size="xl"
            />
            <div className="name">{player.name}</div>
            <div className="stats">
              {player.uniPoints != null && (
                <GamePill icon={<StarIcon size={20} />}>
                  {player.uniPoints.toLocaleString('vi-VN')}
                </GamePill>
              )}
              {player.streak != null && player.streak > 0 && (
                <GamePill tone="red" icon={<FlameIcon size={20} />}>
                  {player.streak} chuỗi
                </GamePill>
              )}
            </div>
          </div>

          <div className="st-lobby-cta">
            <div className="cue">Sẵn sàng bước vào trận?</div>
            <GameButton
              color="orange"
              size="lg"
              onClick={onFindMatch}
              disabled={findMatchLoading}
            >
              {findMatchLoading ? 'Đang kiểm tra…' : ctaLabel}
            </GameButton>
            {onInvite && (
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  marginTop: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <GameButton
                  color="ghost"
                  size="md"
                  onClick={onInvite}
                  disabled={findMatchLoading}
                >
                  {inviteLabel}
                </GameButton>
                {inviteExtra}
              </div>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: 12, opacity: .6, fontWeight: 700, letterSpacing: '.1em' }}>
          Hệ thống tự động ghép cặp đối thủ cân sức · Trận đấu 10 câu
        </div>
      </div>
    </div>
  );
}
