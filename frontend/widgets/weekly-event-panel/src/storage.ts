/**
 * Lưu trạng thái nhỏ của widget.
 * - Tắt: theo PHIÊN (sessionStorage) — mở lại tab/WebView sẽ hiện lại.
 * - Vị trí pill khi thu gọn + trạng thái thu gọn: bền hơn (localStorage).
 */

const DISMISS_KEY = 'we_panel_dismissed';       // sessionStorage
const COLLAPSED_KEY = 'we_panel_collapsed';     // localStorage
const PILL_TOP_KEY = 'we_panel_pill_top';       // localStorage (px hoặc %)

function safeGet(store: Storage | undefined, key: string): string | null {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
}
function safeSet(store: Storage | undefined, key: string, val: string): void {
  try {
    store?.setItem(key, val);
  } catch {
    /* WebView có thể chặn storage — bỏ qua */
  }
}

const session = typeof sessionStorage !== 'undefined' ? sessionStorage : undefined;
const local = typeof localStorage !== 'undefined' ? localStorage : undefined;

/** Tắt theo phiên, gắn theo eventId để phiên sau (hoặc event khác) vẫn hiện. */
export function isDismissed(eventId: string | undefined): boolean {
  if (!eventId) return false;
  return safeGet(session, DISMISS_KEY) === eventId;
}
export function setDismissed(eventId: string | undefined): void {
  if (!eventId) return;
  safeSet(session, DISMISS_KEY, eventId);
}

export function isCollapsed(): boolean {
  return safeGet(local, COLLAPSED_KEY) === '1';
}
export function setCollapsed(v: boolean): void {
  safeSet(local, COLLAPSED_KEY, v ? '1' : '0');
}

/** Vị trí dọc của pill (px tính từ đỉnh viewport). */
export function getPillTop(): number | null {
  const raw = safeGet(local, PILL_TOP_KEY);
  if (raw == null) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}
export function setPillTop(px: number): void {
  safeSet(local, PILL_TOP_KEY, String(Math.round(px)));
}
