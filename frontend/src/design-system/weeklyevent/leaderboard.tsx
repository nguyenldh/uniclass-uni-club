/* ============================================================
   Sự kiện tuần · UI-S-005 — Leaderboard Screen (Vinh danh)
   Top N của khối (10h27→10h30). Highlight dòng của HS hiện tại.
   Đọc: DATA-M-007 snapshot, DATA-M-006 · SOCK-EVT-S06/S07 · FLOW-010
   ============================================================ */
import React, { type ReactNode, type HTMLAttributes } from 'react';
import { AvatarImage } from '../../components/AvatarImage';
import {
  LeaderboardRow, PersonalStatsCard, GradeRoomBadge, gradeColor, initialOf,
  fmtDuration, type LeaderboardEntry,
} from './shared';
import { WeHeader } from './entry';
import { TrophyIcon } from '../icons';

const cn = (...xs: Array<string | false | null | undefined>) =>
  xs.filter(Boolean).join(' ');

export interface PersonalResult {
  name: string; className?: ReactNode; avatarBg?: string;
  avatarUrl?: string;
  correct: number; wrong: number; skipped: number;
  score: number; rank: number; totalTimeMs: number;
}

export interface LeaderboardScreenProps extends HTMLAttributes<HTMLDivElement> {
  grade: number;
  weeklyTitle?: ReactNode;
  /** Đã sắp xếp theo rank tăng dần (consumer sắp sẵn). */
  entries: ReadonlyArray<LeaderboardEntry>;
  total?: number;
  /** Kết quả cá nhân ghim đáy (UI-C-007). */
  me?: PersonalResult | null;
  right?: ReactNode;
}

export function LeaderboardScreen({
  grade, weeklyTitle, entries, total = 25, me = null, right, className, ...rest
}: LeaderboardScreenProps) {
  const top3 = entries.slice(0, 3);
  const rest_ = entries.slice(3);
  // podium slots: [hạng 2 · trái, hạng 1 · giữa, hạng 3 · phải]
  // Giữ nguyên 3 ô (kể cả khi thiếu người) để hạng 1 luôn nằm ở cột giữa.
  const podiumSlots: Array<LeaderboardEntry | undefined> = [top3[1], top3[0], top3[2]];
  const hasPodium = top3.length > 0;
  const isEmpty = entries.length === 0;

  return (
    <div data-scr="UI-S-005" className={cn('we-stage', className)} {...rest}>
      <div className="we-motes" aria-hidden><i /><i /><i /><i /><i /><i /></div>
      <div className="we-board">
        <WeHeader grade={grade} right={right} />

        <div className="we-board-head">
          <div className="we-marquee"><span className="bulb" />Bảng xếp hạng<span className="bulb" /></div>
          {/* {weeklyTitle && <div className="we-subtle" style={{ marginTop: 4 }}>{weeklyTitle}</div>} */}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minHeight: 0 }}>
          {isEmpty && (
            <div
              className="we-note-plate"
              style={{ textAlign: 'center', margin: '12px auto', maxWidth: 460 }}
            >
              <span className="em" aria-hidden>🏆</span>
              Bảng xếp hạng tuần trước đã đóng. Bảng xếp hạng tuần này sẽ xuất hiện khi sự kiện tuần này kết thúc!
            </div>
          )}

          {hasPodium && (
            <div className="we-podium">
              {podiumSlots.map((e, i) =>
                e ? (
                  <div key={e.rank} className={cn('we-pod', `r${e.rank}`)}>
                    {e.rank === 1 && <TrophyIcon size={34} className="crown" />}
                    <span className="rk">{e.rank}</span>
                    <AvatarImage
                      src={e.avatarUrl}
                      name={e.displayName}
                      avatarBg={e.avatarBg ?? gradeColor(grade)}
                      className="av"
                    />
                    <span className="nm">{e.displayName}{e.isMe && ' (Bạn)'}</span>
                    <span className="sc">{e.correctCount}/{total} · {fmtDuration(e.totalTimeMs / 1000)}</span>
                  </div>
                ) : (
                  <div key={`pod-empty-${i}`} className="we-pod-empty" aria-hidden />
                )
              )}
            </div>
          )}

          {rest_.length > 0 && (
            <div className="we-rows">
              {rest_.map((e) => <LeaderboardRow key={e.rank} entry={e} total={total} />)}
            </div>
          )}
        </div>

        <div className="we-foot" style={{ flexDirection: 'column' }}>
          {me ? (
            <PersonalStatsCard
              name={me.name} className={me.className} avatarBg={me.avatarBg} avatarUrl={me.avatarUrl}
              correct={me.correct} wrong={me.wrong} skipped={me.skipped}
              score={me.score} rank={me.rank} totalTimeMs={me.totalTimeMs}
            />
          ) : (
            <GradeRoomBadge grade={grade} />
          )}
        </div>
      </div>
    </div>
  );
}
