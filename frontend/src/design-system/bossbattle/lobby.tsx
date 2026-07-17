/* ============================================================
   Săn Boss · SCR-01 — Sảnh Săn Boss (Boss Lobby)
   Pieces:
     UI-101 BossDisplay        UI-104 WeeklyCountdown
     UI-102 BossHpBar          UI-105 BattleCTA
     UI-103 DailyQuotaBadge    UI-106 BossNameLabel
   Composed by <BossLobby/>.
   ============================================================ */
import React, { type ReactNode, type HTMLAttributes, useEffect, useState, useCallback } from 'react';
import { GameButton, GamePill } from '../game';
import { FlameIcon, LockIcon, CheckIcon } from '../icons';

const cn = (...xs: Array<string | false | null | undefined>) =>
  xs.filter(Boolean).join(' ');

/* ---------- Boss state config (CFG-08 · số mốc TUỲ BIẾN) ---------- */
export type BossTone = 'normal' | 'injured' | 'rage' | 'defeated';

export interface BossState {
  /** HP còn lại tối thiểu (%) áp dụng state này. */
  min: number;
  /** HP còn lại tối đa (%). */
  max: number;
  /** Nhãn hiển thị, vd "HUNG HÃN". */
  label: ReactNode;
  /** Khoá màu/hiệu ứng. */
  tone: BossTone;
  /** URL ảnh boss cho mốc này (CFG-08). */
  img?: string;
  /** Emoji/glyph fallback khi chưa có ảnh. */
  glyph?: string;
}

/** Bộ mốc mặc định (3 trạng thái sống + defeated). Có thể truyền bộ khác để tăng/giảm số mốc. */
export const DEFAULT_BOSS_STATES: BossState[] = [
  { min: 71, max: 100, label: 'BÌNH THƯỜNG', tone: 'normal',   glyph: '🐉' },
  { min: 31, max: 70,  label: 'BỊ THƯƠNG',   tone: 'injured',  glyph: '🐲' },
  { min: 1,  max: 30,  label: 'HUNG HÃN',    tone: 'rage',     glyph: '👹' },
  { min: 0,  max: 0,   label: 'BỊ HẠ GỤC',   tone: 'defeated', glyph: '💀' },
];

/** Suy ra state hiện tại từ % HP còn lại. */
export function bossStateFor(hpPercent: number, states: BossState[] = DEFAULT_BOSS_STATES): BossState {
  const hp = Math.max(0, Math.min(100, hpPercent));
  if (hp <= 0) {
    const dead = states.find((s) => s.tone === 'defeated');
    if (dead) return dead;
  }
  return (
    states.find((s) => hp >= s.min && hp <= s.max && s.tone !== 'defeated') ??
    states[0]
  );
}

/* ---------- Hit Notification (floating damage popup) ---------- */
export interface HitNotification {
  id: string;
  /** Tên người đánh. */
  name: string;
  /** Số điểm. */
  points: number;
  /** Vị trí ngẫu nhiên quanh boss (CSS left, vd '25%'). */
  x: string;
  /** Vị trí ngẫu nhiên quanh boss (CSS top, vd '30%'). */
  y: string;
}

/** Tạo vị trí ngẫu nhiên quanh boss (tránh tâm, ưu tiên rìa). */
export function randomHitPosition(): { x: string; y: string } {
  const angle = Math.random() * Math.PI * 2;
  const radius = 30 + Math.random() * 25; // 30–55% từ tâm → rìa ngoài
  const cx = 50 + Math.cos(angle) * radius;
  const cy = 45 + Math.sin(angle) * radius;
  return { x: `${Math.max(0, Math.min(100, cx))}%`, y: `${Math.max(0, Math.min(100, cy))}%` };
}

/* ---------- UI-101 · Boss Display ---------- */
export interface BossDisplayProps extends HTMLAttributes<HTMLDivElement> {
  /** % HP còn lại (0–100). */
  hpPercent: number;
  /** Lớp art tuỳ ý (vd <image-slot/>) — override img/placeholder. */
  art?: ReactNode;
  /** Ảnh boss state hiện tại từ API/socket — ưu tiên hơn bossStateFor. */
  currentImg?: string;
  /** Ẩn badge trạng thái. */
  hideStateBadge?: boolean;
  /** Rung lắc boss (khi vừa bị đánh). */
  shaking?: boolean;
  /** Hit notifications hiện quanh boss. */
  hits?: HitNotification[];
}

export function BossDisplay({
  hpPercent,
  art,
  currentImg,
  hideStateBadge = false,
  shaking = false,
  hits,
  className,
  ...rest
}: BossDisplayProps) {
  const st = bossStateFor(hpPercent);
  // Ưu tiên ảnh từ API/socket (currentImg), fallback về bossStateFor
  const bossImg = currentImg || st.img;
  return (
    <div data-ui="UI-101" className={cn('bb-boss', st.tone === 'rage' && 'is-rage', st.tone === 'defeated' && 'is-defeated', shaking && 'bb-boss-shake', className)} {...rest}>
      <div className="bb-boss-stage">
        {art ? (
          <div className="bb-boss-art" style={{ display: 'grid', placeItems: 'center' }}>{art}</div>
        ) : bossImg ? (
          <img className="bb-boss-art" src={bossImg} alt="" />
        ) : (
          <div className="bb-boss-ph">
            <span className="glyph" aria-hidden>{st.glyph ?? '🐉'}</span>
            <span className="cap">boss art · {st.tone}<br />HP {st.min}–{st.max}%</span>
          </div>
        )}
      </div>
      {hits && hits.length > 0 && (
        <div className="bb-hit-container">
          {hits.map((h) => (
            <div key={h.id} className="bb-hit" style={{ left: h.x, top: h.y }}>
              <span className="bb-hit-name">{h.name}</span>
              <span className="bb-hit-pts">⚔️ {h.points.toLocaleString('vi-VN')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- UI-106 · Boss Name ---------- */
export interface BossNameLabelProps extends HTMLAttributes<HTMLDivElement> {
  name: ReactNode;
  /** Dòng nhãn nhỏ phía trên. */
  eyebrow?: ReactNode;
}
export function BossNameLabel({ name, eyebrow = 'Boss tuần này', className, ...rest }: BossNameLabelProps) {
  return (
    <div data-ui="UI-106" className={cn('bb-boss-name', className)} {...rest}>
      <span className="lab">{eyebrow}</span>
      <span className="nm">{name}</span>
    </div>
  );
}

/* ---------- UI-102 · Boss HP / Progress bar ---------- */
export interface BossHpBarProps extends HTMLAttributes<HTMLDivElement> {
  /** % HP còn lại (0–100). progressPercent của cả khối = 100 − hpPercent. */
  hpPercent: number;
  /** Dòng phụ tuỳ chọn (vd "Cả khối đã hạ 58% HP"). */
  sub?: ReactNode;
}
export function BossHpBar({ hpPercent, sub, className, ...rest }: BossHpBarProps) {
  const hp = Math.max(0, Math.min(100, hpPercent));
  const low = hp > 0 && hp <= 30;
  const progress = (100 - hp).toFixed(2);
  return (
    <div data-ui="UI-102" className={cn('bb-hp', className)} {...rest}>
      <div className="bb-hp-top">
        <span className="heart"><FlameIcon size={18} /><span className="lab">Máu Boss</span></span>
        <span className="pct"><b>{hp.toFixed(2)}%</b></span>
      </div>
      <div className={cn('bb-hp-track', hp <= 0 && 'zero')}>
        <div className={cn('bb-hp-fill', low && 'low')} style={{ width: `calc(${hp}% - 4px)` }} />
      </div>
      <div className="bb-hp-sub">{sub ?? `Cả khối đã đánh hạ ${progress}% máu Boss`}</div>
    </div>
  );
}

/* ---------- UI-103 · Daily Quota Badge ---------- */
export interface DailyQuotaBadgeProps {
  /** Số câu đã làm hôm nay. */
  done: number;
  /** Tổng số câu/ngày (CFG-02, mặc định 5). */
  total?: number;
}
export function DailyQuotaBadge({ done, total = 5 }: DailyQuotaBadgeProps) {
  const d = Math.max(0, Math.min(total, done));
  return (
    <span data-ui="UI-103" className="bb-quota">
      <span>Câu hỏi hôm nay</span>
      <span className="pips" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <i key={i} className={i < d ? 'used' : 'left'} />
        ))}
      </span>
      <b style={{ fontVariantNumeric: 'tabular-nums' }}>{d}/{total}</b>
    </span>
  );
}

/* ---------- UI-104 · Weekly Reset Countdown ---------- */
export interface WeeklyCountdownProps {
  /** Mốc kết thúc (ms epoch hoặc Date). Mặc định 00h00 Thứ Hai kế tiếp. */
  to?: number | Date;
  label?: ReactNode;
}

/** Mốc reset: 00:00 Thứ Hai giờ Việt Nam (UTC+7) = Chủ Nhật 17:00 UTC */
function nextMonday(): number {
  const now = new Date();
  // Today at 17:00 UTC
  const today17Utc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    17, 0, 0, 0,
  );
  // Days until next Sunday (0 = Sunday in UTC)
  const dayOfWeek = now.getUTCDay();
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  let target = today17Utc + daysUntilSunday * 86400000;
  // If already past this Sunday 17:00 UTC, go to next Sunday
  if (now.getTime() >= target) {
    target += 7 * 86400000;
  }
  return target;
}

export function WeeklyCountdown({ to, label = 'Boss mới sau' }: WeeklyCountdownProps) {
  const target = React.useMemo(
    () => (to == null ? nextMonday() : to instanceof Date ? to.getTime() : to),
    [to]
  );
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, target - now);
  const dd = Math.floor(diff / 86400000);
  const hh = Math.floor((diff % 86400000) / 3600000);
  const mm = Math.floor((diff % 3600000) / 60000);
  const ss = Math.floor((diff % 60000) / 1000);
  const seg = (v: number, u: string) => (
    <span className="seg">{v.toString().padStart(2, '0')}<small>{u}</small></span>
  );
  return (
    <span data-ui="UI-104" className="bb-countdown">
      <span className="lab">{label}</span>
      <span className="clock">
        {dd > 0 && <>{seg(dd, 'NGÀY')}<span className="colon">:</span></>}
        {seg(hh, 'GIỜ')}<span className="colon">:</span>
        {seg(mm, 'PHÚT')}<span className="colon">:</span>
        {seg(ss, 'GIÂY')}
      </span>
    </span>
  );
}

/* ---------- UI-105 · Battle CTA ---------- */
export type BattleCtaStatus = 'ready' | 'completed' | 'defeated' | 'closed';
export interface BattleCTAProps {
  status?: BattleCtaStatus;
  onBattle?: () => void;
  /** Override nhãn nút khi ready. */
  label?: ReactNode;
}
export function BattleCTA({ status = 'ready', onBattle, label = 'Chiến đấu' }: BattleCTAProps) {
  if (status === 'closed') {
    return (
      <div data-ui="UI-105" className="bb-lock-note">
        <LockIcon size={18} color="#aab2bc" /> Tuần đã đóng — chờ đợt mới
      </div>
    );
  }
  if (status === 'defeated') {
    return (
      <div data-ui="UI-105" className="bb-lock-note win">
        <TrophyMini /> Boss đã bị hạ gục — chờ đợt tuần sau
      </div>
    );
  }
  if (status === 'completed') {
    return (
      <div data-ui="UI-105" className="bb-lock-note">
        <CheckIcon size={18} color="#9be38a" /> Đã hoàn thành hôm nay
      </div>
    );
  }
  return (
    <GameButton data-ui="UI-105" color="orange" size="lg" onClick={onBattle} icon={<FlameIcon size={22} />}>
      {label}
    </GameButton>
  );
}
function TrophyMini() {
  return <span aria-hidden style={{ fontSize: 16 }}>🏆</span>;
}

/* ---------- SCR-01 · BossLobby (composed) ---------- */
export interface BossLobbyProps extends HTMLAttributes<HTMLDivElement> {
  bossName: ReactNode;
  hpPercent: number;
  /** Lớp art tuỳ ý cho boss (vd <image-slot/>). */
  bossArt?: ReactNode;
  /** Ảnh boss state hiện tại từ API/socket — ưu tiên hơn bossStateFor. */
  currentImg?: string;
  dailyDone: number;
  dailyTotal?: number;
  ctaStatus?: BattleCtaStatus;
  onBattle?: () => void;
  /** Mốc reset (ms/Date). Mặc định 00h00 Thứ Hai kế. */
  resetAt?: number | Date;
  /** Tên người chơi hiển thị góc phải, vd "Nguyễn Văn A". */
  playerName?: ReactNode;
  /** Khối lớp hiển thị góc phải, vd "Khối 4". */
  grade?: ReactNode;
  topRight?: ReactNode;
  /** Slot hành động đặt ngay dưới tên boss (vd: nút Bảng xếp hạng). */
  nameAction?: ReactNode;
  /** Hit notifications quanh boss. */
  hits?: HitNotification[];
  /** Rung lắc boss (khi vừa bị đánh). */
  shaking?: boolean;
}

export function BossLobby({
  bossName, hpPercent, bossArt, currentImg,
  dailyDone, dailyTotal = 5, ctaStatus = 'ready', onBattle,
  resetAt, playerName, grade, topRight, nameAction, hits, shaking, className, ...rest
}: BossLobbyProps) {
  return (
    <div data-scr="SCR-01" className={cn('bb-stage', className)} {...rest}>
      <div className="bb-embers" aria-hidden><i /><i /><i /><i /><i /><i /><i /></div>
      <div className="bb-lobby">
        <div className="bb-topbar">
          <h1 className="bb-title"><span className="crest" aria-hidden>⚔️</span>SĂN BOSS</h1>
          <div className="bb-topbar-right">
            {playerName && <span className="bb-chip bb-chip-name" style={{ background: 'rgba(255,255,255,0.12)' }}>{playerName}</span>}
            {grade && <span className="bb-chip">{grade}</span>}
            {topRight}
          </div>
        </div>

        <div className="bb-lobby-main">
          <BossDisplay hpPercent={hpPercent} art={bossArt} currentImg={currentImg} shaking={shaking} hits={hits} />
          <BossNameLabel name={bossName} />
          {nameAction && <div className="bb-name-action">{nameAction}</div>}
          <BossHpBar hpPercent={hpPercent} />
        </div>

        <div className="bb-lobby-foot">
          <div className="bb-meta-row">
            <DailyQuotaBadge done={dailyDone} total={dailyTotal} />
            <WeeklyCountdown to={resetAt} label={<>Thời gian còn lại để chiến đấu với {bossName}</>} />
          </div>
          <BattleCTA status={ctaStatus} onBattle={onBattle} />
        </div>
      </div>
    </div>
  );
}
