/* ============================================================
   Săn Boss · SCR-05 — Vinh danh & phần thưởng (cuối tuần)
     UI-501 HonorBannerCarousel   UI-503 HonorHallPodium
     UI-502 WeeklyAvatarFrame
   Composed by <BossHonor/>.
   ============================================================ */
import React, { type ReactNode, type HTMLAttributes } from 'react';
import { Podium, type RankEntry } from './leaderboard';
import { AvatarImage } from '../../components/AvatarImage';

const cn = (...xs: Array<string | false | null | undefined>) =>
  xs.filter(Boolean).join(' ');

const initialOf = (name: ReactNode) =>
  typeof name === 'string' && name.length > 0 ? name.trim().charAt(0).toUpperCase() : '?';
const BG = (i: number) =>
  ['linear-gradient(135deg,#ffd76b,#e8a210)','linear-gradient(135deg,#dfe8f5,#9fb2cc)',
   'linear-gradient(135deg,#e0ad77,#b5743a)','linear-gradient(135deg,#a3c4ff,#3a6df0)',
   'linear-gradient(135deg,#b6e7c2,#2bb673)','linear-gradient(135deg,#d3b6ff,#7a4fe6)'][i % 6];

/* ---------- UI-501 · Home Banner Carousel ---------- */
export interface HonorBannerCarouselProps {
  /** Top 10 (rank tăng dần). */
  entries: RankEntry[];
  ribbon?: ReactNode;
  /** Mili-giây mỗi slide (0 = tắt tự chạy). */
  interval?: number;
}
export function HonorBannerCarousel({ entries, ribbon = 'Vinh danh tuần này', interval = 3200 }: HonorBannerCarouselProps) {
  const [i, setI] = React.useState(0);
  const n = entries.length;
  React.useEffect(() => {
    if (!interval || n <= 1) return;
    const t = setInterval(() => setI((p) => (p + 1) % n), interval);
    return () => clearInterval(t);
  }, [interval, n]);
  if (n === 0) return null;
  const e = entries[i];
  return (
    <div data-ui="UI-501" className="bb-banner">
      <span className="ribbon">{ribbon}</span>
      <div className="bb-banner-row" key={e.rank}>
        <span className="rank">#{e.rank}</span>
        <span className="av" style={{ background: e.avatarBg ?? BG(e.rank - 1) }}>
            <AvatarImage src={e.avatar} name={e.name} style={{ background: e.avatarBg ?? BG(e.rank - 1) }} />
        </span>
        <div className="who">
          <div className="nm">{e.name}</div>
          {e.meta && <div className="meta">{e.meta}</div>}
        </div>
      </div>
      <div className="bb-banner-dots">
        {entries.map((_, k) => (
          <i key={k} className={k === i ? 'on' : ''} onClick={() => setI(k)} />
        ))}
      </div>
    </div>
  );
}

/* ---------- UI-502 · Weekly Avatar Frame ---------- */
export interface WeeklyAvatarFrameProps {
  name: string;
  avatar?: string;
  avatarBg?: string;
  /** Nhãn khung, mặc định "Dũng sĩ diệt Boss". */
  frameLabel?: ReactNode;
  /** Số ngày còn hiệu lực (mặc định 7). */
  daysLeft?: number;
}
export function WeeklyAvatarFrame({
  name, avatar, avatarBg = 'linear-gradient(135deg,#ffb24a,#e8530e)',
  frameLabel = 'Dũng sĩ diệt Boss', daysLeft = 7,
}: WeeklyAvatarFrameProps) {
  return (
    <div data-ui="UI-502" className="bb-frame-demo">
      <div className="bb-aframe">
        <div className="ring" aria-hidden />
        <div className="av" style={{ background: avatarBg }}>
          <AvatarImage src={avatar} name={name} style={{ background: avatarBg }} />
        </div>
        <span className="ribbon">{frameLabel}</span>
      </div>
      <div className="bb-frame-cap">
        Khung avatar giới hạn cho <b>{name}</b><br />
        Hiệu lực còn <b>{daysLeft} ngày</b>
      </div>
    </div>
  );
}

/* ---------- UI-503 · Honor Hall Podium ---------- */
export interface HonorHallPodiumProps { top3: RankEntry[]; }
export function HonorHallPodium({ top3 }: HonorHallPodiumProps) {
  return <Podium top3={top3} data-ui="UI-503" />;
}

/* ---------- SCR-05 · BossHonor (composed) ---------- */
export interface BossHonorProps extends HTMLAttributes<HTMLDivElement> {
  /** Top 10 tuần trước. */
  top10: RankEntry[];
  /** HS được cấp khung (thường là top 1 hoặc HS hiện tại nếu vào top). */
  framePlayer?: WeeklyAvatarFrameProps;
  grade?: ReactNode;
  topRight?: ReactNode;
  heading?: ReactNode;
}
export function BossHonor({
  top10, framePlayer, grade, topRight, heading = 'VINH DANH', className, ...rest
}: BossHonorProps) {
  const top3 = top10.filter((e) => e.rank <= 3);
  const fp = framePlayer ?? (top10[0] ? { name: top10[0].name, avatar: top10[0].avatar, avatarBg: top10[0].avatarBg } : undefined);
  return (
    <div data-scr="SCR-05" className={cn('bb-stage', className)} {...rest}>
      <div className="bb-embers" aria-hidden><i /><i /><i /><i /><i /><i /><i /></div>
      <div className="bb-honor">
        <div className="bb-topbar">
          <h1 className="bb-title"><span className="crest" aria-hidden>👑</span>{heading}</h1>
          <div className="bb-topbar-right">
            {grade && <span className="bb-chip">{grade}</span>}
            {topRight}
          </div>
        </div>
        <div className="bb-honor-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <HonorBannerCarousel entries={top10} />
            <HonorHallPodium top3={top3} />
          </div>
          {fp && <WeeklyAvatarFrame {...fp} />}
        </div>
      </div>
    </div>
  );
}
