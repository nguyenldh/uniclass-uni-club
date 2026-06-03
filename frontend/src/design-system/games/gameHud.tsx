/* ============================================================
   Game HUD — player cards, timer, hint, turn indicator
   Dùng chung cho mọi mini-game (caro, memory, …).
   ============================================================ */
import React, {
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { StarIcon, FlameIcon } from '../icons';
import { CaroMarkPill } from './caro';
import { AvatarImage } from '../../components/AvatarImage';

const cn = (...xs: Array<string | false | null | undefined>) =>
  xs.filter(Boolean).join(' ');

/* ============================================================
   PlayerCard — avatar + tên + điểm/streak/turn
   ============================================================ */

export interface PlayerCardProps extends HTMLAttributes<HTMLDivElement> {
  name: ReactNode;
  /** Initials hoặc <img>. Nếu omit, dùng chữ cái đầu của name. */
  avatar?: string;
  /** CSS background custom cho avatar circle. */
  avatarBg?: string;
  /** Điểm hiện tại (sao). */
  score?: number;
  /** Streak — chuỗi thắng/đúng liên tiếp. */
  streak?: number;
  /** Game mark (X/O cho caro). */
  mark?: 'X' | 'O';
  /** Là người đang đến lượt — sẽ glow. */
  active?: boolean;
}

export function PlayerCard({
  name,
  avatar,
  avatarBg,
  score,
  streak,
  mark,
  active,
  className,
  ...rest
}: PlayerCardProps) {
  const playerName = typeof name === 'string' ? name : '?';
  return (
    <div className={cn('player-card', active && 'active', className)} {...rest}>
      <AvatarImage
        src={avatar}
        name={playerName}
        avatarBg={avatarBg}
        size="md"
        className="pc-av"
      />
      <div className="pc-meta">
        <div className="pc-name">{name}</div>
        <div className="pc-stats">
          {mark && <CaroMarkPill mark={mark} />}
          {score != null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <StarIcon size={14} /> {score.toLocaleString('vi-VN')}
            </span>
          )}
          {streak != null && streak > 0 && (
            <span className="streak-counter">
              <FlameIcon size={14} /> {streak}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Timer — circular progress ring
   ============================================================ */

export interface TimerProps {
  /** Số giây còn lại (countdown) hoặc đã trôi (count-up). */
  seconds: number;
  /** Tổng số giây — dùng để vẽ progress ring. Nếu omit, ring đầy. */
  total?: number;
  /** Mode display — countdown (mặc định) hoặc count-up. */
  mode?: 'countdown' | 'up';
  /** Ngưỡng cảnh báo (warning ≤ N giây). Default 10. */
  warningThreshold?: number;
  /** Ngưỡng nguy hiểm (danger ≤ N giây). Default 5. */
  dangerThreshold?: number;
}

export function Timer({
  seconds,
  total,
  mode = 'countdown',
  warningThreshold = 10,
  dangerThreshold = 5,
}: TimerProps) {
  const safe = Math.max(0, Math.floor(seconds));
  const ratio = total && total > 0 ? Math.max(0, Math.min(1, safe / total)) : 1;
  const r = 30;
  const c = 2 * Math.PI * r;
  const dashOffset = c * (1 - ratio);

  const tone =
    mode === 'countdown' && safe <= dangerThreshold ? 'danger'
    : mode === 'countdown' && safe <= warningThreshold ? 'warning'
    : '';

  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  const label = total != null && total >= 60
    ? `${mm}:${ss.toString().padStart(2, '0')}`
    : `${safe}`;

  return (
    <div className={cn('timer', tone)} aria-label={`Thời gian ${label}`}>
      <svg viewBox="0 0 70 70">
        <circle className="track" cx="35" cy="35" r={r} strokeWidth="6" />
        <circle
          className="fill"
          cx="35" cy="35" r={r}
          strokeWidth="6"
          strokeDasharray={c}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <span className="label">{label}</span>
    </div>
  );
}

/* ============================================================
   HintButton — chi phí sao
   ============================================================ */

export interface HintButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Số sao phải trả mỗi lần dùng. */
  cost: number;
  /** Số gợi ý còn lại (nếu giới hạn). */
  remaining?: number;
  label?: ReactNode;
}

export function HintButton({
  cost,
  remaining,
  label = 'Gợi ý',
  className,
  ...rest
}: HintButtonProps) {
  return (
    <button className={cn('hint-btn', className)} {...rest}>
      <span className="hint-cost">
        <StarIcon size={14} /> {cost}
      </span>
      {label}
      {remaining != null && <span style={{ opacity: .7 }}>· {remaining}</span>}
    </button>
  );
}

/* ============================================================
   TurnIndicator — pill nhỏ "Lượt: X" / "Lượt bạn"
   ============================================================ */

export interface TurnIndicatorProps {
  children: ReactNode;
}
export function TurnIndicator({ children }: TurnIndicatorProps) {
  return <span className="turn-indicator">{children}</span>;
}

/* ============================================================
   GameHud — layout có sẵn: PlayerA · center (timer+turn) · PlayerB
   ============================================================ */

export interface GameHudProps extends HTMLAttributes<HTMLDivElement> {
  /** Player bên trái. */
  playerA: PlayerCardProps;
  /** Player bên phải. */
  playerB: PlayerCardProps;
  /** Khu vực giữa — thường là <Timer />, <TurnIndicator />, hoặc cả 2. */
  center?: ReactNode;
}

export function GameHud({
  playerA,
  playerB,
  center,
  className,
  ...rest
}: GameHudProps) {
  return (
    <div className={cn('game-hud', className)} {...rest}>
      <PlayerCard {...playerA} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {center}
      </div>
      <PlayerCard {...playerB} />
    </div>
  );
}
