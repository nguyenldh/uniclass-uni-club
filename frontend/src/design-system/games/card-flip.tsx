/* ============================================================
   Mini-game · Card Flip (Lật thẻ PvP)
   Tái sử dụng MemoryCard từ memory.tsx.
   Component thuần presentational — logic chơi quản lý ở consumer.
   ============================================================ */
import React, { type HTMLAttributes, type ReactNode } from 'react';
import { MemoryCard, type MemoryCardData, type MemoryCardState } from './memory';
import { PlayerCard, Timer } from './gameHud';

const cn = (...xs: Array<string | false | null | undefined>) =>
  xs.filter(Boolean).join(' ');

/* ============================================================
   CardFlipBoard — grid thẻ + HUD tích hợp
   ============================================================ */

export interface CardFlipBoardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onClick'> {
  /** Mảng thẻ (đã shuffle bởi backend). */
  cards: ReadonlyArray<MemoryCardData & { state?: MemoryCardState }>;
  /** Số cột. Mặc định auto-fit theo số thẻ. */
  columns?: number;
  /** Custom ornament cho mặt sau toàn bộ thẻ. */
  backOrnament?: ReactNode;
  /** Disable toàn board (vd. khi đang chờ animation). */
  disabled?: boolean;
  /** Callback khi click 1 thẻ úp. */
  onCardClick?: (id: string) => void;
}

export function CardFlipBoard({
  cards,
  columns,
  backOrnament,
  disabled,
  onCardClick,
  className,
  style,
  ...rest
}: CardFlipBoardProps) {
  const auto = Math.max(2, Math.ceil(Math.sqrt(cards.length)));
  const cols = columns ?? auto;

  return (
    <div
      className={cn(
        'memory-board',
        cols >= 7 ? 'dense-7' : cols === 6 ? 'dense-6' : cols === 5 ? 'dense-5' : null,
        className,
      )}
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        ...style,
      }}
      {...rest}
    >
      {cards.map((c) => (
        <MemoryCard
          key={c.id}
          card={c}
          state={c.state ?? 'hidden'}
          disabled={disabled}
          backOrnament={backOrnament}
          onClick={() => onCardClick?.(c.id)}
        />
      ))}
    </div>
  );
}

/* ============================================================
   CardFlipHUD — hiển thị 2 player + điểm
   ============================================================ */

export interface CardFlipHUDProps extends HTMLAttributes<HTMLDivElement> {
  /** Tên người chơi A (bạn). */
  playerAName: string;
  /** Điểm người chơi A. */
  playerAScore: number;
  /** Tên người chơi B (đối thủ hoặc AI). */
  playerBName: string;
  /** Điểm người chơi B. */
  playerBScore: number;
  /** Người đang đến lượt (userId hoặc 'AI'). */
  currentTurn: string;
  /** userId của người chơi hiện tại (để xác định active). */
  myUserId: string;
  /** Thời gian đã trôi qua (giây) — dùng cho fallback. */
  timeElapsed: number;
  playerAAvatar?: string;
  playerBAvatar?: string;
  // ---- Đồng hồ theo chế độ ----
  /** Chế độ chơi. */
  mode?: 'basic' | 'advanced';
  /** Cơ bản: thời gian chung còn lại (giây) + tổng để vẽ ring. */
  basicSecondsLeft?: number;
  basicTotal?: number;
  /** Nâng cao: quỹ giờ còn lại từng người (giây). */
  playerAClock?: number;
  playerBClock?: number;
  /** Slot bổ sung bên trong HUD (vd: nút thoát ở landscape). */
  children?: ReactNode;
}

/** Định dạng giây → mm:ss cho chip đồng hồ */
function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}

/** Chip đồng hồ nhỏ hiển thị quỹ giờ một người (chế độ Nâng cao) */
function ClockChip({ seconds, active }: { seconds: number; active: boolean }) {
  const danger = seconds <= 5;
  return (
    <div className={cn('cf-clock-chip', active && 'active', danger && 'danger')}>
      ⏱ {fmtClock(seconds)}
    </div>
  );
}

export function CardFlipHUD({
  playerAName,
  playerAScore,
  playerBName,
  playerBScore,
  currentTurn,
  myUserId,
  timeElapsed,
  playerAAvatar,
  playerBAvatar,
  mode = 'basic',
  basicSecondsLeft,
  basicTotal,
  playerAClock,
  playerBClock,
  children,
  className,
  ...rest
}: CardFlipHUDProps) {
  const isMyTurn = currentTurn === myUserId;

  return (
    <div
      className={cn('game-hud', `cf-hud-${mode}`, className)}
      style={{ width: '100%', maxWidth: 600 }}
      {...rest}
    >
      <div className="cf-hud-side">
        <PlayerCard
          name={playerAName}
          avatar={playerAAvatar}
          score={playerAScore}
          active={isMyTurn}
        />
        {mode === 'advanced' && playerAClock != null && (
          <ClockChip seconds={playerAClock} active={isMyTurn} />
        )}
      </div>

      {mode === 'basic' ? (
        <Timer
          seconds={basicSecondsLeft ?? timeElapsed}
          total={basicTotal}
          mode="countdown"
        />
      ) : (
        // Nâng cao: đồng hồ trung tâm hiển thị quỹ giờ của người ĐANG đến lượt
        <Timer
          seconds={(isMyTurn ? playerAClock : playerBClock) ?? 0}
          mode="countdown"
        />
      )}

      <div className="cf-hud-side">
        <PlayerCard
          name={playerBName}
          avatar={playerBAvatar}
          score={playerBScore}
          active={!isMyTurn}
        />
        {mode === 'advanced' && playerBClock != null && (
          <ClockChip seconds={playerBClock} active={!isMyTurn} />
        )}
      </div>

      {children}
    </div>
  );
}

/* ============================================================
   Helpers
   ============================================================ */

/**
 * Chuyển đổi CardFlipCard[] từ backend thành MemoryCardData[] cho UI.
 * Mapping: type='emoji' → MemoryCardType='text', type='image' → 'image'.
 */
export function cardFlipToMemoryData(
  cards: Array<{ id: number; pairId: number; value: string; type?: 'emoji' | 'image'; flipped: boolean; matched: boolean }>,
): Array<MemoryCardData & { state: MemoryCardState }> {
  return cards.map((c) => ({
    id: String(c.id),
    pairId: String(c.pairId),
    content: c.value,
    type: c.type === 'image' ? ('image' as const) : ('text' as const),
    state: c.matched ? 'matched' : c.flipped ? 'revealed' : 'hidden',
  }));
}
