/* ============================================================
   Săn Boss · SCR-02 — Chiến đấu / Câu hỏi
     UI-201 BattleQuestionCard   UI-203 QuestionTimer
     UI-202 AnswerGrid/Option    UI-204 QuestionIndex
   Plus BossStrip (boss nhận sát thương). Composed by <BossBattle/>.
   ============================================================ */
import React, { type ReactNode, type HTMLAttributes } from 'react';
import { bossStateFor, type BossState, DEFAULT_BOSS_STATES } from './lobby';

const cn = (...xs: Array<string | false | null | undefined>) =>
  xs.filter(Boolean).join(' ');

/* ---------- BossStrip — máu boss + mặt boss nhận đòn ---------- */
export interface BossStripProps extends HTMLAttributes<HTMLDivElement> {
  name: ReactNode;
  hpPercent: number;
  states?: BossState[];
  /** Hiện số sát thương vừa giáng (kích hoạt animation khi đổi). */
  lastDamage?: number | null;
  /** Cờ rung mặt boss. */
  hit?: boolean;
}
export function BossStrip({ name, hpPercent, states = DEFAULT_BOSS_STATES, lastDamage, hit, className, ...rest }: BossStripProps) {
  const hp = Math.max(0, Math.min(100, hpPercent));
  const st = bossStateFor(hp, states);
  return (
    <div className={cn('bb-bossbar', className)} {...rest}>
      <div className={cn('face', hit && 'hit')}>
        <span aria-hidden>{st.glyph ?? '🐉'}</span>
        {lastDamage != null && lastDamage > 0 && (
          <span className="dmg" key={lastDamage + '-' + Math.random()}>-{lastDamage.toLocaleString('vi-VN')}</span>
        )}
      </div>
      <div className="bbar-info">
        <div className="bbar-name">{name}</div>
        <div className="bbar-track">
          <div className="bbar-fill" style={{ width: `${hp}%` }} />
        </div>
      </div>
      <div className="bbar-hp">{hp.toFixed(2)}%</div>
    </div>
  );
}

/* ---------- UI-204 · Question Index ---------- */
export type QuestionPip = 'pending' | 'current' | 'correct' | 'wrong';
export interface QuestionIndexProps {
  index: number; // 1-based
  total: number;
  pips?: ReadonlyArray<QuestionPip>;
}
export function QuestionIndex({ index, total, pips }: QuestionIndexProps) {
  const arr = pips ?? Array.from({ length: total }, (_, i): QuestionPip =>
    i + 1 < index ? 'correct' : i + 1 === index ? 'current' : 'pending');
  return (
    <>
      <span data-ui="UI-204" className="bb-qindex">Câu <span className="big">{index}</span>/{total}</span>
      <span className="bb-qpips" aria-hidden>
        {arr.map((p, i) => (
          <i key={i} className={cn(p === 'correct' && 'done', p === 'wrong' && 'wrong', p === 'current' && 'current')} />
        ))}
      </span>
    </>
  );
}

/* ---------- UI-203 · Per-question Timer ---------- */
export interface QuestionTimerProps {
  /** Giây còn lại. */
  remaining: number;
  /** Trần đếm = CFG-05 (T_max). */
  total: number;
}
export function QuestionTimer({ remaining, total }: QuestionTimerProps) {
  const safe = Math.max(0, remaining);
  const r = 13;
  const c = 2 * Math.PI * r;
  const ratio = total > 0 ? Math.max(0, Math.min(1, safe / total)) : 1;
  const offset = c * (1 - ratio);
  const tone = safe <= 5 ? 'danger' : safe <= 10 ? 'warn' : 'normal';
  const stroke = tone === 'danger' ? 'var(--danger)' : tone === 'warn' ? 'var(--warning)' : 'var(--success)';
  return (
    <span data-ui="UI-203" className={cn('bb-timer', tone !== 'normal' && tone)}>
      <svg viewBox="0 0 34 34" aria-hidden>
        <circle cx="17" cy="17" r={r} fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="3.5" />
        <circle cx="17" cy="17" r={r} fill="none" stroke={stroke} strokeWidth="3.5" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset} transform="rotate(-90 17 17)"
          style={{ transition: 'stroke-dashoffset 1s linear' }} />
      </svg>
      <span>{Math.ceil(safe)}s</span>
    </span>
  );
}

/* ---------- UI-202 · Answer Option ---------- */
export type AnswerState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dimmed';
export interface AnswerOption { key: 'A' | 'B' | 'C' | 'D'; label: ReactNode; }

export type BattlePhase = 'answering' | 'revealing';

function answerStateFor(letter: string, phase: BattlePhase, selected: string | null, correct: string | null): AnswerState {
  if (phase === 'revealing') {
    if (letter === correct) return 'correct';
    if (letter === selected && letter !== correct) return 'wrong';
    return 'dimmed';
  }
  return letter === selected ? 'selected' : 'idle';
}

export interface AnswerGridProps {
  options: ReadonlyArray<AnswerOption>;
  phase?: BattlePhase;
  selected?: string | null;
  correct?: string | null;
  onSelect?: (key: AnswerOption['key']) => void;
}
export function AnswerGrid({ options, phase = 'answering', selected = null, correct = null, onSelect }: AnswerGridProps) {
  return (
    <div data-ui="UI-202" className="bb-answers">
      {options.map((opt) => {
        const state = answerStateFor(opt.key, phase, selected, correct);
        return (
          <button
            key={opt.key}
            type="button"
            className={cn('bb-answer', `k-${opt.key}`,
              state === 'selected' && 'is-selected',
              state === 'correct' && 'is-correct',
              state === 'wrong' && 'is-wrong',
              state === 'dimmed' && 'is-dimmed')}
            disabled={phase !== 'answering'}
            aria-label={`Đáp án ${opt.key}`}
            onClick={() => phase === 'answering' && onSelect?.(opt.key)}
          >
            <span className="letter">{opt.key}</span>
            <span className="lbl">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- UI-201 · Question Card ---------- */
export interface BattleQuestionCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  question: ReactNode;
  /** Ảnh đính kèm câu hỏi (DM-06.content). */
  image?: string;
  options: ReadonlyArray<AnswerOption>;
  phase?: BattlePhase;
  selected?: string | null;
  correct?: string | null;
  onSelect?: (key: AnswerOption['key']) => void;
}
export function BattleQuestionCard({
  question, image, options, phase = 'answering', selected = null, correct = null, onSelect, className, ...rest
}: BattleQuestionCardProps) {
  return (
    <div data-ui="UI-201" className={cn('bb-qcard', className)} {...rest}>
      {image && <img className="bb-qimg" src={image} alt="" />}
      <p className="bb-qtext">{question}</p>
      <AnswerGrid options={options} phase={phase} selected={selected} correct={correct} onSelect={onSelect} />
    </div>
  );
}

/* ---------- SCR-02 · BossBattle (composed) ---------- */
export interface BossBattleProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  bossName: ReactNode;
  bossHpPercent: number;
  states?: BossState[];
  index: number;
  total: number;
  pips?: ReadonlyArray<QuestionPip>;
  remaining: number;
  timeLimit: number;
  question: ReactNode;
  image?: string;
  options: ReadonlyArray<AnswerOption>;
  phase?: BattlePhase;
  selected?: string | null;
  correct?: string | null;
  onSelect?: (key: AnswerOption['key']) => void;
  lastDamage?: number | null;
  bossHit?: boolean;
}
export function BossBattle({
  bossName, bossHpPercent, states = DEFAULT_BOSS_STATES,
  index, total, pips, remaining, timeLimit,
  question, image, options, phase = 'answering', selected = null, correct = null, onSelect,
  lastDamage, bossHit, className, ...rest
}: BossBattleProps) {
  return (
    <div data-scr="SCR-02" className={cn('bb-stage', className)} {...rest}>
      <div className="bb-embers" aria-hidden><i /><i /><i /><i /><i /><i /><i /></div>
      <div className="bb-battle">
        <BossStrip name={bossName} hpPercent={bossHpPercent} states={states} lastDamage={lastDamage} hit={bossHit} />
        <div className="bb-qmeta">
          <QuestionIndex index={index} total={total} pips={pips} />
          <QuestionTimer remaining={remaining} total={timeLimit} />
        </div>
        <BattleQuestionCard
          key={index}
          question={question} image={image} options={options}
          phase={phase} selected={selected} correct={correct} onSelect={onSelect}
        />
      </div>
    </div>
  );
}
