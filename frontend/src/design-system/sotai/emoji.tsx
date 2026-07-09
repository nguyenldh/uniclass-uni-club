/* ============================================================
   So Tài · Emoji khiêu khích (provoke)
   - EmojiStrip: dải emoji căn giữa NGAY TRÊN phần đáp án, vuốt được trên
     mobile + nút prev/next khi tràn, emoji vừa dùng đưa lên đầu (MRU),
     tự quản cooldown
   - FlyingEmoji: emoji bay VÒNG CUNG từ avatar mình → avatar đối thủ
   - EmojiThrowBurst: nổ nhỏ tại chỗ đối thủ khi emoji ném tới (màn người ném)
   - EmojiHitCluster: cụm bong bóng emoji to/nhỏ đè lên avatar đối thủ,
     to dần rồi nổ, emoji giữa lắc nhẹ (màn người bị ném)
   Mọi hiệu ứng nằm trong lớp overflow:hidden → không tràn màn hình, và
   pointer-events:none → không cản việc trả lời câu hỏi.
   ============================================================ */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

const cn = (...xs: Array<string | false | null | undefined>) =>
  xs.filter(Boolean).join(' ');

/* ============================================================
   EmojiStrip — dải chọn emoji (đặt ngay trên phần đáp án)
   ============================================================ */

export interface EmojiStripProps {
  /** Danh sách emoji được phép thả (từ config). */
  emojis: string[];
  /** Gọi khi người chơi chọn 1 emoji để thả. */
  onPick: (emoji: string) => void;
  /** Cooldown giữa 2 lần thả (ms). */
  cooldownMs: number;
  /** Tạm khóa (vd: ngoài phase chơi). */
  disabled?: boolean;
}

export function EmojiStrip({ emojis, onPick, cooldownMs, disabled }: EmojiStripProps) {
  /** Thứ tự hiển thị — emoji vừa dùng được đưa lên đầu (MRU). */
  const [order, setOrder] = useState<string[]>(emojis);
  /** Thời điểm hết cooldown (ms). 0 = sẵn sàng. */
  const [readyAt, setReadyAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [overflow, setOverflow] = useState(false);

  const scrollerRef = useRef<HTMLDivElement>(null);

  const cooling = readyAt > now;
  const remainingSec = cooling ? Math.ceil((readyAt - now) / 1000) : 0;

  // Đồng bộ khi palette đổi (giữ MRU của các emoji còn tồn tại, thêm mới vào cuối)
  useEffect(() => {
    setOrder((prev) => {
      const kept = prev.filter((e) => emojis.includes(e));
      const added = emojis.filter((e) => !kept.includes(e));
      const next = [...kept, ...added];
      // Chỉ cập nhật khi thực sự khác để tránh render thừa
      return next.length === prev.length && next.every((e, i) => e === prev[i])
        ? prev
        : next;
    });
  }, [emojis]);

  // Chỉ chạy timer khi đang cooldown
  useEffect(() => {
    if (!cooling) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [cooling]);

  // Phát hiện tràn để bật/tắt nút prev/next
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const check = () => setOverflow(el.scrollWidth > el.clientWidth + 2);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [order.length]);

  const handlePick = (e: string) => {
    if (disabled || cooling) return;
    onPick(e);
    // MRU: đưa emoji vừa dùng lên đầu
    setOrder((prev) => [e, ...prev.filter((x) => x !== e)]);
    // Cuộn về đầu để thấy emoji vừa dùng
    scrollerRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
    if (cooldownMs > 0) {
      setReadyAt(Date.now() + cooldownMs);
      setNow(Date.now());
    }
  };

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: 'smooth' });
  };

  if (!order.length) return null;

  return (
    <div className={cn('st-emoji-strip-wrap', cooling && 'is-cooling', disabled && 'is-disabled')}>
      {overflow && (
        <button
          type="button"
          className="st-emoji-nav prev"
          onClick={() => scrollBy(-1)}
          aria-label="Emoji trước"
          tabIndex={-1}
        >
          ‹
        </button>
      )}

      <div className="st-emoji-strip" ref={scrollerRef}>
        {order.map((e, i) => (
          <button
            key={`${e}-${i}`}
            type="button"
            className="st-emoji-chip"
            disabled={disabled || cooling}
            onClick={() => handlePick(e)}
            aria-label={`Thả emoji ${e}`}
          >
            {e}
          </button>
        ))}
      </div>

      {overflow && (
        <button
          type="button"
          className="st-emoji-nav next"
          onClick={() => scrollBy(1)}
          aria-label="Emoji sau"
          tabIndex={-1}
        >
          ›
        </button>
      )}

      {cooling && <span className="st-emoji-cool-pill">⏳ {remainingSec}s</span>}
    </div>
  );
}

/* ============================================================
   FlyingEmoji — emoji bay theo quỹ đạo VẬT LÝ từ avatar mình → avatar đối thủ
   3 lớp lồng nhau:
   - .st-fly    : trượt ngang (translateX) tốc độ đều (linear)
   - .st-fly-y  : rơi theo parabol trọng lực (translateY = drift + arc)
   - .st-fly-r  : xoay + squash/stretch như vật thể bị ném
   ============================================================ */

export interface Pt {
  x: number;
  y: number;
}

export interface FlyingEmojiProps {
  emoji: string;
  /** Toạ độ tâm avatar mình (viewport px). */
  from: Pt;
  /** Toạ độ tâm avatar đối thủ (viewport px). */
  to: Pt;
  /** Số độ xoay tổng (âm/dương tùy id để đa dạng). */
  spin: number;
  /** Gọi khi animation kết thúc (parent gỡ khỏi DOM + kích nổ tại đích). */
  onDone: () => void;
}

export function FlyingEmoji({ emoji, from, to, spin, onDone }: FlyingEmojiProps) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // Cung VỒNG LÊN, thấp. Chặn để đỉnh cung không cắt mép trên: đỉnh ≈ baseY - apex,
  // chừa thêm ~22px cho nửa chiều cao emoji.
  const baseY = Math.min(from.y, to.y);
  const apexCap = Math.max(6, baseY - 22);
  const apex = Math.min(Math.max(Math.abs(dx) * 0.16, 14), 78, apexCap);

  return (
    <span
      className="st-fly"
      aria-hidden
      style={
        {
          left: from.x,
          top: from.y,
          '--dx': `${dx}px`,
          '--dy': `${dy}px`,
          '--apex': `${apex}px`,
          '--spin': `${spin}deg`,
        } as React.CSSProperties
      }
      onAnimationEnd={(e) => {
        // animationend nổi bọt từ 3 lớp — chỉ chốt theo animation trượt ngang
        if (e.animationName === 'st-throw-x') onDone();
      }}
    >
      <span className="st-fly-y">
        <span className="st-fly-r">{emoji}</span>
      </span>
    </span>
  );
}

/* ============================================================
   EmojiThrowBurst — nổ tại chỗ đối thủ khi emoji ném tới (màn người ném)
   ============================================================ */

export interface EmojiThrowBurstProps {
  emoji: string;
  /** Toạ độ tâm avatar đối thủ (viewport px). */
  at: Pt;
  onDone: () => void;
}

export function EmojiThrowBurst({ emoji, at, onDone }: EmojiThrowBurstProps) {
  return (
    <div className="st-tb" style={{ left: at.x, top: at.y }} aria-hidden>
      <span className="st-tb-ring" />
      <span className="st-tb-emoji" onAnimationEnd={onDone}>
        {emoji}
      </span>
    </div>
  );
}

/* ============================================================
   EmojiHitCluster — cụm bong bóng đè lên avatar đối thủ (màn người bị ném)
   Rải rác NGẪU NHIÊN quanh avatar, dày, kiểu bong bóng nổi lên rồi nổ,
   được CLAMP để luôn nằm trọn trong màn hình.
   ============================================================ */

interface Bubble {
  dx: number;
  dy: number;
  size: number;
  delay: number;
  rise: number;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), Math.min(hi, Math.max(lo, hi)));

/** Sinh cụm bong bóng ngẫu nhiên quanh `at`, mọi bong bóng nằm trong viewport. */
function makeBubbles(at: Pt): Bubble[] {
  const W = typeof window !== 'undefined' ? window.innerWidth : 400;
  const H = typeof window !== 'undefined' ? window.innerHeight : 800;
  const PAD = 14;
  const N = 16;
  const out: Bubble[] = [];
  for (let i = 0; i < N; i++) {
    const ang = Math.random() * Math.PI * 2;
    const rad = 12 + Math.random() * 128; // toả ra quanh tâm
    const size = 20 + Math.random() * 30;
    const half = size / 2;
    // Clamp tâm bong bóng để cả emoji nằm trong màn hình
    const cx = clamp(at.x + Math.cos(ang) * rad, PAD + half, W - PAD - half);
    const cy = clamp(at.y + Math.sin(ang) * rad, PAD + half, H - PAD - half);
    out.push({
      dx: cx - at.x,
      dy: cy - at.y,
      size,
      delay: Math.random() * 360,
      rise: 12 + Math.random() * 30, // trôi lên như bong bóng
    });
  }
  return out;
}

export interface EmojiHitClusterProps {
  emoji: string;
  /** Toạ độ tâm avatar đối thủ (viewport px). */
  at: Pt;
  onDone: () => void;
}

export function EmojiHitCluster({ emoji, at, onDone }: EmojiHitClusterProps) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  // Tâm cụm: giữ ở avatar đối thủ nhưng kéo vào trong đủ để emoji giữa không lọt mép
  const W = typeof window !== 'undefined' ? window.innerWidth : 400;
  const H = typeof window !== 'undefined' ? window.innerHeight : 800;
  const [base] = useState<Pt>(() => ({
    x: clamp(at.x, 34, W - 34),
    y: clamp(at.y, 34, H - 34),
  }));
  const [bubbles] = useState<Bubble[]>(() => makeBubbles(base));

  useEffect(() => {
    const t = setTimeout(() => doneRef.current(), 1900);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="st-hitc" style={{ left: base.x, top: base.y }} aria-hidden>
      {bubbles.map((b, i) => (
        <span
          key={i}
          className="st-hitc-bubble"
          style={
            {
              fontSize: b.size,
              '--dx': `${b.dx}px`,
              '--dy': `${b.dy}px`,
              '--rise': `${b.rise}px`,
              animationDelay: `${b.delay}ms`,
            } as React.CSSProperties
          }
        >
          {emoji}
        </span>
      ))}
      {/* Emoji giữa (to nhất) — lắc nhẹ để gây chú ý */}
      <span className="st-hitc-center">{emoji}</span>
    </div>
  );
}
