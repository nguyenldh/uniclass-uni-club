// ============================================================
// Browser fingerprint — chống gian lận phòng mời
// Dùng thư viện FingerprintJS (OSS, chạy hoàn toàn client-side, không gọi API
// ngoài) để tạo visitorId ổn định cho từng thiết bị/trình duyệt, nhằm phát hiện
// "tự tạo tài khoản mới tự chơi với mình trên CÙNG MỘT MÁY".
//
// Hai tài khoản mở trên cùng thiết bị + cùng WebView → visitorId TRÙNG.
// Thiết bị khác → visitorId khác. Đây là biện pháp răn đe (client-side),
// không tuyệt đối: đổi trình duyệt/thiết bị hoặc can thiệp có thể vượt qua.
// ============================================================

import FingerprintJS from '@fingerprintjs/fingerprintjs';

// ---- Fallback (khi FingerprintJS lỗi trong một số WebView đặc biệt) ----

/** Hash FNV-1a 32-bit → chuỗi hex (không phụ thuộc thư viện ngoài). */
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Vân tay canvas — khác nhau theo GPU/driver/OS khi render text & hình. */
function canvasSignature(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.textBaseline = 'top';
    ctx.font = '14px "Arial"';
    ctx.fillStyle = '#f60';
    ctx.fillRect(10, 5, 80, 30);
    ctx.fillStyle = '#069';
    ctx.fillText('UniClub·SoTai·10x', 12, 8);
    ctx.fillStyle = 'rgba(102,204,0,0.75)';
    ctx.fillText('fingerprint', 20, 24);
    ctx.beginPath();
    ctx.arc(180, 30, 18, 0, Math.PI * 2, true);
    ctx.fill();
    return canvas.toDataURL();
  } catch {
    return '';
  }
}

/** Vendor + renderer của GPU qua WebGL (rất phân biệt giữa các máy). */
function webglSignature(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      (canvas.getContext('webgl') as WebGLRenderingContext | null) ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
    if (!gl) return '';
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
    const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return `${vendor}~${renderer}`;
  } catch {
    return '';
  }
}

/** Fingerprint dự phòng khi FingerprintJS không khả dụng. */
function fallbackFingerprint(): string {
  try {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const parts = [
      'fallback',
      nav.userAgent,
      nav.language,
      nav.platform,
      String(nav.hardwareConcurrency ?? ''),
      String(nav.deviceMemory ?? ''),
      String(nav.maxTouchPoints ?? ''),
      `${screen.width}x${screen.height}x${screen.colorDepth}`,
      String(window.devicePixelRatio ?? ''),
      Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      canvasSignature(),
      webglSignature(),
    ];
    return fnv1a(parts.join('|'));
  } catch {
    return '';
  }
}

// ---- FingerprintJS (nguồn chính) ----

let cachedPromise: Promise<string> | null = null;

async function compute(): Promise<string> {
  try {
    const agent = await FingerprintJS.load();
    const result = await agent.get();
    // visitorId ổn định theo thiết bị/trình duyệt; prefix để dễ phân biệt nguồn
    return result.visitorId ? `fpjs:${result.visitorId}` : fallbackFingerprint();
  } catch {
    return fallbackFingerprint();
  }
}

/**
 * Trả về fingerprint ổn định của TRÌNH DUYỆT hiện tại (Promise, cache theo phiên).
 * Gọi nhiều lần → tái dùng cùng một kết quả (không tính lại).
 * Lưu ý: fingerprint này định danh TRÌNH DUYỆT — Chrome và Edge trên CÙNG MỘT MÁY
 * cho giá trị KHÁC nhau. Để bắt "cùng máy khác trình duyệt", dùng thêm getDeviceClass().
 */
export function getDeviceFingerprint(): Promise<string> {
  if (!cachedPromise) cachedPromise = compute();
  return cachedPromise;
}

/**
 * "Device class" — đặc trưng phần cứng ĐỘC LẬP TRÌNH DUYỆT (màn hình, DPR, timezone,
 * platform, CPU, RAM, cảm ứng). Chrome/Edge trên cùng một máy → GIỐNG nhau.
 * Kết hợp với IP ở server để phát hiện "cùng máy khác trình duyệt" mà không đụng tới
 * 2 người dùng máy KHÁC nhau chung mạng (device class khác nhau).
 * KHÔNG dùng userAgent/canvas/webgl (những thứ khác nhau giữa các trình duyệt).
 */
let cachedDeviceClass: string | null = null;
export function getDeviceClass(): string {
  if (cachedDeviceClass !== null) return cachedDeviceClass;
  try {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const parts = [
      `${screen.width}x${screen.height}`,
      String(screen.colorDepth ?? ''),
      String(window.devicePixelRatio ?? ''),
      Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      nav.platform || '',
      String(nav.hardwareConcurrency ?? ''),
      String(nav.deviceMemory ?? ''),
      String(nav.maxTouchPoints ?? ''),
    ];
    cachedDeviceClass = `dc:${fnv1a(parts.join('|'))}`;
  } catch {
    cachedDeviceClass = '';
  }
  return cachedDeviceClass;
}
