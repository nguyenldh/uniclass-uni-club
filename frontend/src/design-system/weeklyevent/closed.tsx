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
  nextEventAt: number | Date;
  skewMs?: number;
  /** true = đóng do bị huỷ (SOCK-EVT-S08) thay vì kết thúc bình thường. */
  cancelled?: boolean;
  cancelReason?: ReactNode;
  onBackHome?: () => void;
}

export function EventClosedScreen({
  grade, nextEventAt, skewMs = 0, cancelled = false, cancelReason,
  onBackHome, className, ...rest
}: EventClosedScreenProps) {
  return (
    <div data-scr="UI-S-007" className={cn('we-stage is-soft', className)} {...rest}>
      <div className="we-motes" aria-hidden><i /><i /><i /><i /></div>
      <div className="we-screen">
        <WeHeader grade={grade} />
        <div className="we-body">
          <div style={{ fontSize: 56 }} aria-hidden>{cancelled ? '🛑' : '🌙'}</div>
          <h1 className="we-theme-title">{cancelled ? 'Sự kiện đã bị huỷ' : 'Hẹn gặp lại tuần sau!'}</h1>
          {cancelled ? (
            <div className="we-note-plate warn" style={{ textAlign: 'center' }}>
              <span className="em">⚠️</span>
              {cancelReason ?? 'Ban tổ chức đã tạm dừng sự kiện. Mọi kết quả sẽ được xử lý lại.'}
            </div>
          ) : (
            <div className="we-subtle" style={{ maxWidth: 420 }}>
              Sự kiện tuần này đã khép lại. Cùng quay lại vào 10h00 thứ Bảy tới nhé!
            </div>
          )}
          <CountdownTimer to={nextEventAt} skewMs={skewMs} label="Sự kiện tiếp theo" />
        </div>
        <div className="we-foot">
          <GameButton color="ghost" onClick={onBackHome}>Về trang chủ</GameButton>
        </div>
      </div>
    </div>
  );
}
