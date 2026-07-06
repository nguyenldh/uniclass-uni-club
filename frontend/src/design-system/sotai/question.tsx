/* ============================================================
   So Tài · Question card + answer choices + decaying bar
   - QuestionCard: paper card with question text + answers + meter
   - AnswerChoice: 4 ABCD buttons (Kahoot-style colors)
   - DecayingBar: thanh điểm tiềm năng tụt từ max → max*minRatio
   - FloatingPoints: "+850" bay lên sau khi trả lời
   ============================================================ */
import React, {
  type ReactNode,
  type HTMLAttributes,
  type ButtonHTMLAttributes,
} from 'react';

const cn = (...xs: Array<string | false | null | undefined>) =>
  xs.filter(Boolean).join(' ');

/* ============================================================
   Types
   ============================================================ */

/** A/B/C/D. */
export type AnswerKey = 'A' | 'B' | 'C' | 'D';

/** Trạng thái 1 đáp án. */
export type AnswerState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dimmed';

/** Trạng thái tổng thể của câu hỏi. */
export type QuestionPhase =
  /** Cho phép chọn đáp án. */
  | 'answering'
  /** Đã trả lời, đang chờ đối thủ — đáp án mình giữ highlight. */
  | 'waiting'
  /** Hiện đáp án đúng/sai. */
  | 'revealing';

export interface AnswerOption {
  key: AnswerKey;
  label: ReactNode;
}

/* ============================================================
   AnswerChoice — 1 button đáp án ABCD
   ============================================================ */

export interface AnswerChoiceProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  letter: AnswerKey;
  state?: AnswerState;
  children: ReactNode;
}

export function AnswerChoice({
  letter,
  state = 'idle',
  children,
  className,
  disabled,
  ...rest
}: AnswerChoiceProps) {
  return (
    <button
      type="button"
      className={cn(
        'st-answer',
        `k-${letter}`,
        state === 'selected' && 'is-selected',
        state === 'correct' && 'is-correct',
        state === 'wrong' && 'is-wrong',
        state === 'dimmed' && 'is-dimmed',
        className
      )}
      disabled={disabled || state !== 'idle'}
      aria-label={`Đáp án ${letter}`}
      {...rest}
    >
      <span className="letter">{letter}</span>
      <span className="lbl">{children}</span>
    </button>
  );
}

/* ============================================================
   DecayingBar — điểm tiềm năng tụt từ max → max * minRatio
   ============================================================ */

export interface DecayingBarProps {
  /** Điểm tối đa của câu (vd: 1000). */
  maxScore?: number;
  /** Hệ số bảo toàn (0.5 = tụt tối thiểu 50%). */
  minRatio?: number;
  /** Thời gian tối đa của câu (giây). */
  timeLimit: number;
  /** Thời gian đã trôi (giây). */
  timeElapsed: number;
  /** Hiện label "ĐIỂM TIỀM NĂNG". Default true. */
  showLabel?: boolean;
  /** Hiện con số điểm bên phải. Default true. */
  showValue?: boolean;
  /** Ép thanh & số điểm về 0 (trả lời sai / không trả lời → không được cộng điểm). */
  zeroed?: boolean;
  /** Tông màu dùng chung ('is-fresh'|'is-mid'|'is-low'). Bỏ trống → tự tính theo % fill. */
  tone?: 'is-fresh' | 'is-mid' | 'is-low';
}

/**
 * Tính điểm tiềm năng tại thời điểm hiện tại.
 * minRatio = sàn điểm giữ lại ở giây cuối (bảo toàn): minRatio=1 → luôn full;
 * minRatio=0 → giây cuối còn 0. Khớp với công thức backend & thanh progress (fillPct).
 */
export function decayingScore(
  timeElapsed: number,
  timeLimit: number,
  maxScore = 1000,
  minRatio = 0.5
): number {
  if (timeLimit <= 0) return maxScore;
  const ratio = Math.max(0, Math.min(1, timeElapsed / timeLimit));
  const mult = 1 - (1 - minRatio) * ratio;
  return Math.round(maxScore * mult);
}

export function DecayingBar({
  maxScore = 1000,
  minRatio = 0.5,
  timeLimit,
  timeElapsed,
  showLabel = true,
  showValue = true,
  zeroed = false,
  tone,
}: DecayingBarProps) {
  const ratio = Math.max(0, Math.min(1, timeElapsed / Math.max(1, timeLimit)));
  // Bar goes from 100% → minRatio*100% as time progresses.
  // Khi sai / không trả lời (zeroed) → tụt hẳn về 0 để khớp với điểm nhận được (0đ).
  const fillPct = zeroed ? 0 : (1 - (1 - minRatio) * ratio) * 100;
  const score = zeroed ? 0 : decayingScore(timeElapsed, timeLimit, maxScore, minRatio);

  // Màu theo ĐÚNG % fill hiển thị của thanh (khớp độ dài nhìn thấy): >66% xanh, >33% vàng, còn lại đỏ.
  // Ưu tiên tone truyền vào để đồng bộ với vòng ring timer.
  const barTone = tone ?? (fillPct > 66 ? 'is-fresh' : fillPct > 33 ? 'is-mid' : 'is-low');

  return (
    <div className="st-decay">
      {showLabel && <span className="lab">Điểm</span>}
      <div className="track">
        <div className={cn('fill', barTone)} style={{ width: `${fillPct}%` }} />
      </div>
      {showValue && <span className={cn('num', barTone)}>{score.toLocaleString('vi-VN')}</span>}
    </div>
  );
}

/* ============================================================
   Inline timer (small ring + countdown number)
   Used in the question meter row.
   ============================================================ */

export interface InlineTimerProps {
  /** Giây còn lại. */
  remaining: number;
  /** Tổng giây — vẽ progress ring. */
  total: number;
  /** Tông màu ĐỒNG BỘ với thanh điểm & số ('is-fresh'|'is-mid'|'is-low').
   *  Bỏ trống → tự tính theo số giây còn lại. */
  tone?: 'is-fresh' | 'is-mid' | 'is-low';
}

export function InlineTimer({ remaining, total, tone }: InlineTimerProps) {
  const safe = Math.max(0, remaining);
  const r = 11;
  const c = 2 * Math.PI * r;
  const ratio = total > 0 ? Math.max(0, Math.min(1, safe / total)) : 1;
  const offset = c * (1 - ratio);
  // Màu vòng ring đồng bộ với thanh điểm & số (tone theo % fill, truyền từ QuestionCard).
  const RING_COLOR: Record<string, string> = { 'is-fresh': '#129843', 'is-mid': '#E08A00', 'is-low': '#D91818' };
  const stroke = tone
    ? RING_COLOR[tone]
    : (safe <= 3 ? 'var(--danger)' : safe <= 7 ? 'var(--warning)' : 'var(--success)');

  return (
    <>
      <svg viewBox="0 0 28 28" aria-hidden>
        <circle cx="14" cy="14" r={r} fill="none" stroke="rgba(110,63,23,.18)" strokeWidth="3" />
        <circle
          cx="14" cy="14" r={r}
          fill="none" stroke={stroke}
          strokeWidth="3" strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 14 14)"
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <span className="num">{Math.ceil(safe)}s</span>
    </>
  );
}

/* ============================================================
   QuestionCard — paper card with everything
   ============================================================ */

export interface QuestionCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  /** Câu hỏi đang ở câu thứ mấy (1-indexed). */
  index: number;
  /** Tổng câu. */
  total: number;
  /** Nội dung câu hỏi. */
  question: ReactNode;
  /** 4 đáp án A/B/C/D. */
  options: ReadonlyArray<AnswerOption>;
  /** Tổng thời gian của câu (giây). */
  timeLimit: number;
  /** Thời gian đã trôi (giây). */
  timeElapsed: number;
  /** Điểm tối đa của câu. Default 1000. */
  maxScore?: number;
  /** Hệ số bảo toàn điểm tối thiểu. Default 0.5. */
  minRatio?: number;
  /** Đáp án mình đã chọn (null = chưa chọn). */
  selected?: AnswerKey | null;
  /** Đáp án đúng (null/undefined = chưa lộ). */
  correct?: AnswerKey | null;
  /** Phase hiện tại. */
  phase?: QuestionPhase;
  /** Đối thủ đã trả lời chưa (chỉ dùng khi phase === 'answering'). */
  opponentAnswered?: boolean;
  /** Callback khi click đáp án (chỉ hoạt động khi phase === 'answering'). */
  onSelect?: (key: AnswerKey) => void;
}

/** Trả về state cho từng đáp án dựa vào phase + selected + correct. */
function answerStateFor(
  letter: AnswerKey,
  phase: QuestionPhase,
  selected: AnswerKey | null | undefined,
  correct: AnswerKey | null | undefined
): AnswerState {
  if (phase === 'revealing') {
    if (letter === correct) return 'correct';
    if (letter === selected && letter !== correct) return 'wrong';
    return 'dimmed';
  }
  if (phase === 'waiting') {
    return letter === selected ? 'selected' : 'dimmed';
  }
  // answering
  return letter === selected ? 'selected' : 'idle';
}

export function QuestionCard({
  index,
  total,
  question,
  options,
  timeLimit,
  timeElapsed,
  maxScore = 1000,
  minRatio = 0.5,
  selected = null,
  correct = null,
  phase = 'answering',
  opponentAnswered = false,
  onSelect,
  className,
  ...rest
}: QuestionCardProps) {
  const remaining = Math.max(0, timeLimit - timeElapsed);
  // Khi đã lộ đáp án mà mình trả lời sai hoặc không trả lời (selected !== correct)
  // → thanh điểm tụt về 0 cho khớp với việc không được cộng điểm.
  const missed = phase === 'revealing' && correct != null && selected !== correct;
  // Tone màu CHUNG cho vòng ring + thanh điểm + số — theo % fill hiển thị của thanh
  // (cùng công thức với DecayingBar) để cả 3 đồng bộ, đổi màu cùng lúc.
  const barRatio = Math.max(0, Math.min(1, timeElapsed / Math.max(1, timeLimit)));
  const barFillPct = missed ? 0 : (1 - (1 - minRatio) * barRatio) * 100;
  const barTone = barFillPct > 66 ? 'is-fresh' : barFillPct > 33 ? 'is-mid' : 'is-low';

  return (
    <div className={cn('st-qcard', className)} {...rest}>
      <div className="qhead">
        <span className="qtag">CÂU {index}/{total}</span>
        <div className="qstatus">
          {phase === 'waiting' && (
            <span className="waiting">Đợi đối thủ trả lời...</span>
          )}
          {phase === 'answering' && opponentAnswered && (
            <span className="answered">Đối thủ đã trả lời</span>
          )}
        </div>
        {/* <span style={{ fontWeight: 800, fontSize: 12, opacity: .6, letterSpacing: '.08em', textTransform: 'uppercase' }}>
          {timeLimit}s
        </span> */}
      </div>

      <p className="qtext">{question}</p>

      <div className={cn('st-qmeter', barTone)}>
        <div className="timer-box">
          <InlineTimer remaining={remaining} total={timeLimit} tone={barTone} />
        </div>
        <DecayingBar
          maxScore={maxScore}
          minRatio={minRatio}
          timeLimit={timeLimit}
          timeElapsed={timeElapsed}
          zeroed={missed}
          tone={barTone}
        />
      </div>



      <div className="st-answers">
        {options.map((opt) => (
          <AnswerChoice
            key={opt.key}
            letter={opt.key}
            state={answerStateFor(opt.key, phase, selected, correct)}
            onClick={() => phase === 'answering' && onSelect?.(opt.key)}
          >
            {opt.label}
          </AnswerChoice>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   FloatingPoints — "+850" bay lên sau khi trả lời
   ============================================================ */

export interface FloatingPointsProps {
  /** Số điểm (signed: dương = thắng, 0 = miss). */
  points: number;
  /** Tone — auto-detect nếu omit. */
  variant?: 'win' | 'miss';
  /** Vị trí (relative to parent). */
  style?: React.CSSProperties;
}

export function FloatingPoints({ points, variant, style }: FloatingPointsProps) {
  const v = variant ?? (points > 0 ? 'win' : 'miss');
  return (
    <div className={cn('st-floating', v)} style={style}>
      {points > 0 ? `+${points.toLocaleString('vi-VN')}` : 'Tiếc quá!'}
    </div>
  );
}

/* ============================================================
   QuizCallout — câu hô tạo cảm giác ganh đua khi lộ đáp án
   - win:  trả lời đúng → khen ngợi hừng hực
   - miss: trả lời sai/hết giờ → khích lệ "máu chiến"
   ============================================================ */

/** Câu hô khi trả lời ĐÚNG. */
export const QUIZ_CALLOUTS_WIN = [
  'Tuyệt vời!',
  'Giỏi đỉnh!',
  'Cao thủ!',
  'Xuất sắc!',
  'Quá đỉnh!',
  'Bậc thầy!',
  'Thần tốc!',
  'Bất bại!',
] as const;

/** Câu hô khi trả lời SAI / hết giờ. */
export const QUIZ_CALLOUTS_MISS = [
  'Cố lên!',
  'Suýt rồi!',
  'Đừng nản!',
  'Gỡ ngay thôi!',
  'Tập trung nào!',
  'Chưa xong đâu!',
] as const;

export interface QuizCalloutProps {
  variant: 'win' | 'miss';
  /** Seed để chọn câu hô (vd: questionIndex) — giữ ổn định, không nhấp nháy khi re-render. */
  seed?: number;
  style?: React.CSSProperties;
}

export function QuizCallout({ variant, seed = 0, style }: QuizCalloutProps) {
  const pool = variant === 'win' ? QUIZ_CALLOUTS_WIN : QUIZ_CALLOUTS_MISS;
  const text = pool[Math.abs(Math.trunc(seed)) % pool.length];
  return (
    <div className={cn('st-callout', variant)} style={style} aria-live="polite">
      {text}
    </div>
  );
}
