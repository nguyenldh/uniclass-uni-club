/**
 * CSS cho widget — inject vào shadowRoot nên hoàn toàn cô lập khỏi trang host.
 * Palette theo brand UniClass do khách cung cấp.
 */
export const CSS = `
:host, * { box-sizing: border-box; }

.we-root {
  --we-cam-50: #FFF7ED;
  --we-brand: #F7711D;
  --we-ink: #1f2937;
  --we-ink-soft: #6b7280;
  --we-green: #16a34a;
  --we-orange: #ea580c;
  --we-red: #dc2626;

  position: fixed;
  z-index: 2147483000;
  font-family: -apple-system, "SF Pro Display", "Segoe UI", Roboto, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  color: var(--we-ink);
  /* Chỉ card/pill bắt sự kiện — vùng trống (do scale) không chặn thao tác game. */
  pointer-events: none;

  /* Reset các thuộc tính KẾ THỪA — Shadow DOM cô lập selector nhưng không chặn
     inheritance, nên text-align/line-height... của trang host vẫn lọt vào panel.
     Đặt lại tại gốc để panel miễn nhiễm với CSS trang ngoài. */
  text-align: left;
  line-height: 1.4;
  letter-spacing: normal;
  word-spacing: normal;
  text-transform: none;
  font-style: normal;
  font-weight: 400;
  white-space: normal;
  text-indent: 0;
  direction: ltr;
}
.we-card, .we-pill { pointer-events: auto; }

/* Neo trong khung game (position:absolute theo container đã set relative). */
.we-root.is-contained { position: absolute; }

/* ===== FULL PANEL ===== */
.we-root.is-full {
  top: 16px;
  left: 50%;
  transform: translateX(-50%);   /* căn giữa theo design width */
}

/* Thu nhỏ đồng đều khi vùng chứa hẹp hơn design width (JS set --we-scale). */
.we-full {
  transform: scale(var(--we-scale, 1));
  transform-origin: top center;
}

.we-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0;
  width: var(--we-design-w, 640px);   /* min-width chuẩn của thiết kế */
  padding: 18px 20px;
  background: var(--we-cam-50);
  border-style: solid;
  border-color: var(--we-brand);
  border-width: 1px 6px 6px 1px;
  border-radius: 22px;
  box-shadow:
    0px 0px 3px 0px #C2C2C226,
    0px 0px 6px 0px #C2C2C221,
    0px 0px 8px 0px #C2C2C214,
    0px 0px 9px 0px #C2C2C205,
    0px 0px 10px 0px #C2C2C200,
    0px 0px 7px 0px #00000017;
  overflow: hidden;
}

.we-content { flex: 1 1 auto; min-width: 0; padding-right: 14px; }

.we-title {
  margin: 0 0 4px;
  font-size: 20px;
  font-weight: 800;
  letter-spacing: .2px;
  color: var(--we-brand);
  text-transform: uppercase;
}
.we-sub { margin: 0 0 6px; font-size: 14px; color: var(--we-ink-soft); }

.we-clock {
  font-size: 40px;
  font-weight: 800;
  line-height: 1.05;
  font-variant-numeric: tabular-nums;
  margin-bottom: 12px;
}
.we-clock.is-green  { color: var(--we-green); }
.we-clock.is-orange { color: var(--we-orange); }
.we-clock.is-red    { color: var(--we-red); }

.we-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

.we-btn {
  font-family: inherit;
  cursor: pointer;
  border-radius: 999px;
  padding: 9px 18px;
  font-size: 16px;
  font-weight: 600;
  line-height: 100%;
  text-align: center;
  vertical-align: middle;
  border: 1.5px solid transparent;
  transition: filter .15s ease, background .15s ease;
  -webkit-tap-highlight-color: transparent;
}
.we-btn-primary { background: var(--we-brand); color: #fff; }
.we-btn-primary:active { filter: brightness(.92); }
.we-btn-ghost {
  background: #fff;
  color: var(--we-brand);
  border-color: var(--we-brand);
}
.we-btn-ghost:active { background: #fff3ea; }
.we-btn-text {
  background: transparent;
  color: var(--we-ink-soft);
  padding: 9px 12px;
  border: none;
  font-weight: 600;
}
.we-btn-text:active { color: var(--we-ink); }

.we-robot {
  flex: 0 0 auto;
  align-self: stretch;          /* cao bằng card */
  width: 200px;
  height: auto;
  object-fit: cover;            /* lấp đầy, tràn sát viền phải */
  object-position: center right;
  /* Khử padding card ở phải/trên/dưới => ảnh tràn sát 3 cạnh (clip bởi border-radius). */
  margin: -18px -20px -18px 0;
  pointer-events: none;
  user-select: none;
}

/* Không dùng media-query reflow cho card: thu nhỏ đồng đều qua --we-scale
   (JS) để giữ đúng tỉ lệ thiết kế ở mọi bề rộng vùng chứa. */

/* ===== COLLAPSED PILL (cạnh trái, kéo dọc) ===== */
.we-root.is-pill {
  left: 0;
  transform: none;
}
.we-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px 10px 12px;
  background: var(--we-cam-50);
  border: solid var(--we-brand);
  border-width: 1px 6px 6px 1px;
  border-left: none;
  border-radius: 0 999px 999px 0;
  box-shadow: 0px 0px 7px 0px #00000017;
  cursor: pointer;
  touch-action: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.we-pill-trophy { font-size: 20px; line-height: 1; }
.we-pill-time {
  font-size: 20px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.we-pill-time.is-green  { color: var(--we-green); }
.we-pill-time.is-orange { color: var(--we-orange); }
.we-pill-time.is-red    { color: var(--we-red); }
.we-pill.is-dragging { opacity: .9; }

[hidden] { display: none !important; }
`;
