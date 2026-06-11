/* ============================================================
   Sự kiện tuần · UI-S-004 — Submission Loading (Chờ chấm bài)
   Buffer giữa nộp bài (T+20) và công bố leaderboard (T+22).
   Realtime: chờ SOCK-EVT-S06/S07 · FLOW-008/009
   ============================================================ */
import React, { type ReactNode, type HTMLAttributes } from 'react';
import { WeHeader } from './entry';

const cn = (...xs: Array<string | false | null | undefined>) =>
  xs.filter(Boolean).join(' ');

export interface SubmissionLoadingProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  grade: number;
  /** Giờ công bố (vd "10h27"). */
  announceAt?: ReactNode;
  title?: ReactNode;
  headerRight?: ReactNode;
}

export function SubmissionLoading({
  grade, announceAt = '10h27', title = 'Đang chấm bài…', headerRight, className, ...rest
}: SubmissionLoadingProps) {
  return (
    <div data-scr="UI-S-004" className={cn('we-stage', className)} {...rest}>
      <div className="we-motes" aria-hidden><i /><i /><i /><i /></div>
      <div className="we-screen" style={{ gridTemplateRows: 'auto 1fr' }}>
        <WeHeader grade={grade} right={headerRight} />
        <div className="we-load">
          <div className="we-spinner">
            <svg viewBox="0 0 96 96" fill="none" aria-hidden>
              <circle cx="48" cy="48" r="40" stroke="rgba(255,255,255,.12)" strokeWidth="7" />
              <path d="M88 48a40 40 0 0 0-40-40" stroke="var(--we-accent)" strokeWidth="7" strokeLinecap="round" />
            </svg>
            <span className="ico" aria-hidden>📝</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'center' }}>
            <h2 className="we-theme-title" style={{ fontSize: 28 }}>{title}</h2>
            <div className="we-subtle">Kết quả sẽ được công bố lúc <b style={{ color: 'var(--we-gold)' }}>{announceAt}</b></div>
          </div>
        </div>
      </div>
    </div>
  );
}
