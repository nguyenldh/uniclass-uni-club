/* ============================================================
   Sự kiện tuần · UI-S-007 — Event Closed Screen
   Trạng thái sau 10h30 — countdown đến thứ Bảy kế tiếp.
   Đọc: DATA-M-002 · nguồn route: SOCK-EVT-S08 (khi bị huỷ)
   ============================================================ */
import React, { type ReactNode, type HTMLAttributes } from 'react';
import { CountdownTimer } from './shared';
import { WeHeader } from './entry';
import { GameButton } from '../game';

const cn = (...xs: Array<string | false | null | undefined>) =>
  xs.filter(Boolean).join(' ');

export interface EventClosedScreenProps extends HTMLAttributes<HTMLDivElement> {
  grade?: number;
  /** Mốc sự kiện tuần sau. */
  nextEventAt?: number | Date | null;
  skewMs?: number;
  /** true = đóng do bị huỷ (SOCK-EVT-S08) thay vì kết thúc bình thường. */
  cancelled?: boolean;
  cancelReason?: ReactNode;
  onBackHome?: () => void;
  lastEvent?: { _id: string; title: string } | null;
  onViewLeaderboard?: () => void;
}

export function EventClosedScreen({
  grade, nextEventAt, skewMs = 0, cancelled = false, cancelReason,
  onBackHome, lastEvent, onViewLeaderboard, className, ...rest
}: EventClosedScreenProps) {
  const formatOpenTime = (dateInput?: number | Date | null) => {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    return `${pad(date.getHours())}h${pad(date.getMinutes())} — ${days[date.getDay()]} (${pad(date.getDate())}/${pad(date.getMonth() + 1)})`;
  };

  const getFallbackNextSaturday = () => {
    const d = new Date();
    const day = d.getDay();
    const daysUntilNextSaturday = (6 - day + 7) % 7 || 7;
    const target = new Date(d.getTime());
    target.setDate(d.getDate() + daysUntilNextSaturday);
    target.setHours(10, 0, 0, 0);
    return target;
  };

  const countdownTarget = nextEventAt ? new Date(nextEventAt) : getFallbackNextSaturday();
  // Có sự kiện kế tiếp → nhấn mạnh "sắp diễn ra" thay vì "đã kết thúc" cho đỡ gây hiểu nhầm
  const hasNext = !cancelled && !!nextEventAt;

  return (
    <div data-scr="UI-S-007" className={cn('we-stage is-soft', className)} {...rest}>
      <div className="we-motes" aria-hidden><i /><i /><i /><i /></div>
      <div className="we-screen">
        <WeHeader grade={grade} />
        <div className="we-body">
          <div style={{ fontSize: 56 }} aria-hidden>{cancelled ? '🛑' : hasNext ? '🗓️' : '🌙'}</div>
          <h1 className="we-theme-title">
            {cancelled
              ? 'Sự kiện đã bị huỷ'
              : hasNext
                ? 'Sự kiện tuần tới sắp diễn ra!'
                : 'Sự kiện tuần đã kết thúc!'}
          </h1>
          {cancelled ? (
            <div className="we-note-plate warn" style={{ textAlign: 'center' }}>
              <span className="em">⚠️</span>
              {cancelReason ?? 'Ban tổ chức đã tạm dừng sự kiện. Mọi kết quả sẽ được xử lý lại.'}
            </div>
          ) : (
            <div className="we-subtle" style={{ maxWidth: 420 }}>
              {nextEventAt ? (
                <>
                  Sự kiện tuần này đã kết thúc. Sự kiện tiếp theo sẽ diễn ra lúc:
                  <div style={{ marginTop: 6 }}>
                    <strong style={{ color: 'var(--we-accent)' }}>{formatOpenTime(nextEventAt)}</strong>
                  </div>
                </>
              ) : (
                'Sự kiện tuần này đã kết thúc. Cùng quay lại vào 10h00 thứ Bảy tới nhé!'
              )}
            </div>
          )}
          <CountdownTimer to={countdownTarget} skewMs={skewMs} label="Sự kiện tiếp theo bắt đầu sau" />
        </div>
        <div className="we-foot" style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          {lastEvent && onViewLeaderboard && (
            <GameButton onClick={onViewLeaderboard}>Xem bảng xếp hạng</GameButton>
          )}
          <GameButton color="ghost" onClick={onBackHome}>Thoát</GameButton>
        </div>
      </div>
    </div>
  );
}
