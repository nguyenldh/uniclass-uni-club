/* ============================================================
   Săn Boss · SCR-03 — Kết quả lượt ngày
     UI-301 Correct count   UI-303 Points contributed
     UI-302 Total time      UI-304 Boss damage recap
     UI-305 View Leaderboard CTA
   Composed by <BossResult/>.
   ============================================================ */
import React, { type ReactNode, type HTMLAttributes } from 'react';
import { GameButton } from '../game';
import { bossStateFor, type BossState, DEFAULT_BOSS_STATES } from './lobby';

const cn = (...xs: Array<string | false | null | undefined>) =>
  xs.filter(Boolean).join(' ');

const fmtTime = (s: number) => {
  if (s >= 60) {
    const m = Math.floor(s / 60);
    const r = Math.round(s % 60);
    return `${m}:${r.toString().padStart(2, '0')}`;
  }
  return `${s.toFixed(1)}s`;
};

/** Format % máu nhỏ (< 1%) — hiện đủ chữ số để không bị làm tròn về 0. */
const fmtSmallPct = (v: number) => {
  if (v <= 0) return '0';
  return Number(v >= 0.01 ? v.toFixed(2) : v.toFixed(4)).toString();
};

/* ---------- Stat block (UI-301/302/303) ---------- */
export interface ResultStatProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode;
  value: ReactNode;
  /** Làm nổi bật (vàng + glow). */
  hero?: boolean;
}
export function ResultStat({ label, value, hero, className, ...rest }: ResultStatProps) {
  return (
    <div className={cn('bb-stat', hero && 'hero', className)} {...rest}>
      <span className="v">{value}</span>
      <span className="k">{label}</span>
    </div>
  );
}

/* ---------- UI-304 · Boss damage recap ---------- */
export interface BossDamageRecapProps {
  /** % HP boss TRƯỚC lượt này. */
  hpBefore: number;
  /** % HP boss SAU lượt này. */
  hpAfter: number;
  /** Điểm đóng góp lượt này — hiển thị thay % khi % quá nhỏ. */
  pointsContributed?: number;
  states?: BossState[];
  bossName?: ReactNode;
}
export function BossDamageRecap({ hpBefore, hpAfter, pointsContributed, states = DEFAULT_BOSS_STATES, bossName = 'Boss' }: BossDamageRecapProps) {
  const before = Math.max(0, Math.min(100, hpBefore));
  const after = Math.max(0, Math.min(100, hpAfter));
  const delta = Math.max(0, before - after);
  const st = bossStateFor(after, states);
  // Khi % quá nhỏ (< 1%), hiển thị điểm KÈM % tính theo điểm — có ý nghĩa hơn
  const deltaStr = delta >= 1
    ? `−${Number(delta.toFixed(1))}% máu`
    : pointsContributed != null
      ? `−${pointsContributed.toLocaleString('vi-VN')} điểm máu (−${fmtSmallPct(delta)}% máu)`
      : delta > 0
        ? `−${fmtSmallPct(delta)}% máu`
        : '−0 điểm máu';
  return (
    <div data-ui="UI-304" className="bb-recap">
      <div className="recap-top">
        <span><span className="you">Lượt của bạn</span> vừa giáng đòn vào {bossName}</span>
        <span className="delta">{deltaStr}</span>
      </div>
      <div className="bb-bossbar" style={{ background: 'transparent', border: 'none', padding: 0 }}>
        <div className="face"><span aria-hidden>{st.glyph ?? '🐉'}</span></div>
        <div className="bbar-info">
          <div className="bbar-track">
            <div className="bbar-fill" style={{ width: `${after}%` }} />
          </div>
        </div>
        <div className="bbar-hp">{after.toFixed(2)}%</div>
      </div>
    </div>
  );
}

/* ---------- SCR-03 · BossResult (composed) ---------- */
export interface BossResultProps extends HTMLAttributes<HTMLDivElement> {
  /** Số câu đúng (UI-301). */
  correctCount: number;
  /** Tổng số câu trong lượt. */
  totalQuestions?: number;
  /** Tổng thời gian lượt (giây) — UI-302. */
  totalTime: number;
  /** Điểm đóng góp (đã gồm speed bonus) — UI-303. */
  pointsContributed: number;
  /** HP boss trước/sau để vẽ recap (UI-304). */
  hpBefore: number;
  hpAfter: number;
  states?: BossState[];
  bossName?: ReactNode;
  /** Boss bị hạ gục bởi (ai đó trong) lượt này → màn hình ăn mừng. */
  bossDefeated?: boolean;
  onViewLeaderboard?: () => void;
  /** Actions phụ (vd "Về sảnh"). */
  extraActions?: ReactNode;
}
export function BossResult({
  correctCount, totalQuestions = 5, totalTime, pointsContributed,
  hpBefore, hpAfter, states = DEFAULT_BOSS_STATES, bossName = 'Boss',
  bossDefeated = false, onViewLeaderboard, extraActions, className, ...rest
}: BossResultProps) {
  return (
    <div data-scr="SCR-03" className={cn('bb-stage', className)} {...rest}>
      <div className="bb-embers" aria-hidden><i /><i /><i /><i /><i /><i /><i /></div>
      <div className="bb-result">
        <div className={cn('bb-result-head', bossDefeated && 'victory')}>
          <div className="verdict">{bossDefeated ? '⚔️ HẠ GỤC BOSS!' : 'HOÀN THÀNH LƯỢT!'}</div>
          <div className="sub">
            {bossDefeated
              ? `Cả khối đã đánh bại ${bossName} — chờ Boss tuần sau!`
              : 'Đòn đánh của bạn đã được cộng vào máu Boss'}
          </div>
        </div>

        <div className="bb-stats">
          <ResultStat data-ui="UI-301" label="Câu đúng" value={<>{correctCount}<small>/{totalQuestions}</small></>} />
          <ResultStat data-ui="UI-302" label="Tổng thời gian" value={fmtTime(totalTime)} />
          <ResultStat data-ui="UI-303" label="Điểm đóng góp" value={`+${pointsContributed.toLocaleString('vi-VN')}`} hero />
        </div>

        <BossDamageRecap hpBefore={hpBefore} hpAfter={hpAfter} pointsContributed={pointsContributed} states={states} bossName={bossName} />

        <div className="bb-result-actions" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <GameButton data-ui="UI-305" color="orange" onClick={onViewLeaderboard}>Xem bảng xếp hạng</GameButton>
          {extraActions}
        </div>
      </div>
    </div>
  );
}
