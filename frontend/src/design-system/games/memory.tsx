/* ============================================================
   Mini-game · Lật thẻ (Memory / Match pairs)
   Card có 3 trạng thái: hidden / revealed / matched.
   Animation flip 3D, matched có viền xanh + check.
   Component thuần presentational — matching logic ở consumer.
   ============================================================ */
import React, {
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { CheckIcon, StarIcon } from '../icons';

const cn = (...xs: Array<string | false | null | undefined>) =>
  xs.filter(Boolean).join(' ');

export type MemoryCardState = 'hidden' | 'revealed' | 'matched';

/** Loại nội dung — quyết định cách render mặt trước. */
export type MemoryCardType = 'text' | 'color' | 'image' | 'custom';

export interface MemoryCardData {
  id: string;
  /** Cặp ID — 2 thẻ có pairId giống nhau khớp được với nhau. */
  pairId: string;
  /** Loại nội dung. Default = 'text'. */
  type?: MemoryCardType;
  /**
   * Nội dung:
   *  - text:  string (vd: "7", "Mèo", "3+4")
   *  - color: CSS color (vd: "#e8530e")
   *  - image: URL ảnh
   *  - custom: ReactNode tuỳ ý
   */
  content: string | ReactNode;
}

/* ============================================================
   Card
   ============================================================ */

export interface MemoryCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onClick'> {
  card: MemoryCardData;
  state?: MemoryCardState;
  disabled?: boolean;
  /** Click vào thẻ úp để lật. Không gọi nếu state ≠ 'hidden'. */
  onClick?: () => void;
  /** Custom ornament cho mặt sau (vd. logo Uniclass). Mặc định ⭐. */
  backOrnament?: ReactNode;
}

export function MemoryCard({
  card,
  state = 'hidden',
  disabled,
  onClick,
  backOrnament,
  className,
  style,
  ...rest
}: MemoryCardProps) {
  const handleClick = () => {
    if (disabled || state !== 'hidden') return;
    onClick?.();
  };

  const type = card.type ?? 'text';
  const frontStyle: CSSProperties =
    type === 'color' && typeof card.content === 'string'
      ? ({ ['--c' as never]: card.content } as CSSProperties)
      : {};

  return (
    <div
      className={cn(
        'memory-card-wrap',
        state,
        disabled && 'disabled',
        className,
      )}
      onClick={handleClick}
      role="button"
      tabIndex={state === 'hidden' && !disabled ? 0 : -1}
      aria-label={state === 'hidden' ? 'Thẻ úp' : `Thẻ ${card.pairId}`}
      style={style}
      {...rest}
    >
      <div className="memory-card">
        {/* Back (face-down) */}
        <div className="memory-face memory-back">
          <span
            className="ornament"
            style={{
              fontSize: 'clamp(18px, 30cqw, 48px)',
              display: 'inline-flex',
            }}
          >
            {backOrnament ?? <img src="/images/card/card-back.png" alt="Card back" width={36} />}
          </span>
        </div>

        {/* Front */}
        <div
          className={cn('memory-face', 'memory-front', type === 'color' && 'color')}
          style={frontStyle}
        >
          {type === 'image' && typeof card.content === 'string' && (
            <img src={card.content} alt="" />
          )}
          {type === 'text' && card.content}
          {type === 'custom' && card.content}
          {/* color: chỉ hiện màu nền, không có nội dung text */}
        </div>
      </div>

      {/* Checkmark — sibling of .memory-card so it stays in fixed position
          regardless of card's rotateY transform. */}
      {state === 'matched' && (
        <span className="memory-checkmark" aria-hidden>
          <CheckIcon size={16} color="#fff" />
        </span>
      )}
    </div>
  );
}

/* ============================================================
   Board
   ============================================================ */

export interface MemoryBoardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onClick'> {
  /** Mảng thẻ (đã shuffle bởi consumer). */
  cards: ReadonlyArray<MemoryCardData & { state?: MemoryCardState }>;
  /** Số cột. Mặc định auto-fit theo số thẻ. */
  columns?: number;
  /** Custom ornament cho mặt sau toàn bộ thẻ. */
  backOrnament?: ReactNode;
  /** Disable toàn board (vd. khi đang flip 2 thẻ chờ match). */
  disabled?: boolean;
  /** Callback khi click 1 thẻ úp. */
  onCardClick?: (id: string) => void;
}

export function MemoryBoard({
  cards,
  columns,
  backOrnament,
  disabled,
  onCardClick,
  className,
  style,
  ...rest
}: MemoryBoardProps) {
  // Auto columns: square-ish layout
  const auto = Math.max(2, Math.ceil(Math.sqrt(cards.length)));
  const cols = columns ?? auto;
  // Số hàng thực tế — để CSS (landscape) suy bề rộng bàn giữ thẻ đúng tỉ lệ dọc 3:4.
  const rows = Math.max(1, Math.ceil(cards.length / cols));

  return (
    <div
      className={cn(
        'memory-board',
        cols >= 7 ? 'dense-7' : cols === 6 ? 'dense-6' : cols === 5 ? 'dense-5' : null,
        className,
      )}
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        ['--cf-cols' as string]: cols,
        ['--cf-rows' as string]: rows,
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
   Helpers
   ============================================================ */

/**
 * Tạo bộ thẻ memory từ mảng nội dung. Mỗi item sẽ được duplicate thành 2 thẻ
 * cùng pairId nhưng id khác nhau, và shuffle ngẫu nhiên.
 *
 * @example
 * const cards = makeMemoryDeck([
 *   { content: '🐱', type: 'text' },
 *   { content: '🐶', type: 'text' },
 * ]);
 */
export function makeMemoryDeck(
  items: ReadonlyArray<{
    pairId?: string;
    type?: MemoryCardType;
    content: string | ReactNode;
  }>,
  options?: { shuffle?: boolean }
): MemoryCardData[] {
  const shuffle = options?.shuffle !== false;
  const deck: MemoryCardData[] = [];
  items.forEach((it, i) => {
    const pid = it.pairId ?? `pair-${i}`;
    deck.push({ id: `${pid}-a`, pairId: pid, type: it.type, content: it.content });
    deck.push({ id: `${pid}-b`, pairId: pid, type: it.type, content: it.content });
  });
  if (shuffle) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }
  return deck;
}

/** Bộ preset cấp độ. */
export const MEMORY_LEVELS = {
  easy:   { pairs: 6,  columns: 4 },
  medium: { pairs: 8,  columns: 4 },
  hard:   { pairs: 10, columns: 5 },
  expert: { pairs: 12, columns: 6 },
} as const;
export type MemoryLevel = keyof typeof MEMORY_LEVELS;

/* ============================================================
   Flip Demo — animation sequence: Card 1 lật → Card 2 lật → cả 2 matched
   ============================================================ */

export interface MemoryFlipDemoProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'content'> {
  /** Nội dung cặp thẻ (mặc định "A"). */
  content?: string | ReactNode;
  /** Kích thước mỗi thẻ (px), mặc định 90. */
  cardSize?: number;
  /** Thời gian delay giữa các bước (ms), mặc định 800. */
  stepDelay?: number;
  /** Tự động lặp lại (mặc định true). */
  loop?: boolean;
}

type FlipPhase = 'idle' | 'first-revealed' | 'second-revealed' | 'matched';

export function MemoryFlipDemo({
  content = 'A',
  cardSize = 90,
  stepDelay = 800,
  loop = true,
  className,
  style,
  ...rest
}: MemoryFlipDemoProps) {
  const [phase, setPhase] = useState<FlipPhase>('idle');

  const run = useCallback(() => {
    setPhase('idle');
    const t1 = setTimeout(() => setPhase('first-revealed'), stepDelay);
    const t2 = setTimeout(() => setPhase('second-revealed'), stepDelay * 2);
    const t3 = setTimeout(() => setPhase('matched'), stepDelay * 3);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [stepDelay]);

  useEffect(() => {
    const intervalRef = { current: undefined as (() => void) | undefined };

    const doRun = () => {
      intervalRef.current?.();
      intervalRef.current = run();
    };

    doRun();
    if (!loop) return intervalRef.current;

    const interval = setInterval(doRun, stepDelay * 4 + 400);

    return () => {
      clearInterval(interval);
      intervalRef.current?.();
    };
  }, [run, loop, stepDelay]);

  const card: MemoryCardData = {
    id: 'demo',
    pairId: 'demo',
    type: 'text',
    content,
  };

  const state1: MemoryCardState =
    phase === 'matched' ? 'matched' :
    phase === 'first-revealed' || phase === 'second-revealed' ? 'revealed' :
    'hidden';

  const state2: MemoryCardState =
    phase === 'matched' ? 'matched' :
    phase === 'second-revealed' ? 'revealed' :
    'hidden';

  return (
    <div
      className={cn('memory-flip-demo', className)}
      style={{ display: 'flex', gap: 16, alignItems: 'center', ...style }}
      {...rest}
    >
      <MemoryCard card={card} state={state1} style={{ width: cardSize }} />
      <MemoryCard card={card} state={state2} style={{ width: cardSize }} />
    </div>
  );
}
