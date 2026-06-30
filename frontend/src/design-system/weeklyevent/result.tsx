/* ============================================================
   Sự kiện tuần · UI-S-006 — Personal Result Screen (Kết quả cá nhân)
   Cho HS không lọt Top hoặc muốn xem chi tiết. Đọc: DATA-M-006
   ============================================================ */
import React, { type ReactNode, type HTMLAttributes } from 'react';
import { PersonalStatsCard, GradeRoomBadge } from './shared';
import { WeHeader } from './entry';
import { GameButton } from '../game';

const cn = (...xs: Array<string | false | null | undefined>) =>
  xs.filter(Boolean).join(' ');

export interface PersonalResultScreenProps extends Omit<HTMLAttributes<HTMLDivElement>, 'className'> {
  grade: number;
  name: string;
  className?: any;
  avatarBg?: string;
  avatarUrl?: string;
  correct: number;
  wrong: number;
  skipped: number;
  score: number;
  rank: number;
  /** Tổng số HS trong khối (mẫu số "trên N"). */
  totalParticipants?: number;
  totalTimeMs: number;
  /** Bật nút "Xem lại đáp án" (nếu config cho phép). */
  allowReview?: boolean;
  onReview?: () => void;
  onLeaderboard?: () => void;
  headerRight: ReactNode;
}

export function PersonalResultScreen({
  grade, name, className: cls, avatarBg, avatarUrl, correct, wrong, skipped, score, rank,
  totalParticipants, totalTimeMs, allowReview = false, onReview, onLeaderboard,
  className, headerRight, ...rest
}: PersonalResultScreenProps) {
  return (
    <div data-scr="UI-S-006" className={cn('we-stage is-soft', className)} {...rest}>
      <div className="we-motes" aria-hidden><i /><i /><i /><i /></div>
      <div className="we-result">
        <WeHeader grade={grade} right={headerRight} />

        <div className="we-body">
          <div className="we-result-hero">
            <div className="we-eyebrow">Kết quả của bạn</div>
            <div className="we-bigscore">
              {score} <span style={{ fontSize: '0.45em', fontWeight: 800, opacity: 0.85 }}>cúp</span>
            </div>
            <div className="we-subtle">
              Hạng <b style={{ color: 'var(--we-gold)' }}>#{rank}</b>
              {totalParticipants != null && <> trên {totalParticipants.toLocaleString('vi-VN')} bạn cùng khối</>}
            </div>
          </div>
          <PersonalStatsCard
            name={name} className={cls} avatarBg={avatarBg} avatarUrl={avatarUrl}
            correct={correct} wrong={wrong} skipped={skipped}
            score={score} rank={rank} totalTimeMs={totalTimeMs}
          />
        </div>

        <div className="we-foot">
          <GameButton color="ghost" onClick={onLeaderboard}>Xem bảng vinh danh</GameButton>
          {allowReview && <GameButton color="orange" onClick={onReview}>Xem lại đáp án</GameButton>}
        </div>
      </div>
    </div>
  );
}
