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
}

/** Tính điểm tiềm năng tại thời điểm hiện tại (đúng theo công thức trong spec). */
export function decayingScore(
  timeElapsed: number,
  timeLimit: number,
  maxScore = 1000,
  minRatio = 0.5
): number {
  if (timeLimit <= 0) return maxScore;
  const ratio = Math.max(0, Math.min(1, timeElapsed / timeLimit));
  const mult = 1 - minRatio * ratio;
  return Math.round(maxScore * mult);
}

export function DecayingBar({
  maxScore = 1000,
  minRatio = 0.5,
  timeLimit,
  timeElapsed,
  showLabel = true,
  showValue = true,
}: DecayingBarProps) {
  const ratio = Math.max(0, Math.min(1, timeElapsed / Math.max(1, timeLimit)));
  // Bar goes from 100% → minRatio*100% as time progresses
  const fillPct = (1 - (1 - minRatio) * ratio) * 100;
  const score = decayingScore(timeElapsed, timeLimit, maxScore, minRatio);

  return (
    <div className="st-decay">
      {showLabel && <span className="lab">Điểm</span>}
      <div className="track">
        <div className="fill" style={{ width: `${fillPct}%` }} />
      </div>
      {showValue && <span className="num">{score.toLocaleString('vi-VN')}</span>}
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
}

export function InlineTimer({ remaining, total }: InlineTimerProps) {
  const safe = Math.max(0, remaining);
  const r = 11;
  const c = 2 * Math.PI * r;
  const ratio = total > 0 ? Math.max(0, Math.min(1, safe / total)) : 1;
  const offset = c * (1 - ratio);
  const tone =
    safe <= 3 ? 'danger' : safe <= 7 ? 'warning' : 'normal';
  const stroke =
    tone === 'danger' ? 'var(--danger)' : tone === 'warning' ? 'var(--warning)' : 'var(--o-500)';

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
  const meterTone =
    remaining <= 3 ? 'is-danger' : remaining <= 7 ? 'is-warning' : '';

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
        <span style={{ fontWeight: 800, fontSize: 12, opacity: .6, letterSpacing: '.08em', textTransform: 'uppercase' }}>
          {timeLimit}s
        </span>
      </div>

      <p className="qtext">{question}</p>

      <div className={cn('st-qmeter', meterTone)}>
        <div className="timer-box">
          <InlineTimer remaining={remaining} total={timeLimit} />
        </div>
        <DecayingBar
          maxScore={maxScore}
          minRatio={minRatio}
          timeLimit={timeLimit}
          timeElapsed={timeElapsed}
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
