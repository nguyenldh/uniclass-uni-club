/* ============================================================
   Game State Overlay — Win / Lose / Draw / Idle
   Hiển thị popup kết quả sau khi game kết thúc.
   ============================================================ */
import React, {
  type HTMLAttributes,
  type ReactNode,
  useMemo,
} from 'react';
import { TrophyIcon } from '../icons';

const cn = (...xs: Array<string | false | null | undefined>) =>
  xs.filter(Boolean).join(' ');

export type GameOverlayState = 'win' | 'lose' | 'draw' | 'idle';

export interface GameOverlayStat {
  /** Nhãn (vd: "Thời gian", "Lượt", "Sao"). */
  label: ReactNode;
  /** Giá trị (vd: "1:23", "12", "+250"). */
  value: ReactNode;
}

export interface GameStateOverlayProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  state: GameOverlayState;
  /** Tiêu đề lớn — nếu omit, dùng default theo state. */
  title?: ReactNode;
  /** Phụ đề bên dưới title. */
  subtitle?: ReactNode;
  /** Mảng stats hiển thị 3 ô (Thời gian / Sao / Streak ...). */
  stats?: ReadonlyArray<GameOverlayStat>;
  /** Action buttons (vd: <GameButton>Chơi lại</GameButton>). */
  actions?: ReactNode;
  /** Hiển thị confetti khi state='win' (mặc định true). */
  confetti?: boolean;
}

const DEFAULT_TITLES: Record<GameOverlayState, string> = {
  win:  'CHIẾN THẮNG!',
  lose: 'THUA MẤT RỒI!',
  draw: 'HÒA',
  idle: 'SẴN SÀNG CHƯA?',
};

const DEFAULT_SUBS: Record<GameOverlayState, string> = {
  win:  'Cùng nhận phần thưởng nào!',
  lose: 'Đừng nản — thử lại lần nữa nhé.',
  draw: 'Trận này quá kịch tính!',
  idle: 'Bấm Bắt đầu để vào trận.',
};

const CONFETTI_COLORS = ['#e8530e', '#f6c344', '#2bb673', '#2f8fd6', '#fff'];

export function GameStateOverlay({
  state,
  title,
  subtitle,
  stats,
  actions,
  confetti = true,
  className,
  ...rest
}: GameStateOverlayProps) {
  // Generate confetti positions only once per mount (and only for win)
  const confettiPieces = useMemo(() => {
    if (state !== 'win' || !confetti) return [];
    return Array.from({ length: 28 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 1.6,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      rotate: Math.random() * 360,
    }));
  }, [state, confetti]);

  return (
    <div className="game-overlay-backdrop">
      <div className={cn('game-overlay', state, className)} {...rest}>
        {state === 'win' && confetti && (
          <div className="confetti" aria-hidden>
            {confettiPieces.map((p, i) => (
              <span
                key={i}
                style={{
                  left: `${p.left}%`,
                  animationDelay: `${p.delay}s`,
                  background: p.color,
                  transform: `rotate(${p.rotate}deg)`,
                }}
              />
            ))}
          </div>
        )}

        {state === 'win' && (
          <div className="crown" aria-hidden>
            <TrophyIcon size={64} />
          </div>
        )}

        <h3>{title ?? DEFAULT_TITLES[state]}</h3>
        <div className="sub">{subtitle ?? DEFAULT_SUBS[state]}</div>

        {stats && stats.length > 0 && (
          <div className="stats">
            {stats.slice(0, 3).map((s, i) => (
              <div key={i} className="stat">
                <div className="k">{s.label}</div>
                <div className="v">{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {actions && <div className="actions">{actions}</div>}
      </div>
    </div>
  );
}
