/* ============================================================
   Sự kiện tuần · UI-S-003 — Exam Screen (Làm bài)
   Đề ĐỒNG BỘ: cả phòng cùng 1 câu, x giây/câu, tự sang câu sau
   (không có nút Câu trước/Câu sau). Anti-cheat: không nhận correctKey.
   Realtime: SOCK-EVT-S03/S04/S05/S09/S10/S11 · FLOW-005/006/007
   ============================================================ */
import React, { type ReactNode, type HTMLAttributes } from 'react';
import {
  QuestionCard, ProgressBar, ConnectionStatus, GradeRoomBadge,
  AutoResumeNotification, DisconnectWarningModal,
  type AnswerOption, type ConnState,
} from './shared';

const cn = (...xs: Array<string | false | null | undefined>) =>
  xs.filter(Boolean).join(' ');

/* ---------- Sync Timer — đồng hồ đồng bộ cho câu hiện tại ---------- */
export interface SyncTimerProps { remaining: number; total: number; }
export function SyncTimer({ remaining, total }: SyncTimerProps) {
  const safe = Math.max(0, remaining);
  const r = 18;
  const c = 2 * Math.PI * r;
  const ratio = total > 0 ? Math.max(0, Math.min(1, safe / total)) : 1;
  const offset = c * (1 - ratio);
  const tone = safe <= 3 ? 'danger' : safe <= 7 ? 'warn' : 'normal';
  const stroke = tone === 'danger' ? 'var(--we-bad)' : tone === 'warn' ? 'var(--we-warn)' : 'var(--we-accent-2)';
  return (
    <span className={cn('we-synctimer', tone !== 'normal' && tone)}>
      <svg viewBox="0 0 46 46" aria-hidden>
        <circle cx="23" cy="23" r={r} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="4" />
        <circle cx="23" cy="23" r={r} fill="none" stroke={stroke} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset} transform="rotate(-90 23 23)"
          style={{ transition: 'stroke-dashoffset 1s linear' }} />
      </svg>
      <span className="t"><span className="num">{Math.ceil(safe)}</span><span className="u">giây</span></span>
    </span>
  );
}

export interface ExamScreenProps extends HTMLAttributes<HTMLDivElement> {
  grade: number;
  index: number;             // 1-based câu hiện tại
  total: number;
  question: ReactNode;
  image?: string;
  options: ReadonlyArray<AnswerOption>;
  /** Số câu đã trả lời (cho progress). */
  answeredCount: number;
  selected?: string | null;
  /** Đã nhận ack lưu (SOCK-EVT-S05). */
  saved?: boolean;
  /** Hết giờ câu → khoá, chờ đồng bộ câu sau. */
  locked?: boolean;
  remaining: number;
  perQuestionSec: number;
  conn?: ConnState;
  /** Hiện banner mất kết nối (UI-C-010). */
  showDisconnect?: boolean;
  /** Hiện toast khôi phục bài (UI-C-009). */
  resume?: { remainingMin?: number; restoredCount?: number } | null;
  onSelect?: (key: AnswerOption['key']) => void;
}

export function ExamScreen({
  grade, index, total, question, image, options, answeredCount,
  selected = null, saved = false, locked = false, remaining, perQuestionSec,
  conn = 'connected', showDisconnect = false, resume = null, onSelect, className, ...rest
}: ExamScreenProps) {
  return (
    <div data-scr="UI-S-003" className={cn('we-stage', className)} {...rest}>
      <div className="we-exam">
        <div className="we-exam-bar">
          <GradeRoomBadge grade={grade} size="sm" />
          <ProgressBar answered={answeredCount} total={total} label="Số câu đã làm" />
          <SyncTimer remaining={remaining} total={perQuestionSec} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="we-syncnote"><span className="pulse" />Đề đồng bộ · cả phòng đang ở câu {index}</span>
          <ConnectionStatus state={conn} />
        </div>

        {resume && <AutoResumeNotification remainingMin={resume.remainingMin} restoredCount={resume.restoredCount} />}
        {showDisconnect && <DisconnectWarningModal />}

        <QuestionCard
          index={index} total={total} question={question} image={image}
          options={options} selected={selected} saved={saved} locked={locked}
          onSelect={onSelect}
        />
      </div>
    </div>
  );
}
