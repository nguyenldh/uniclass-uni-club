/* ============================================================
   Mini-game · Caro (X-O / Gomoku)
   Board kích thước có thể mở rộng (3, 5, 10, 15, 20).
   Component thuần presentational — logic chơi quản lý ở consumer.
   ============================================================ */
import React, {
  type HTMLAttributes,
  type ReactNode,
} from 'react';

const cn = (...xs: Array<string | false | null | undefined>) =>
  xs.filter(Boolean).join(' ');

/** Giá trị 1 ô — 'X', 'O', hoặc null (chưa đặt). */
export type CaroValue = 'X' | 'O' | null;

/** Toạ độ [row, col] (0-indexed). */
export type CaroCoord = [number, number];

/** Đường thắng — vẽ 1 line từ ô đầu đến ô cuối. */
export interface CaroWinInfo {
  from: CaroCoord;
  to: CaroCoord;
  /** Tất cả các ô thuộc đường thắng (highlight). */
  cells?: CaroCoord[];
}

/* ============================================================
   X / O mark — SVG có animation stroke draw
   ============================================================ */

export interface CaroMarkProps {
  /** Kích thước hiển thị (px), mặc định 100. Không ảnh hưởng nội dung bên trong. */
  size?: number;
}

/** Dấu X — màu cam thương hiệu, animation 2 nét vẽ chéo. */
export function CaroX({ size = 100 }: CaroMarkProps) {
  return (
    <svg className="caro-x" viewBox="0 0 100 100" width={size} height={size} aria-label="X">
      <path d="M 20 20 L 80 80" />
      <path d="M 80 20 L 20 80" />
    </svg>
  );
}

/** Dấu O — màu xanh, animation vẽ vòng tròn. */
export function CaroO({ size = 100 }: CaroMarkProps) {
  return (
    <svg className="caro-o" viewBox="0 0 100 100" width={size} height={size} aria-label="O">
      <circle cx="50" cy="50" r="32" />
    </svg>
  );
}

/* ============================================================
   Cell
   ============================================================ */

export interface CaroCellProps {
  value: CaroValue;
  /** Highlight (thuộc đường thắng). */
  win?: boolean;
  /** Hiển thị chấm cam ở góc (đánh dấu nước cuối). */
  lastMove?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export function CaroCell({ value, win, lastMove, disabled, onClick }: CaroCellProps) {
  const placed = value != null;
  return (
    <button
      type="button"
      className={cn(
        'caro-cell',
        placed && 'placed',
        win && 'win',
        disabled && 'disabled',
      )}
      onClick={placed || disabled ? undefined : onClick}
      disabled={disabled || placed}
      aria-label={value ? `Ô ${value}` : 'Ô trống'}
    >
      {value === 'X' && <CaroX />}
      {value === 'O' && <CaroO />}
      {lastMove && <span className="last-pin" aria-hidden />}
    </button>
  );
}

/* ============================================================
   Board
   ============================================================ */

export interface CaroBoardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onClick'> {
  /** Ma trận giá trị size×size. Mặc định 5×5 trống. */
  cells: CaroValue[][];
  /** Toạ độ nước đi cuối — sẽ hiển thị chấm cam ở góc ô. */
  lastMove?: CaroCoord | null;
  /** Đường thắng — vẽ line + highlight các ô trong cells. */
  win?: CaroWinInfo | null;
  /** Disable toàn bộ board (vd: khi đã có winner). */
  disabled?: boolean;
  /** Callback khi click ô trống. */
  onCellClick?: (row: number, col: number) => void;
}

export function CaroBoard({
  cells,
  lastMove,
  win,
  disabled,
  onCellClick,
  className,
  style,
  ...rest
}: CaroBoardProps) {
  const size = cells.length;
  const winSet = new Set((win?.cells ?? []).map(([r, c]) => `${r},${c}`));
  const isLast = (r: number, c: number) =>
    lastMove != null && lastMove[0] === r && lastMove[1] === c;

  return (
    <div
      className={cn('caro-board', className)}
      data-size={size}
      style={{
        gridTemplateColumns: `repeat(${size}, var(--cell, 56px))`,
        margin: "auto",
        ...style,
      }}
      {...rest}
    >
      {cells.flatMap((row, r) =>
        row.map((v, c) => (
          <CaroCell
            key={`${r}-${c}`}
            value={v}
            win={winSet.has(`${r},${c}`)}
            lastMove={isLast(r, c)}
            disabled={disabled}
            onClick={() => onCellClick?.(r, c)}
          />
        ))
      )}

      {win && <CaroWinLine size={size} from={win.from} to={win.to} />}
    </div>
  );
}

/* ============================================================
   Winning line overlay
   ============================================================ */

interface CaroWinLineProps {
  size: number;
  from: CaroCoord;
  to: CaroCoord;
}

/**
 * SVG line chạy xuyên qua các ô thắng, vẽ animation từ đầu đến cuối.
 * Toạ độ tính theo % có tính đến padding & gap của board để khớp chính xác tâm ô.
 */
function CaroWinLine({ size, from, to }: CaroWinLineProps) {
  // Phải khớp với CSS: padding 14px, gap 4px, và bảng mapping data-size → --cell
  const PAD = 14;
  const GAP = 4;
  const cellBySize: Record<number, number> = { 3: 92, 5: 64, 10: 44, 15: 32, 20: 26 };
  const cell = cellBySize[size] ?? 56;
  const total = PAD * 2 + size * cell + (size - 1) * GAP;

  // Tâm ô thứ i (tính bằng px từ mép trái/trên của board) → % của tổng kích thước board
  const pct = (i: number) => ((PAD + i * (cell + GAP) + cell / 2) / total) * 100;

  const [r1, c1] = from;
  const [r2, c2] = to;
  return (
    <svg
      className="caro-win-line"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <line
        x1={pct(c1)} y1={pct(r1)}
        x2={pct(c2)} y2={pct(r2)}
      />
    </svg>
  );
}

/* ============================================================
   Helpers
   ============================================================ */

/** Tạo ma trận trống size×size. */
export function makeCaroCells(size: number): CaroValue[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null as CaroValue)
  );
}

/** Bộ icon dùng cho HUD (mark X/O nhỏ bên cạnh tên player). */
export function CaroMarkPill({ mark }: { mark: 'X' | 'O' }) {
  return (
    <span className={cn('pc-mark', mark === 'X' ? 'x' : 'o')} aria-label={mark}>
      {mark}
    </span>
  );
}

/** Re-export sang tên thân thiện. */
export const CaroXMark = CaroX;
export const CaroOMark = CaroO;

/** Mặc định cho consumers chưa quyết kích thước. */
export const DEFAULT_CARO_SIZE = 5;
export const CARO_SIZES = [3, 5, 10, 15, 20] as const;
export type CaroSize = typeof CARO_SIZES[number];
