/* ============================================================
   Săn Boss · SCR-04 — Bảng xếp hạng (theo khối, real-time)
     UI-401 Podium (Top 3)     UI-403 MyRankCard (ghim đáy)
     UI-402 RankList (rank 4+)
   Composed by <BossLeaderboard/>. <Podium/> dùng lại cho SCR-05.
   ============================================================ */
import React, { type ReactNode, type HTMLAttributes } from 'react';
import { TrophyIcon } from '../icons';
import { AvatarImage } from '../../components/AvatarImage';

const cn = (...xs: Array<string | false | null | undefined>) =>
  xs.filter(Boolean).join(' ');

export interface RankEntry {
  rank: number;
  name: string;
  /** Avatar content. Mặc định = ký tự đầu của name. */
  avatar: string;
  avatarBg?: string;
  /** Số câu đúng tuần (tiêu chí #1). */
  correctCount: number;
  /** Tổng thời gian câu đúng (giây, tiêu chí #2). */
  totalCorrectTimeSec: number;
  /** Điểm đóng góp tuần. */
  pointsContributed: number;
  /** Dòng phụ, vd "Lớp 4A1". */
  meta?: ReactNode;
  /** Đánh dấu chính là HS hiện tại. */
  isMe?: boolean;
}

const RANK_BG = [
  'linear-gradient(135deg,#ffd76b,#e8a210)',
  'linear-gradient(135deg,#dfe8f5,#9fb2cc)',
  'linear-gradient(135deg,#e0ad77,#b5743a)',
];
const fallbackBg = (i: number) =>
  ['linear-gradient(135deg,#ffb24a,#e8530e)','linear-gradient(135deg,#a3c4ff,#3a6df0)',
   'linear-gradient(135deg,#b6e7c2,#2bb673)','linear-gradient(135deg,#d3b6ff,#7a4fe6)'][i % 4];

const initialOf = (name: ReactNode) =>
  typeof name === 'string' && name.length > 0 ? name.trim().charAt(0).toUpperCase() : '?';
const fmtTime = (s?: number | null) => {
  const safeS = s ?? 0;
  const m = Math.floor(safeS / 60);
  const r = Math.round(safeS % 60);
  return m > 0 ? `${m}p${r.toString().padStart(2, '0')}` : `${Math.round(safeS)}s`;
};
const fmtPts = (n?: number | null) => (n ?? 0).toLocaleString('vi-VN');

/* ---------- UI-401 · Podium ---------- */
export interface PodiumProps extends HTMLAttributes<HTMLDivElement> {
  /** Top 3, sắp theo rank 1..3. */
  top3: RankEntry[];
  /** Nhãn dưới điểm: 'correct' (mặc định) hoặc tự do. */
  showTime?: boolean;
}
export function Podium({ top3, showTime = true, className, ...rest }: PodiumProps) {
  const byRank = (r: number) => top3.find((e) => e.rank === r);
  const order = [byRank(2), byRank(1), byRank(3)];
  return (
    <div data-ui="UI-401" className={cn('bb-podium', className)} {...rest}>
      {order.map((e, i) => {
        if (!e) return <div key={i} />;
        const cls = `r${e.rank}`;
        return (
          <div className={cn('bb-pod', cls)} key={`pod-${e.rank}-${e.name}`}>
            {e.rank === 1 && <span className="crown" aria-hidden><TrophyIcon size={42} /></span>}
            <AvatarImage src={e.avatar} name={e.name} size="lg" style={{ background: e.avatarBg ?? RANK_BG[i] }} />
            <div className="nm">{e.name}</div>
            <div className="sc">
              <span><b>{e.correctCount}</b> câu</span>
              <span>{fmtPts(e.pointsContributed)} đ</span>
              {showTime && <span>{fmtTime(e.totalCorrectTimeSec)}</span>}
            </div>
            <div className="block">{e.rank}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- UI-402 · Rank row + list ---------- */
export function RankRow({ entry, qpw }: { entry: RankEntry; qpw?: number }) {
  return (
    <div className={cn('bb-rank', entry.isMe && 'me')}>
      <span className="pos">{entry.rank}</span>
      <span className="av" style={{ background: entry.avatarBg ?? fallbackBg(entry.rank) }}>
        <AvatarImage src={entry.avatar} name={entry.name} style={{ background: entry.avatarBg ?? RANK_BG[entry.rank - 1] }} />
      </span>
      <div className="info">
        <div className="nm">{entry.name}</div>
        {entry.meta && <div className="meta">{entry.meta}</div>}
      </div>
      <div className="right">
        <div className="correct">{entry.correctCount} câu</div>
        <div className="points">{fmtPts(entry.pointsContributed)} đ</div>
        <div className="time">{fmtTime(entry.totalCorrectTimeSec)}</div>
      </div>
    </div>
  );
}

export interface RankListProps {
  /** Rank 4 trở đi. */
  entries: RankEntry[];
  questionsPerWeek?: number;
}
export function RankList({ entries, questionsPerWeek }: RankListProps) {
  return (
    <div data-ui="UI-402" className="bb-ranklist">
      {entries.map((e) => <RankRow key={`row-${e.rank}-${e.name}`} entry={e} qpw={questionsPerWeek} />)}
    </div>
  );
}

/* ---------- UI-403 · My Rank Card (sticky) ---------- */
export interface MyRankCardProps {
  /** null/undefined = chưa xếp hạng. */
  entry?: RankEntry | null;
  /** Mẫu số "x/N câu" (CFG-02b, mặc định 35). */
  questionsPerWeek?: number;
}
export function MyRankCard({ entry, questionsPerWeek = 35 }: MyRankCardProps) {
  if (!entry) {
    return (
      <div data-ui="UI-403" className="bb-myrank empty">
        <span className="pos">–<small>HẠNG</small></span>
        <span className="av" style={{ background: 'rgba(255,255,255,.12)', borderColor: 'rgba(255,255,255,.3)' }}>?</span>
        <div className="info">
          <div className="nm">Chưa xếp hạng</div>
          <div className="meta">Làm bài hôm nay để leo bảng xếp hạng</div>
        </div>
        <div className="right"><div className="correct">0 câu</div><div className="points">0 đ</div><div className="time">–</div></div>
      </div>
    );
  }
  return (
    <div data-ui="UI-403" className="bb-myrank">
      <span className="pos">#{entry.rank}<small>HẠNG</small></span>
      <span className="av" style={{ background: entry.avatarBg ?? fallbackBg(0) }}>
        <AvatarImage src={entry.avatar} name={entry.name} style={{ background: entry.avatarBg ?? RANK_BG[entry.rank - 1] }} />
      </span>
      <div className="info">
        <div className="nm">{entry.name} <span style={{ opacity: .6, fontWeight: 700, fontSize: 12 }}>(Bạn)</span></div>
        <div className="meta">{entry.meta}</div>
      </div>
      <div className="right">
        <div className="correct">{entry.correctCount} câu</div>
        <div className="points">{fmtPts(entry.pointsContributed)} đ</div>
        <div className="time">{fmtTime(entry.totalCorrectTimeSec)}</div>
      </div>
    </div>
  );
}

/* ---------- SCR-04 · BossLeaderboard (composed) ---------- */
export interface BossLeaderboardProps extends HTMLAttributes<HTMLDivElement> {
  /** Toàn bộ bảng xếp hạng đã sắp (rank tăng dần). */
  entries: RankEntry[];
  myEntry?: RankEntry | null;
  questionsPerWeek?: number;
  grade?: ReactNode;
  topRight?: ReactNode;
  /** Tiêu đề trang (mặc định "BẢNG XẾP HẠNG"). Đổi tên thành heading để tránh xung đột với HTML title attribute. */
  heading?: ReactNode;
}
export function BossLeaderboard({
  entries, myEntry, questionsPerWeek = 35, grade, topRight,
  heading = 'BẢNG XẾP HẠNG', className, ...rest
}: BossLeaderboardProps) {
  const top3 = entries.filter((e) => e.rank <= 3);
  const rest4 = entries.filter((e) => e.rank >= 4);
  return (
    <div data-scr="SCR-04" className={cn('bb-stage', className)} {...rest}>
      <div className="bb-lb">
        <div className="bb-topbar">
          <h1 className="bb-title"><span className="crest" aria-hidden>🏆</span>{heading}</h1>
          <div className="bb-topbar-right">
            {grade && <span className="bb-chip">{grade}</span>}
            {topRight}
          </div>
        </div>
        <Podium top3={top3} />
        <RankList entries={rest4} questionsPerWeek={questionsPerWeek} />
        <MyRankCard entry={myEntry} questionsPerWeek={questionsPerWeek} />
      </div>
    </div>
  );
}
