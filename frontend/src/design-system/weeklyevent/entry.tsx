/* ============================================================
   Sự kiện tuần · UI-S-001 — Event Entry Screen (Cổng vào)
   Trạng thái: before-open | open | in-progress | closed
   Đọc: DATA-M-002 (title, lịch), DATA-R-006 (room state) · FLOW-003
   ============================================================ */
import React, { type ReactNode, type HTMLAttributes } from 'react';
import { CountdownTimer, GradeRoomBadge } from './shared';
import { GameButton } from '../game';

const cn = (...xs: Array<string | false | null | undefined>) =>
  xs.filter(Boolean).join(' ');

/** Logo crest dùng chung ở header WE. */
export function WeCrest() {
  return (
    <svg viewBox="0 0 32 32" width="22" height="22" fill="none" aria-hidden>
      <path d="M16 3.5l3.4 6.9 7.6 1.1-5.5 5.4 1.3 7.6L16 21l-6.8 3.5 1.3-7.6L5 11.5l7.6-1.1L16 3.5z" fill="#fff" />
      <circle cx="16" cy="16" r="3.2" fill="#e8530e" />
    </svg>
  );
}

/** Header chuẩn cho mọi màn WE. */
export interface WeHeaderProps { grade?: number; right?: ReactNode; }
export function WeHeader({ grade, right }: WeHeaderProps) {
  return (
    <div className="we-topbar">
      <div className="we-brand">
        <span className="crest"><WeCrest /></span>
        <div>Sự kiện tuần<small>Uniclass · Đấu trường</small></div>
      </div>
      <div className="we-topright">
        {grade != null && <GradeRoomBadge grade={grade} size="sm" />}
        {right}
      </div>
    </div>
  );
}

export type EntryStatus = 'before-open' | 'open' | 'in-progress' | 'closed';

export interface EventEntryProps extends HTMLAttributes<HTMLDivElement> {
  status?: EntryStatus;
  /** Tiêu đề chủ đề tuần (DATA-M-002.weeklyEventTitle). */
  weeklyTitle: ReactNode;
  grade: number;
  /** before-open: mốc mở cổng (10h00). closed: mốc tuần sau. */
  openAt?: number | Date;
  nextEventAt?: number | Date;
  /** Đã tham gia trước đó → cho phép vào thẳng khi in-progress. */
  alreadyJoined?: boolean;
  skewMs?: number;
  onJoin?: () => void;
  onResume?: () => void;
}

export function EventEntry({
  status = 'open', weeklyTitle, grade, openAt, nextEventAt, alreadyJoined = false,
  skewMs = 0, onJoin, onResume, className, ...rest
}: EventEntryProps) {
  return (
    <div data-scr="UI-S-001" className={cn('we-stage is-soft', className)} {...rest}>
      <div className="we-motes" aria-hidden><i /><i /><i /><i /><i /><i /></div>
      <div className="we-screen">
        <WeHeader grade={grade} />

        <div className="we-body">
          <div className="we-marquee"><span className="bulb" />Đấu Trường Số · Thứ Bảy<span className="bulb" /></div>
          <div className="we-eyebrow">Chủ đề tuần này</div>
          <h1 className="we-theme-title">{weeklyTitle}</h1>

          {status === 'before-open' && openAt != null && (
            <>
              <CountdownTimer to={openAt} skewMs={skewMs} label="Cổng mở sau" urgentBelowSec={60} />
              <div className="we-subtle">10h00 — 10h30 · Mỗi thứ Bảy hàng tuần</div>
            </>
          )}

          {status === 'open' && (
            <div className="we-subtle" style={{ maxWidth: 460 }}>
              Cổng đã mở! Vào phòng chờ để cùng các bạn khối {grade} bắt đầu lúc 10h05.
            </div>
          )}

          {status === 'in-progress' && !alreadyJoined && (
            <div className="we-note-plate warn">
              <span className="em">⏰</span>
              Sự kiện đang diễn ra — không thể tham gia muộn. Hẹn bạn vào lượt tuần sau nhé!
            </div>
          )}

          {status === 'in-progress' && alreadyJoined && (
            <div className="we-note-plate">
              <span className="em">▶️</span>
              Bạn đang trong một lượt thi. Quay lại để tiếp tục làm bài.
            </div>
          )}

          {status === 'closed' && (
            <>
              <div className="we-note-plate"><span className="em">👋</span> Hẹn gặp lại tuần sau!</div>
              {nextEventAt != null && (
                <CountdownTimer to={nextEventAt} skewMs={skewMs} label="Sự kiện tiếp theo" />
              )}
            </>
          )}
        </div>

        <div className="we-foot">
          {status === 'before-open' && (
            <GameButton size="lg" disabled>Chờ mở cổng…</GameButton>
          )}
          {status === 'open' && (
            <GameButton size="lg" color="orange" onClick={onJoin}>Tham gia ngay</GameButton>
          )}
          {status === 'in-progress' && alreadyJoined && (
            <GameButton size="lg" color="green" onClick={onResume}>Tiếp tục làm bài</GameButton>
          )}
          {status === 'in-progress' && !alreadyJoined && (
            <GameButton size="lg" disabled>Đã đóng cổng vào</GameButton>
          )}
          {status === 'closed' && (
            <GameButton size="lg" color="ghost" disabled>Sự kiện đã kết thúc</GameButton>
          )}
        </div>
      </div>
    </div>
  );
}
