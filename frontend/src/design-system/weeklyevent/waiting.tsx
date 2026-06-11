/* ============================================================
   Sự kiện tuần · UI-S-002 — Waiting Room (Phòng chờ)
   Tập hợp HS 10h00→10h05, hiệu ứng đám đông.
   Realtime: SOCK-EVT-S01/S02/S03/S09 · FLOW-004
   ============================================================ */
import React, { type ReactNode, type HTMLAttributes } from 'react';
import { CountdownTimer, OnlineCounter, GradeRoomBadge, gradeColor, initialOf } from './shared';
import { WeHeader } from './entry';

const cn = (...xs: Array<string | false | null | undefined>) =>
  xs.filter(Boolean).join(' ');

export interface CrowdFace { name: string; avatarBg?: string; }

export interface WaitingRoomProps extends HTMLAttributes<HTMLDivElement> {
  weeklyTitle: ReactNode;
  grade: number;
  /** Số HS đang trong phòng (SOCK-EVT-S02). */
  onlineCount: number;
  /** Mốc phát đề (T+5) — countdown lớn (SOCK-EVT-S03). */
  startAt: number | Date;
  skewMs?: number;
  /** Một vài gương mặt minh hoạ đám đông. */
  faces?: ReadonlyArray<CrowdFace>;
  tips?: ReadonlyArray<ReactNode>;
  /** Slot bên phải topbar (vd: nút thoát). */
  topRight?: ReactNode;
}

const DEFAULT_TIPS: ReactNode[] = [
  'Đề đồng bộ — cả phòng cùng một câu hỏi',
  'Mỗi câu có giới hạn thời gian',
  'Giữ kết nối mạng ổn định nhé',
];

export function WaitingRoom({
  weeklyTitle, grade, onlineCount, startAt, skewMs = 0,
  faces = [], tips = DEFAULT_TIPS, topRight, className, ...rest
}: WaitingRoomProps) {
  const shown = faces.slice(0, 6);
  const extra = Math.max(0, onlineCount - shown.length);
  return (
    <div data-scr="UI-S-002" className={cn('we-stage', className)} {...rest}>
      <div className="we-motes" aria-hidden><i /><i /><i /><i /><i /><i /></div>
      <div className="we-screen">
        <WeHeader grade={grade} right={topRight ?? <OnlineCounter count={onlineCount} renderLabel={(n) => <><span className="n">{n.toLocaleString('vi-VN')}</span> trong phòng</>} />} />

        <div className="we-body">
          <GradeRoomBadge grade={grade} />
          <div className="we-eyebrow">Chủ đề tuần này</div>
          <h1 className="we-theme-title">{weeklyTitle}</h1>

          <CountdownTimer to={startAt} skewMs={skewMs} label="Phát đề sau" showDays={false} urgentBelowSec={60} />

          <div className="we-tips">
            {tips.map((t, i) => <span key={i} className="we-tip">{t}</span>)}
          </div>
        </div>

        <div className="we-foot">
          <div className="we-subtle">Đừng rời khỏi màn hình — đề sẽ tự xuất hiện khi tới giờ.</div>
        </div>
      </div>
    </div>
  );
}
