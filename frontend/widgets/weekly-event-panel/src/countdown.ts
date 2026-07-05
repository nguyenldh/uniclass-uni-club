/** Định dạng & màu cho đồng hồ đếm ngược. */

export type UrgencyColor = 'green' | 'orange' | 'red';

/** Ngưỡng đổi màu (giây): >60 xanh, ≤60 cam, ≤20 đỏ. */
export function urgencyOf(remainingSec: number): UrgencyColor {
  if (remainingSec <= 20) return 'red';
  if (remainingSec <= 60) return 'orange';
  return 'green';
}

/** "4:14", "1:42", "0:22" — phút không pad, giây pad 2 chữ số. */
export function formatMMSS(remainingSec: number): string {
  const s = Math.max(0, Math.floor(remainingSec));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export const COLOR_HEX: Record<UrgencyColor, string> = {
  green: '#16a34a',
  orange: '#ea580c',
  red: '#dc2626',
};

/**
 * Bộ đếm dựa trên thời gian tuyệt đối (deadline) + skew, gọi tick mỗi giây.
 * Trả về hàm stop().
 */
export function startCountdown(
  deadlineMs: number,
  skewMs: number,
  onTick: (remainingSec: number) => void,
  onDone: () => void
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const loop = () => {
    if (stopped) return;
    const serverNow = Date.now() + skewMs;
    const remainingSec = Math.max(0, Math.round((deadlineMs - serverNow) / 1000));
    onTick(remainingSec);
    if (remainingSec <= 0) {
      onDone();
      return;
    }
    // Căn nhịp về đầu giây kế tiếp để số nhảy mượt.
    const msToNextSec = 1000 - ((deadlineMs - serverNow) % 1000 || 1000);
    timer = setTimeout(loop, Math.max(200, msToNextSec));
  };

  loop();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
