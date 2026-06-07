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
        <div>Sự kiện tuần<small>Uniclass</small></div>
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
  waitingDuration?: number;
  topRight?: ReactNode;
}

export function EventEntry({
  status = 'open', weeklyTitle, grade, openAt, nextEventAt, alreadyJoined = false,
  skewMs = 0, onJoin, onResume, waitingDuration = 5, topRight, className, ...rest
}: EventEntryProps) {
  const formatOpenTime = (dateInput?: number | Date) => {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    return `${pad(date.getHours())}h${pad(date.getMinutes())} — ${days[date.getDay()]} (${pad(date.getDate())}/${pad(date.getMonth() + 1)})`;
  };

  const getStartExamTime = () => {
    if (!openAt) return '';
    const date = new Date(openAt);
    date.setMinutes(date.getMinutes() + waitingDuration);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(date.getHours())}h${pad(date.getMinutes())}`;
  };

  const getStatusEyebrow = () => {
    switch (status) {
      case 'before-open': return '🚀 SẮP BẮT ĐẦU';
      case 'open': return '🔥 ĐÃ ĐẾN GIỜ TRANH TÀI';
      case 'in-progress': return alreadyJoined ? '✍️ LƯỢT THI CHƯA HOÀN THÀNH' : '🕒 SỰ KIỆN TUẦN ĐÃ KHÓA';
      case 'closed': return '🎉 SỰ KIỆN ĐÃ KHÉP LẠI';
      default: return 'Chủ đề tuần này';
    }
  };

  return (
    <div data-scr="UI-S-001" className={cn('we-stage is-soft', className)} {...rest}>
      <div className="we-motes" aria-hidden><i /><i /><i /><i /><i /><i /></div>
      <div className="we-screen">
        <WeHeader grade={grade} right={topRight} />

        <div className="we-body">
          <div className="we-marquee"><span className="bulb" />Sự Kiện Tuần<span className="bulb" /></div>
          <div className="we-eyebrow">{getStatusEyebrow()}</div>
          <h1 className="we-theme-title">{weeklyTitle}</h1>

          {status === 'before-open' && openAt != null && (
            <>
              <CountdownTimer to={openAt} skewMs={skewMs} label="Cổng đăng ký mở sau" urgentBelowSec={60} />
              <div className="we-subtle">
                Thời gian mở cổng: <strong style={{ color: 'var(--we-accent)' }}>{formatOpenTime(openAt)}</strong>
              </div>
            </>
          )}

          {status === 'open' && (
            <div className="we-subtle" style={{ maxWidth: 460 }}>
              Cổng sự kiện tuần đã mở! Hãy nhanh chóng vào phòng chờ cùng các bạn khối {grade}. Đề thi sẽ được phát đồng loạt vào <strong style={{ color: 'var(--we-accent)' }}>{getStartExamTime()}</strong>.
            </div>
          )}

          {status === 'in-progress' && !alreadyJoined && (
            <div className="we-note-plate warn">
              <span className="em">⏰</span>
              <div>
                Sự kiện tuần này đã bắt đầu và khóa cổng ghi danh lúc <strong style={{ marginLeft: 4 }}>{getStartExamTime()}</strong>. Hẹn gặp học sinh khối {grade} vào thứ Bảy tuần sau!
              </div>
            </div>
          )}

          {status === 'in-progress' && alreadyJoined && (
            <div className="we-note-plate">
              <span className="em">▶️</span>
              <div>
                Bạn có lượt làm bài đang diễn ra ở phòng thi khối {grade}. Hãy nhanh chóng quay lại để hoàn thành bài thi nhé!
              </div>
            </div>
          )}

          {status === 'closed' && (
            <>
              <div className="we-note-plate">
                <span className="em">🎉</span>
                <div>
                  Cảm ơn học sinh khối {grade} đã tham gia tranh tài tuần này! Bảng vinh danh đã được công bố.
                </div>
              </div>
              {nextEventAt != null && (
                <CountdownTimer to={nextEventAt} skewMs={skewMs} label="Sự kiện tiếp theo bắt đầu sau" />
              )}
            </>
          )}
        </div>

        <div className="we-foot">
          {status === 'before-open' && (
            <GameButton size="lg" disabled>Chờ mở cổng đăng ký…</GameButton>
          )}
          {status === 'open' && (
            <GameButton size="lg" color="orange" onClick={onJoin}>Tham gia ngay</GameButton>
          )}
          {status === 'in-progress' && alreadyJoined && (
            <GameButton size="lg" color="green" onClick={onResume}>Tiếp tục làm bài</GameButton>
          )}
          {status === 'in-progress' && !alreadyJoined && (
            <GameButton size="lg" disabled>Đã đóng cổng ghi danh</GameButton>
          )}
          {status === 'closed' && (
            <GameButton size="lg" color="ghost" disabled>Sự kiện đã kết thúc</GameButton>
          )}
        </div>
      </div>
    </div>
  );
}
