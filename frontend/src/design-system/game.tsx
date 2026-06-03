/* ============================================================
   Game UI Components — Nunito, 2.5D wood-kraft style (TypeScript)
   ============================================================ */
import React, {
  type HTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
  type FormEvent,
  useState,
  useCallback,
} from 'react';
import {
  StarIcon, CoinIcon, FlameIcon, TrophyIcon, ChestIcon,
  SparkIcon, SendIcon, CheckIcon, LockIcon, ChatIcon,
} from './icons';
import { AvatarImage } from '../components/AvatarImage';

const cn = (...xs: Array<string | false | null | undefined>) =>
  xs.filter(Boolean).join(' ');

/* ============================================================
   Atoms — Wood, Banner, Sign, Stamp, Speech, AvatarFrame
   ============================================================ */

export interface WoodPanelProps extends HTMLAttributes<HTMLDivElement> {
  /** light = kraft sáng, dark = nâu đậm */
  variant?: 'light' | 'dark';
  /** Hiển thị 4 đinh tán góc */
  studs?: boolean;
}

/** Wood plank panel with optional 4 corner studs (đinh tán). */
export function WoodPanel({
  variant = 'light',
  studs = true,
  className,
  children,
  ...rest
}: WoodPanelProps) {
  const tex = variant === 'dark' ? 'wood-tex-dark' : 'wood-tex';
  return (
    <div className={cn('wood', tex, className)} {...rest}>
      {studs && (
        <>
          <span className="stud tl" />
          <span className="stud tr" />
          <span className="stud bl" />
          <span className="stud br" />
        </>
      )}
      {children}
    </div>
  );
}

export interface BannerProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'md' | 'sm';
  variant?: 'brown' | 'cream';
  /** Hiển thị 2 dây thừng treo phía trên (chỉ cho variant brown). */
  rope?: boolean;
}

/** Banner — wood plank, có thể treo bằng dây thừng. */
export function Banner({
  size = 'md',
  variant = 'brown',
  rope = true,
  children,
  className,
  ...rest
}: BannerProps) {
  const showRope = rope && variant !== 'cream';
  const banner = (
    <div
      className={cn('banner', size === 'sm' && 'sm', variant === 'cream' && 'cream', className)}
      {...rest}
    >
      {showRope && (
        <>
          <span className="rope l" />
          <span className="rope r" />
        </>
      )}
      {children}
    </div>
  );
  return showRope ? <div className="banner-wrap">{banner}</div> : banner;
}

export interface SignProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
}
/** Hanging sign (biển báo gỗ trên cọc). */
export function Sign({ children, ...rest }: SignProps) {
  return <span className="sign" {...rest}>{children}</span>;
}

export interface StampProps extends HTMLAttributes<HTMLSpanElement> {
  children?: ReactNode;
}
/** Rotated rubber stamp. */
export function Stamp({ children = 'HOÀN THÀNH', ...rest }: StampProps) {
  return <span className="stamp" {...rest}>{children}</span>;
}

export interface SpeechProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
}
/** Speech bubble — for tips, mascot lines. */
export function Speech({ children, ...rest }: SpeechProps) {
  return <span className="speech" {...rest}>{children}</span>;
}

export interface AvatarFrameProps extends HTMLAttributes<HTMLSpanElement> {
  size?: 'md' | 'lg';
  /** Badge số ở góc (cấp độ / streak). */
  badge?: ReactNode;
  children: ReactNode;
}
/** Circular wooden avatar frame with optional badge. */
export function AvatarFrame({ size = 'md', badge, children, ...rest }: AvatarFrameProps) {
  return (
    <div className={cn('av-frame', size === 'lg' && 'lg')} {...rest}>
      {children}
      {badge != null && <span className="badge">{badge}</span>}
    </div>
  );
}

/* ============================================================
   Buttons & pills
   ============================================================ */

export type GameButtonColor = 'orange' | 'green' | 'blue' | 'red' | 'ghost';
export type GameButtonSize = 'sm' | 'md' | 'lg';

export interface GameButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  color?: GameButtonColor;
  size?: GameButtonSize;
  /** Trạng thái nhấn — thụt nút xuống 4px. */
  pressed?: boolean;
  /** Icon trước label. */
  icon?: ReactNode;
}

/** Game button — chunky 3D với inset highlight + drop shadow cứng.
 *  Khi click: hiệu ứng nhấn (pressed) → delay 150ms → thực thi action. */
export function GameButton({
  color = 'orange',
  size = 'md',
  pressed: pressedProp = false,
  disabled = false,
  icon,
  children,
  className,
  onClick,
  ...rest
}: GameButtonProps) {
  const [internalPressed, setInternalPressed] = useState(false);
  const isPressed = pressedProp || internalPressed;

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled || !onClick) return;
      setInternalPressed(true);
      setTimeout(() => {
        setInternalPressed(false);
        onClick(e);
      }, 250);
    },
    [disabled, onClick],
  );

  const colorClass: Record<GameButtonColor, string | null> = {
    orange: null,
    green: 'gbtn-success',
    blue:  'gbtn-blue',
    red:   'gbtn-red',
    ghost: 'gbtn-ghost',
  };
  const sizeClass = size !== 'md' ? `gbtn-${size}` : null;
  return (
    <button
      className={cn(
        'gbtn',
        colorClass[color], sizeClass,
        isPressed && 'is-pressed',
        disabled && 'is-disabled',
        className
      )}
      disabled={disabled}
      onClick={handleClick}
      {...rest}
    >
      {icon && <span className="ico">{icon}</span>}
      {children}
    </button>
  );
}

export type GamePillTone = 'gold' | 'green' | 'red' | 'blue';

export interface GamePillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: GamePillTone;
  icon?: ReactNode;
  children: ReactNode;
}

/** Score pill — round icon + label. */
export function GamePill({ tone = 'gold', icon, children, className, ...rest }: GamePillProps) {
  const toneClass = tone !== 'gold' ? tone : null;
  const iconStyle: React.CSSProperties | undefined =
    tone === 'green' || tone === 'red' || tone === 'blue' ? { color: '#fff' } : undefined;
  return (
    <span className={cn('gpill', toneClass, className)} {...rest}>
      <span className="ico" style={iconStyle}>{icon}</span>
      {children}
    </span>
  );
}

/* ============================================================
   Slots + Group board
   ============================================================ */

export type SlotState = 'empty' | 'filled' | 'done' | 'inviting';

export interface SlotProps extends HTMLAttributes<HTMLDivElement> {
  state?: SlotState;
  avatar?: ReactNode;
  name?: ReactNode;
}

/** Member slot trong bảng nhóm. */
export function Slot({ state = 'empty', avatar, name, style, ...rest }: SlotProps) {
  const invitingStyle: React.CSSProperties | undefined = state === 'inviting'
    ? {
        background: 'linear-gradient(180deg,#ffe2b8,var(--o-300))',
        color: 'var(--g-wood-4)',
        animation: 'bobble 1.6s ease-in-out infinite',
        ...style,
      }
    : style;
  return (
    <div className={cn('slot', state)} style={invitingStyle} {...rest}>
      <div className="av">{avatar}</div>
      {name}
      {state === 'done' && (
        <span className="check">
          <CheckIcon size={14} />
        </span>
      )}
    </div>
  );
}

export interface GroupBoardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** Group board — wood plank background với 4 đinh tán. */
export function GroupBoard({ children, className, ...rest }: GroupBoardProps) {
  return (
    <div className={cn('group-board', className)} {...rest}>
      <span className="stud tl" />
      <span className="stud tr" />
      <span className="stud bl" />
      <span className="stud br" />
      {children}
    </div>
  );
}

/** A 3-column grid for slots (place as direct child of GroupBoard). */
export function SlotGrid({ children }: { children: ReactNode }) {
  return <div className="slot-grid">{children}</div>;
}

/* ============================================================
   Streak / progress
   ============================================================ */

export interface StreakProps {
  /** Bước hiện tại (0..total). */
  value?: number;
  /** Tổng số bước. */
  total?: number;
  showFlame?: boolean;
  showTrophy?: boolean;
}

/** Streak bar — flame indicator at fill %, trophy at end. */
export function Streak({
  value = 0,
  total = 10,
  showFlame = true,
  showTrophy = true,
}: StreakProps) {
  const pct = Math.max(0, Math.min(100, (value / total) * 100));
  const markers = Array.from({ length: total }, (_, i) => i < value);
  return (
    <div className="streak">
      <div className="fill" style={{ width: `${pct}%` }} />
      <div className="markers">
        {markers.map((done, i) => (
          <span key={i} className={cn('m', done && 'done')} />
        ))}
      </div>
      {showFlame && (
        <FlameIcon
          size={44}
          style={{
            position: 'absolute',
            left: `calc(${pct}% - 22px)`,
            top: -30,
            height: 50,
            filter: 'drop-shadow(0 4px 4px rgba(255,90,0,.4))',
            pointerEvents: 'none',
          }}
        />
      )}
      {showTrophy && (
        <TrophyIcon
          size={54}
          style={{
            position: 'absolute',
            right: -26,
            top: -22,
            filter: 'drop-shadow(0 3px 4px rgba(0,0,0,.25))',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}

/* ============================================================
   Chat
   ============================================================ */

export interface ChatProps {
  title?: ReactNode;
  children?: ReactNode;
  /** Có hiển thị ô soạn tin không. */
  composer?: boolean;
  /** Callback khi user submit (chỉ gọi khi composer = true). */
  onSend?: (message: string) => void;
}

export function Chat({ children, title = 'Trò chuyện', onSend, composer = true }: ChatProps) {
  const [val, setVal] = React.useState('');
  const submit = (e?: FormEvent) => {
    e?.preventDefault?.();
    const trimmed = val.trim();
    if (trimmed && onSend) onSend(trimmed);
    setVal('');
  };
  return (
    <div className="chat">
      <div className="head">
        <ChatIcon size={16} color="#fff" />
        {title}
      </div>
      {children}
      {composer && (
        <form className="composer" onSubmit={submit}>
          <input
            placeholder="Nhập tin nhắn..."
            value={val}
            onChange={(e) => setVal(e.target.value)}
          />
          <button type="submit" className="send" aria-label="Send">
            <SendIcon size={14} />
          </button>
        </form>
      )}
    </div>
  );
}

export interface ChatMessageProps {
  who: ReactNode;
  children: ReactNode;
}

export function ChatMessage({ who, children }: ChatMessageProps) {
  return (
    <div className="msg">
      <span className="who">{who}:</span> {children}
    </div>
  );
}

/* ============================================================
   Map
   ============================================================ */

export interface MapCanvasProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

/** Map canvas — sand-coloured frame with sun + dunes. */
export function MapCanvas({ children, className, ...rest }: MapCanvasProps) {
  return (
    <div className={cn('map-canvas', className)} {...rest}>
      <div className="sun" />
      <div className="dune l" />
      <div className="dune r" />
      {children}
    </div>
  );
}

export interface MapPathProps {
  /** SVG `d` attribute (toạ độ trong viewBox 800×340). */
  d: string;
}

/** Dashed path running through node centers (viewBox 800×340). */
export function MapPath({ d }: MapPathProps) {
  return (
    <svg className="map-path" viewBox="0 0 800 340" preserveAspectRatio="none">
      <path
        d={d}
        stroke="#fff"
        strokeWidth="5"
        strokeDasharray="10 12"
        strokeLinecap="round"
        fill="none"
        opacity=".9"
      />
    </svg>
  );
}

export type MapNodeState = 'done' | 'current' | 'locked' | 'upcoming';

export interface MapNodeProps {
  /** Vị trí ngang theo % của map width. */
  left: number;
  /** Vị trí dọc theo % của map height. */
  top: number;
  state?: MapNodeState;
  /** Nội dung hiển thị (chỉ current/upcoming). */
  label?: ReactNode;
}

/** Node positioned by %. State: done | current | locked | upcoming. */
export function MapNode({ left, top, state = 'upcoming', label }: MapNodeProps) {
  return (
    <div className="node-pos" style={{ left: `${left}%`, top: `${top}%` }}>
      <div className={cn('node', state !== 'upcoming' && state)}>
        {state === 'current' && <span className="pin" />}
        {state === 'done' && <CheckIcon size={22} color="#fff" />}
        {state === 'locked' && <LockIcon size={20} color="rgba(0,0,0,.4)" />}
        {(state === 'current' || state === 'upcoming') && (label ?? '')}
      </div>
    </div>
  );
}

export interface CactusProps {
  /** Vị trí ngang theo % của map width. */
  left: number;
}

/** Cactus decoration positioned by left %. */
export function Cactus({ left }: CactusProps) {
  return <div className="cactus" style={{ left: `${left}%` }} />;
}

/* ============================================================
   Treasure popup
   ============================================================ */

export interface TreasureReward {
  emoji?: string;
  icon?: ReactNode;
  name: ReactNode;
  desc?: ReactNode;
  /** true = đã mở khoá, false/undefined = bị khoá (hiển thị 🔒). */
  unlocked?: boolean;
}

export interface TreasurePopupProps {
  ribbon?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  rewards?: ReadonlyArray<TreasureReward>;
  actions?: ReactNode;
  /** Hiển thị sparkles trang trí (mặc định true). */
  sparkles?: boolean;
}

/** Treasure / reward modal — ribbon ở trên, rewards grid, actions bên dưới. */
export function TreasurePopup({
  ribbon,
  title,
  subtitle,
  rewards = [],
  actions,
  sparkles = true,
}: TreasurePopupProps) {
  const sparkleStyle = (
    top: number,
    side: 'left' | 'right',
    offset: number,
  ): React.CSSProperties => ({
    position: 'absolute',
    top,
    [side]: offset,
    color: '#fff',
    filter: 'drop-shadow(0 1px 0 var(--g-gold))',
  });

  return (
    <div className="treasure-popup">
      {ribbon && <span className="ribbon">{ribbon}</span>}

      {sparkles && (
        <>
          <SparkIcon size={18} style={sparkleStyle(18, 'left', 24)} />
          <SparkIcon size={14} style={sparkleStyle(30, 'right', 32)} />
          <SparkIcon size={12} style={sparkleStyle(70, 'left', 18)} />
        </>
      )}

      {title && <h3>{title}</h3>}
      {subtitle && <div className="sub">{subtitle}</div>}

      {rewards.length > 0 && (
        <div className="reward-row">
          {rewards.map((r, i) => (
            <div key={i} className={cn('reward', r.unlocked && 'unlocked')}>
              {r.icon ?? <div className="icn">{r.emoji}</div>}
              <div className="nm">{r.name}</div>
              {r.desc && <div className="ds">{r.desc}</div>}
              {!r.unlocked && (
                <span className="lock"><LockIcon size={12} color="#fff" /></span>
              )}
            </div>
          ))}
        </div>
      )}

      {actions && (
        <div
          style={{
            marginTop: 24,
            display: 'flex',
            gap: 12,
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Game canvas (sky background container)
   ============================================================ */

export interface GameCanvasProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

export function GameCanvas({ children, className, ...rest }: GameCanvasProps) {
  return <div className={cn('game-canvas', className)} {...rest}>{children}</div>;
}

/* ============================================================
   Matchmaking Panel — Đang tìm trận / Tìm trận thành công
   ============================================================ */

export type MatchmakingState = 'searching' | 'found';

export interface MatchmakingPlayer {
  name: string;
  /** Avatar content — text, emoji, <img>, hoặc ReactNode bất kỳ. Mặc định là ký tự đầu của name. */
  avatar?: string | ReactNode;
  /** CSS background cho avatar frame (override gradient mặc định). */
  avatarBg?: string;
  /** Cấp / streak hiển thị ở góc avatar. */
  level?: ReactNode;
  /** Dòng phụ dưới name (vd. "LỚP 4A1 · 1.250 ⭐"). */
  sublabel?: ReactNode;
}

export interface MatchmakingPanelProps extends HTMLAttributes<HTMLDivElement> {
  /** Trạng thái: 'searching' (đang tìm) | 'found' (đã ghép). Mặc định 'searching'. */
  state?: MatchmakingState;
  me: MatchmakingPlayer;
  /** Đối thủ — chỉ dùng khi state='found'. */
  opponent?: MatchmakingPlayer;
  /** Giây còn lại (state='searching'). Truyền qua setInterval từ consumer. */
  secondsRemaining?: number;
  /** Tổng giây — dùng để vẽ progress ring. Mặc định 30. */
  totalSeconds?: number;
  searchingTitle?: ReactNode;
  searchingSubtitle?: ReactNode;
  foundTitle?: ReactNode;
  foundSubtitle?: ReactNode;
  /** Actions bên dưới panel (vd. <GameButton>Huỷ</GameButton> hoặc <GameButton>Vào trận</GameButton>). */
  actions?: ReactNode;
  /** Sparkles confetti khi state='found'. Mặc định true. */
  sparkles?: boolean;
}

/** Panel ghép trận — 2 trạng thái: đang tìm (ring đếm ngược + halo) / đã tìm thấy (VS + avatar đối thủ). */
export function MatchmakingPanel({
  state = 'searching',
  me,
  opponent,
  secondsRemaining,
  totalSeconds = 30,
  searchingTitle = 'Đang tìm đối thủ',
  searchingSubtitle = 'Hệ thống đang ghép trận phù hợp với bạn',
  foundTitle = 'Đã ghép được trận!',
  foundSubtitle,
  actions,
  sparkles = true,
  className,
  ...rest
}: MatchmakingPanelProps) {
  const isFound = state === 'found';
  const r = 54;
  const C = 2 * Math.PI * r;
  const remaining =
    typeof secondsRemaining === 'number' ? Math.max(0, secondsRemaining) : totalSeconds;
  const ratio = totalSeconds > 0 ? Math.max(0, Math.min(1, remaining / totalSeconds)) : 1;
  const offset = C * (1 - ratio);
  const ringTone =
    remaining <= 5 ? 'is-danger' : remaining <= 10 ? 'is-warn' : '';

  const renderSlot = (p: MatchmakingPlayer, opts: { revealed?: boolean } = {}) => (
    <div className={cn('mm-slot', opts.revealed && 'is-revealed')}>
      <div className="mm-avatar-wrap">
        <AvatarImage
          src={p.avatar && typeof p.avatar === 'string' ? p.avatar : undefined}
          name={p.name}
          avatarBg={p.avatarBg}
          size="lg"
        />
        {p.level != null && <span className="mm-badge">{p.level}</span>}
      </div>
      <div className="mm-name">{p.name}</div>
      {p.sublabel && <div className="mm-sublabel">{p.sublabel}</div>}
    </div>
  );

  return (
    <div
      className={cn('mm-panel', isFound && 'is-found', className)}
      role="status"
      aria-live="polite"
      {...rest}
    >
      <div className="mm-title">{isFound ? foundTitle : searchingTitle}</div>
      <div className="mm-sub">
        {isFound ? (
          foundSubtitle ?? (
            <>
              {me.name} <span style={{ opacity: 0.5, margin: '0 4px' }}>vs</span>{' '}
              {opponent?.name ?? '...'}
            </>
          )
        ) : (
          <>
            {searchingSubtitle}
            <span className="mm-dots" aria-hidden="true">
              <i /><i /><i />
            </span>
          </>
        )}
      </div>

      <div className="mm-stage">
        {renderSlot(me)}

        <div className="mm-center">
          {isFound ? (
            <span className="mm-vs" key="vs">VS</span>
          ) : (
            <>
              <svg className={cn('mm-ring', ringTone)} viewBox="0 0 120 120" aria-hidden="true">
                <circle className="mm-ring-bg" cx="60" cy="60" r={r} />
                <circle
                  className="mm-ring-fg"
                  cx="60" cy="60" r={r}
                  strokeDasharray={C}
                  strokeDashoffset={offset}
                />
              </svg>
              <div className="mm-ring-label">
                <span className="num">{Math.ceil(remaining)}</span>
                <span className="unit">GIÂY</span>
              </div>
            </>
          )}
        </div>

        {isFound && opponent
          ? renderSlot(opponent, { revealed: true })
          : (
            <div className="mm-slot is-pending">
              <AvatarImage src={undefined} name="?" size="lg" />
              <div className="mm-sublabel">Đang tìm</div>
            </div>
          )}
      </div>

      {isFound && sparkles && (
        <>
          {[
            { top: 22, left: 10, color: '#ffd66b', dx: -28, dy: -8 },
            { top: 30, left: 88, color: '#7fdb6f', dx:  30, dy: -18 },
            { top: 62, left:  6, color: '#e8530e', dx: -22, dy:  14 },
            { top: 70, left: 92, color: '#3a83b3', dx:  28, dy:  12 },
            { top: 16, left: 50, color: '#e8530e', dx:   0, dy: -22 },
            { top: 82, left: 36, color: '#ffd66b', dx: -10, dy:  18 },
          ].map((s, i) => (
            <span
              key={i}
              className="mm-spark"
              style={{
                top: `${s.top}%`,
                left: `${s.left}%`,
                background: s.color,
                ['--dx' as any]: `${s.dx}px`,
                ['--dy' as any]: `${s.dy}px`,
                animationDelay: `${i * 0.05}s`,
              }}
            />
          ))}
        </>
      )}

      {actions && <div className="mm-actions">{actions}</div>}
    </div>
  );
}
