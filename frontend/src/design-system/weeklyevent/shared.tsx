/* ============================================================
   Sự kiện tuần · Reusable components (UI-C-001 … UI-C-010)
     UI-C-001 CountdownTimer        UI-C-006 LeaderboardRow
     UI-C-002 OnlineCounter         UI-C-007 PersonalStatsCard
     UI-C-003 QuestionCard          UI-C-008 GradeRoomBadge
     UI-C-004 ProgressBar           UI-C-009 AutoResumeNotification
     UI-C-005 ConnectionStatus      UI-C-010 DisconnectWarningModal

   Tất cả presentational — state/realtime (socket, server-time sync,
   chấm điểm) do consumer truyền vào qua props (xem FLOW-* / SOCK-EVT-*).
   ============================================================ */
import React, { type ReactNode, type HTMLAttributes } from 'react';
import { AvatarImage } from '../../components/AvatarImage';

const cn = (...xs: Array<string | false | null | undefined>) =>
  xs.filter(Boolean).join(' ');

export const initialOf = (name?: string) =>
  typeof name === 'string' && name.trim() ? name.trim().charAt(0).toUpperCase() : '?';

/** mm:ss / h:mm:ss cho thời lượng. */
export function fmtDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

/* Bảng màu 9 khối — phối từ palette brand/game, mỗi khối 1 sắc. */
export const GRADE_COLORS: string[] = [
  'linear-gradient(135deg,#ff9a6b,#e8530e)', // 1
  'linear-gradient(135deg,#ffd266,#e8a210)', // 2
  'linear-gradient(135deg,#9be38a,#2bb673)', // 3
  'linear-gradient(135deg,#7fcdfa,#2f8fd6)', // 4
  'linear-gradient(135deg,#a3b4ff,#4b5ee8)', // 5
  'linear-gradient(135deg,#d3b6ff,#7a4fe6)', // 6
  'linear-gradient(135deg,#ff9ed6,#d64aa3)', // 7
  'linear-gradient(135deg,#ffb0a8,#e2483b)', // 8
  'linear-gradient(135deg,#9fe0d4,#2b9c8a)', // 9
];
export const gradeColor = (grade: number) =>
  GRADE_COLORS[(Math.max(1, grade) - 1) % GRADE_COLORS.length];

/* =====================================================================
   UI-C-008 · Grade Room Badge — "Phòng Khối X"
===================================================================== */
export interface GradeRoomBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  grade: number;
  /** Tiền tố nhãn (mặc định "Phòng Khối"). */
  label?: ReactNode;
  size?: 'md' | 'sm';
}
export function GradeRoomBadge({ grade, label = 'Phòng Khối', size = 'md', className, ...rest }: GradeRoomBadgeProps) {
  return (
    <span data-ui="UI-C-008" className={cn('we-grade', size === 'sm' && 'sm', className)} {...rest}>
      <span className="ring" style={{ background: gradeColor(grade) }}>{grade}</span>
      <span className="lab">{label} {grade}</span>
    </span>
  );
}

/* =====================================================================
   UI-C-001 · Countdown Timer (đồng bộ server-time qua SOCK-EVT-S09)
   - to: mốc kết thúc (ms epoch). FE tính theo serverNow = Date.now()+skew.
===================================================================== */
export interface CountdownTimerProps {
  /** Mốc đích (ms epoch hoặc Date). */
  to: number | Date;
  /** clockSkew (ms) = serverTime − clientTime, từ time-sync (SOCK-EVT-S09). */
  skewMs?: number;
  label?: ReactNode;
  /** Hiển thị ngày khi còn ≥ 1 ngày. */
  showDays?: boolean;
  /** Bố cục: 'block' (số lớn) | 'inline' (gọn). */
  layout?: 'block' | 'inline';
  /** Ngưỡng (giây) chuyển sang tông khẩn cấp. */
  urgentBelowSec?: number;
  /** Gọi khi đếm về 0. */
  onComplete?: () => void;
}
export function CountdownTimer({
  to, skewMs = 0, label, showDays = true, layout = 'block', urgentBelowSec = 0, onComplete,
}: CountdownTimerProps) {
  const target = React.useMemo(() => (to instanceof Date ? to.getTime() : to), [to]);
  const [now, setNow] = React.useState(() => Date.now());
  const firedRef = React.useRef(false);
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, target - (now + skewMs));
  React.useEffect(() => {
    if (diff <= 0 && !firedRef.current) { firedRef.current = true; onComplete?.(); }
    if (diff > 0) firedRef.current = false;
  }, [diff, onComplete]);

  const totalSec = Math.floor(diff / 1000);
  const dd = Math.floor(diff / 86400000);
  const hh = Math.floor((diff % 86400000) / 3600000);
  const mm = Math.floor((diff % 3600000) / 60000);
  const ss = Math.floor((diff % 60000) / 1000);
  const urgent = urgentBelowSec > 0 && totalSec <= urgentBelowSec;

  const seg = (v: number, u: string) => (
    <span className="we-seg"><span className="num">{v.toString().padStart(2, '0')}</span><span className="unit">{u}</span></span>
  );
  const colon = <span className="colon">:</span>;
  const withDays = showDays && dd > 0;

  return (
    <div data-ui="UI-C-001" className={cn('we-countdown', layout === 'inline' && 'is-inline', urgent && 'is-urgent')}>
      {label && <div className="cd-lab">{label}</div>}
      <div className="cd-clock">
        {withDays && <>{seg(dd, 'Ngày')}{colon}</>}
        {seg(hh, 'Giờ')}{colon}
        {seg(mm, 'Phút')}{colon}
        {seg(ss, 'Giây')}
      </div>
    </div>
  );
}

/* =====================================================================
   UI-C-002 · Online Counter Badge (push qua SOCK-EVT-S02)
===================================================================== */
export interface OnlineCounterProps {
  count: number;
  /** Nhãn quanh số. Mặc định "Đang có … học sinh trong phòng". */
  renderLabel?: (count: number) => ReactNode;
  big?: boolean;
}
export function OnlineCounter({ count, renderLabel, big = false }: OnlineCounterProps) {
  const n = Math.max(0, Math.round(count));
  return (
    <span data-ui="UI-C-002" className={cn('we-online', big && 'is-big')}>
      <span className="live" aria-hidden />
      {renderLabel
        ? renderLabel(n)
        : <>Đang có <span className="n">{n.toLocaleString('vi-VN')}</span> học sinh trong phòng</>}
    </span>
  );
}

/* =====================================================================
   UI-C-005 · Connection Status Indicator (bind socket state)
===================================================================== */
export type ConnState = 'connected' | 'reconnecting' | 'disconnected';
export interface ConnectionStatusProps { state: ConnState; }
const CONN_TEXT: Record<ConnState, { cls: string; label: string }> = {
  connected:    { cls: 'ok',   label: 'Đã kết nối' },
  reconnecting: { cls: 'warn', label: 'Đang kết nối lại…' },
  disconnected: { cls: 'bad',  label: 'Mất kết nối' },
};
export function ConnectionStatus({ state }: ConnectionStatusProps) {
  // Chỉ hiển thị UI khi có vấn đề kết nối. Khi đã kết nối bình thường thì ẩn hoàn toàn.
  if (state === 'connected') return null;
  const t = CONN_TEXT[state];
  return (
    <span data-ui="UI-C-005" className={cn('we-conn', t.cls)} role="status" aria-live="polite">
      <span className="led" aria-hidden />{t.label}
    </span>
  );
}

/* =====================================================================
   UI-C-004 · Progress Bar (tăng khi nhận SOCK-EVT-S05 ack)
===================================================================== */
export interface ProgressBarProps {
  answered: number;
  total: number;
  /** Hiển thị dãy pip thay cho thanh. */
  pips?: boolean;
  /** Chỉ số câu hiện tại (1-based) — tô pip 'current'. */
  currentIndex?: number;
  label?: ReactNode;
}
export function ProgressBar({ answered, total, pips = false, currentIndex, label = 'Tiến độ' }: ProgressBarProps) {
  const a = Math.max(0, Math.min(total, answered));
  const pct = total > 0 ? (a / total) * 100 : 0;
  return (
    <div data-ui="UI-C-004" className="we-progress">
      <div className="pg-top">
        <span>{label}</span>
        <span className="count">Đã trả lời <b>{a}</b>/{total}</span>
      </div>
      {pips ? (
        <div className="we-pips" aria-hidden>
          {Array.from({ length: total }, (_, i) => (
            <i key={i} className={cn('pip', i < a && 'done', currentIndex != null && i + 1 === currentIndex && i >= a && 'current')} />
          ))}
        </div>
      ) : (
        <div className="pg-track"><div className="pg-fill" style={{ width: `${pct}%` }} /></div>
      )}
    </div>
  );
}

/* =====================================================================
   UI-C-003 · Question Card (+ answer grid, server-shuffled options)
   Anti-cheat: KHÔNG nhận correctKey lúc làm bài — chỉ hiện 'selected'.
   reveal=true (kèm correct) chỉ dùng ở màn "Xem lại đáp án".
===================================================================== */
export interface AnswerOption { key: 'A' | 'B' | 'C' | 'D'; label: ReactNode; }
export interface QuestionCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  index: number;
  total: number;
  question: ReactNode;
  image?: string;
  options: ReadonlyArray<AnswerOption>;
  selected?: string | null;
  /** Khoá input (hết giờ câu / đã đồng bộ sang câu sau). */
  locked?: boolean;
  /** Đã nhận ack lưu đáp án (SOCK-EVT-S05). */
  saved?: boolean;
  /** Bật chế độ review: tô đúng/sai theo `correct`. */
  reveal?: boolean;
  correct?: string | null;
  onSelect?: (key: AnswerOption['key']) => void;
}
export function QuestionCard({
  index, total, question, image, options,
  selected = null, locked = false, saved = false, reveal = false, correct = null,
  onSelect, className, ...rest
}: QuestionCardProps) {
  const disabled = locked || reveal;
  return (
    <div data-ui="UI-C-003" className={cn('we-qcard', className)} {...rest}>
      <div className="q-head">
        <span className="we-qtag">Câu {index}/{total}</span>
        {saved && !reveal && (
          <span style={{ fontWeight: 900, fontSize: 12, color: '#1f8a55', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            ✓ Đã lưu đáp án
          </span>
        )}
      </div>
      {image && <img className="we-qimg" src={image} alt="" />}
      <p className="we-qtext">{question}</p>
      <div className="we-answers">
        {options.map((opt) => {
          let stateCls: string | false = false;
          if (reveal) {
            if (opt.key === correct) stateCls = 'is-correct';
            else if (opt.key === selected) stateCls = 'is-wrong';
            else stateCls = 'is-dimmed';
          } else if (opt.key === selected) {
            stateCls = locked ? 'is-selected is-locked' : 'is-selected';
          }
          return (
            <button
              key={opt.key}
              type="button"
              className={cn('we-answer', `k-${opt.key}`, stateCls)}
              disabled={disabled}
              aria-label={`Đáp án ${opt.key}`}
              onClick={() => !disabled && onSelect?.(opt.key)}
            >
              <span className="letter">{opt.key}</span>
              <span className="lbl">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* =====================================================================
   UI-C-006 · Leaderboard Row
===================================================================== */
export interface LeaderboardEntry {
  rank: number;
  studentId?: string;
  displayName: string;
  className?: ReactNode;       // lớp/sub-label
  avatar?: ReactNode;
  avatarBg?: string;
  avatarUrl?: string;
  correctCount: number;
  totalTimeMs: number;
  isMe?: boolean;
}
export interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  /** Mẫu số "x/total câu". */
  total?: number;
}
export function LeaderboardRow({ entry, total = 25 }: LeaderboardRowProps) {
  return (
    <div data-ui="UI-C-006" className={cn('we-row', entry.isMe && 'is-me')}>
      <span className="rank">{entry.rank}</span>
      <AvatarImage
        src={entry.avatarUrl}
        name={entry.displayName}
        avatarBg={entry.avatarBg ?? gradeColor(1)}
        className="av"
      />
      <span className="info">
        <span className="nm">{entry.displayName}{entry.isMe && ' (Bạn)'}</span>
        {entry.className && <span className="sub">{entry.className}</span>}
      </span>
      <span className="correct">{entry.correctCount}<small>/{total}</small></span>
      <span className="time">{fmtDuration(entry.totalTimeMs / 1000)}</span>
    </div>
  );
}

/* =====================================================================
   UI-C-007 · Personal Stats Card
===================================================================== */
export interface PersonalStatsCardProps {
  name: string;
  className?: ReactNode;
  avatar?: ReactNode;
  avatarBg?: string;
  avatarUrl?: string;
  correct: number;
  wrong: number;
  skipped: number;
  score: number;
  rank: number;
  totalTimeMs: number;
}
export function PersonalStatsCard({
  name, className, avatar, avatarBg, avatarUrl, correct, wrong, skipped, score, rank, totalTimeMs,
}: PersonalStatsCardProps) {
  return (
    <div data-ui="UI-C-007" className="we-stats">
      <div className="st-head">
        <div className="st-id">
          <AvatarImage
            src={avatarUrl}
            name={name}
            avatarBg={avatarBg ?? gradeColor(4)}
            className="av"
          />
          <div className="who">
            <div className="nm">{name}</div>
            {className && <div className="sub">{className}</div>}
          </div>
        </div>
        <div className="st-rank">
          <span className="v">#{rank}</span>
          <span className="l">Xếp hạng</span>
        </div>
      </div>
      <div className="st-grid">
        <div className="we-stat ok"><span className="v">{correct}</span><span className="l">Đúng</span></div>
        <div className="we-stat bad"><span className="v">{wrong}</span><span className="l">Sai</span></div>
        <div className="we-stat skip"><span className="v">{skipped}</span><span className="l">Bỏ qua</span></div>
        <div className="we-stat score"><span className="v">{score}</span><span className="l">Cúp</span></div>
      </div>
      <div style={{ textAlign: 'center', marginTop: 10, fontWeight: 800, fontSize: 12, color: 'var(--g-wood-3)' }}>
        Hoàn thành trong {fmtDuration(totalTimeMs / 1000)}
      </div>
    </div>
  );
}

/* =====================================================================
   UI-C-009 · Auto-resume Notification (trigger khi nhận SOCK-EVT-S04)
===================================================================== */
export interface AutoResumeNotificationProps {
  /** Phút còn lại của bài. */
  remainingMin?: number;
  /** Số câu đã khôi phục. */
  restoredCount?: number;
}
export function AutoResumeNotification({ remainingMin, restoredCount }: AutoResumeNotificationProps) {
  return (
    <div data-ui="UI-C-009" className="we-resume" role="status" aria-live="polite">
      <span className="ic" aria-hidden>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M5 12.5l3.5 3.5L19 7.5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
      <span>
        Đã khôi phục bài làm{restoredCount != null && <> — <b>{restoredCount}</b> câu đã lưu</>}
        {remainingMin != null && <> · còn <b>{remainingMin} phút</b></>}
      </span>
    </div>
  );
}

/* =====================================================================
   UI-C-010 · Disconnect Warning Modal (KHÔNG chặn input — vẫn làm bài)
===================================================================== */
export interface DisconnectWarningModalProps {
  /** Bọc trong scrim tối để xem riêng (mặc định false — bản chất non-blocking banner). */
  withScrim?: boolean;
  title?: ReactNode;
  description?: ReactNode;
}
export function DisconnectWarningModal({
  withScrim = false,
  title = 'Mất kết nối tạm thời',
  description = 'Bạn vẫn có thể tiếp tục làm bài. Đáp án được lưu tạm và sẽ tự gửi lại khi có mạng.',
}: DisconnectWarningModalProps) {
  const banner = (
    <div data-ui="UI-C-010" className="we-disc" role="alert">
      <span className="ic" aria-hidden>📡</span>
      <span className="txt">
        <span className="ti">{title}</span> <br />
        <span className="ds">{description}</span>
      </span>
      <svg className="spin" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="rgba(245,166,35,.3)" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="#f5a623" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );
  return withScrim ? <div className="we-scrim">{banner}</div> : banner;
}
