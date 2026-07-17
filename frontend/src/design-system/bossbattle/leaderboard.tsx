/* ============================================================
   Săn Boss · SCR-04 — Bảng xếp hạng (theo khối, real-time)
     UI-401 Podium (Top 3)     UI-403 MyRankCard (ghim đáy)
     UI-402 RankList (rank 4+)
   Composed by <BossLeaderboard/>. <Podium/> dùng lại cho SCR-05.

   Xếp hạng theo 4 tiêu chí (đồng hạng khi trùng cả 4):
     (1) Tổng điểm  (2) Số câu đúng  (3) Thời gian trả lời (đến ms)
     (4) Thời điểm hệ thống ghi nhận câu trả lời
   Mặc định chỉ hiển thị Tổng điểm; bấm "i" để xem chi tiết 3 tiêu chí còn lại.
   ============================================================ */
import React, { type ReactNode, type HTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
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
  /** Số câu đúng tuần (tiêu chí #2). */
  correctCount: number;
  /** Tổng thời gian câu đúng (giây, đến ms — tiêu chí #3). */
  totalCorrectTimeSec: number;
  /** Thời điểm hệ thống ghi nhận (tiêu chí #4). */
  lastAchievedAt?: string | Date | null;
  /** Tổng điểm đóng góp tuần (tiêu chí #1 — mặc định hiển thị). */
  pointsContributed: number;
  /** Đồng hạng: trùng cả 4 tiêu chí với entry khác. */
  isTied?: boolean;
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

const fmtPts = (n?: number | null) => (n ?? 0).toLocaleString('vi-VN');

/**
 * Thời gian trả lời — hiển thị đến mili giây (số thập phân, dấu phẩy VN).
 * Đây là trường hợp DUY NHẤT trong Uniclub dùng số thập phân, nhằm minh bạch xếp hạng.
 * Vd: 90.015s → "90,015 giây" (= 1p30s15ms).
 */
const fmtTimeMs = (s?: number | null) =>
  `${(s ?? 0).toLocaleString('vi-VN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} giây`;

/** Thời điểm ghi nhận — HH:MM:SS.mmm · DD/MM/YYYY (đến ms vì là tiêu chí xếp hạng). */
const fmtStamp = (v?: string | Date | null) => {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n: number, len = 2) => String(n).padStart(len, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)} · ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

/* ---------- Tooltip "Chi tiết" (portal, chạy được trên cả touch) ---------- */
interface DetailTipProps {
  correctCount: number;
  totalCorrectTimeSec: number;
  lastAchievedAt?: string | Date | null;
  isTied?: boolean;
}
function DetailTip({ correctCount, totalCorrectTimeSec, lastAchievedAt, isTied }: DetailTipProps) {
  const [open, setOpen] = React.useState(false);
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);

  const place = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Neo mép phải tooltip vào nút (CSS dịch translateX(-100%)), mở xuống dưới.
    setPos({ top: r.bottom + 8, left: r.right });
  };

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen((o) => {
      if (!o) place();
      return !o;
    });
  };

  React.useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    // Cuộn danh sách / đổi kích thước / chạm ra ngoài → đóng
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('pointerdown', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('pointerdown', close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="bb-tip-btn"
        aria-label="Chi tiết xếp hạng"
        aria-expanded={open}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={toggle}
      >
        i
      </button>
      {open && pos &&
        createPortal(
          <div
            className="bb-tip"
            role="tooltip"
            style={{ top: pos.top, left: pos.left }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="bb-tip-head">Tiêu chí xếp hạng</div>
            <div className="bb-tip-row"><span>Số câu đúng</span><b>{correctCount}</b></div>
            <div className="bb-tip-row"><span>Thời gian trả lời</span><b>{fmtTimeMs(totalCorrectTimeSec)}</b></div>
            <div className="bb-tip-row"><span>Thời điểm ghi nhận</span><b>{fmtStamp(lastAchievedAt)}</b></div>
            {isTied && <div className="bb-tip-tie">Đồng hạng — bằng nhau cả 4 tiêu chí</div>}
          </div>,
          document.body,
        )}
    </>
  );
}

/** Dấu đồng hạng nhỏ cạnh số thứ hạng. */
function TieMark({ show }: { show?: boolean }) {
  return show ? <i className="bb-tie-mark" title="Đồng hạng" aria-label="Đồng hạng">=</i> : null;
}

/* ---------- UI-401 · Podium ---------- */
export interface PodiumProps extends HTMLAttributes<HTMLDivElement> {
  /** Top 3, sắp theo rank tăng dần. */
  top3: RankEntry[];
}
export function Podium({ top3, className, ...rest }: PodiumProps) {
  // Render theo vị trí bục [Nhì · Nhất · Ba] dựa trên thứ tự mảng (tie-safe).
  const [first, second, third] = top3;
  const slots = [
    { e: second, medal: 1 },
    { e: first, medal: 0 },
    { e: third, medal: 2 },
  ];
  return (
    <div data-ui="UI-401" className={cn('bb-podium', className)} {...rest}>
      {slots.map(({ e, medal }, i) => {
        if (!e) return <div key={i} />;
        return (
          <div className={cn('bb-pod', `r${medal + 1}`, e.isTied && 'tied')} key={`pod-${medal}-${e.name}`}>
            {medal === 0 && <span className="crown" aria-hidden><TrophyIcon size={42} /></span>}
            <AvatarImage src={e.avatar} name={e.name} size="lg" style={{ background: e.avatarBg ?? RANK_BG[medal] }} />
            <div className="nm">{e.name}</div>
            <div className="sc">
              <span className="pts"><b>{fmtPts(e.pointsContributed)}</b> điểm</span>
              <DetailTip
                correctCount={e.correctCount}
                totalCorrectTimeSec={e.totalCorrectTimeSec}
                lastAchievedAt={e.lastAchievedAt}
                isTied={e.isTied}
              />
            </div>
            <div className="block">{e.rank}<TieMark show={e.isTied} /></div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- UI-402 · Rank row + list ---------- */
export function RankRow({ entry }: { entry: RankEntry; qpw?: number }) {
  return (
    <div className={cn('bb-rank', entry.isMe && 'me', entry.isTied && 'tied')}>
      <span className="pos">{entry.rank}<TieMark show={entry.isTied} /></span>
      <span className="av" style={{ background: entry.avatarBg ?? fallbackBg(entry.rank) }}>
        <AvatarImage src={entry.avatar} name={entry.name} style={{ background: entry.avatarBg ?? RANK_BG[entry.rank - 1] }} />
      </span>
      <div className="info">
        <div className="nm">{entry.name}</div>
        {entry.meta && <div className="meta">{entry.meta}</div>}
      </div>
      <div className="right">
        <span className="pts"><b>{fmtPts(entry.pointsContributed)}</b> <small>điểm</small></span>
        <DetailTip
          correctCount={entry.correctCount}
          totalCorrectTimeSec={entry.totalCorrectTimeSec}
          lastAchievedAt={entry.lastAchievedAt}
          isTied={entry.isTied}
        />
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
export function MyRankCard({ entry }: MyRankCardProps) {
  if (!entry) {
    return (
      <div data-ui="UI-403" className="bb-myrank empty">
        <span className="pos">–<small>HẠNG</small></span>
        <span className="av" style={{ background: 'rgba(255,255,255,.12)', borderColor: 'rgba(255,255,255,.3)' }}>?</span>
        <div className="info">
          <div className="nm">Chưa xếp hạng</div>
          <div className="meta">Làm bài hôm nay để leo bảng xếp hạng</div>
        </div>
        <div className="right"><span className="pts"><b>0</b> <small>điểm</small></span></div>
      </div>
    );
  }
  return (
    <div data-ui="UI-403" className={cn('bb-myrank', entry.isTied && 'tied')}>
      <span className="pos">#{entry.rank}<TieMark show={entry.isTied} /><small>HẠNG</small></span>
      <span className="av" style={{ background: entry.avatarBg ?? fallbackBg(0) }}>
        <AvatarImage src={entry.avatar} name={entry.name} style={{ background: entry.avatarBg ?? RANK_BG[entry.rank - 1] }} />
      </span>
      <div className="info">
        <div className="nm">{entry.name} <span style={{ opacity: .6, fontWeight: 700, fontSize: 12 }}>(Bạn)</span></div>
        <div className="meta">{entry.meta}</div>
      </div>
      <div className="right">
        <span className="pts"><b>{fmtPts(entry.pointsContributed)}</b> <small>điểm</small></span>
        <DetailTip
          correctCount={entry.correctCount}
          totalCorrectTimeSec={entry.totalCorrectTimeSec}
          lastAchievedAt={entry.lastAchievedAt}
          isTied={entry.isTied}
        />
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
  // Chia theo thứ tự mảng (đã sắp) để an toàn khi có đồng hạng ở top.
  const podium = entries.slice(0, 3);
  const rest4 = entries.slice(3);
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
        <Podium top3={podium} />
        <RankList entries={rest4} questionsPerWeek={questionsPerWeek} />
        <MyRankCard entry={myEntry} questionsPerWeek={questionsPerWeek} />
      </div>
    </div>
  );
}
