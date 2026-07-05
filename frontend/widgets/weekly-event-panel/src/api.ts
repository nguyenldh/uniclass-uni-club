import type { CurrentEventResponse } from './types';

export interface CurrentResult {
  data: CurrentEventResponse;
  /** Skew = serverNow - clientNow (ms), tính từ HTTP `Date` header nếu có. */
  skewMs: number;
}

/**
 * Gọi GET /current. Tính skew từ header `Date` để đồng hồ đếm ngược bám giờ
 * server (REST-only, không cần socket time:sync).
 */
export async function fetchCurrent(
  apiBase: string,
  token?: string
): Promise<CurrentResult> {
  const sentAt = Date.now();
  // Token tùy chọn: không có vẫn gọi được (chỉ mất hasJoined/roomId).
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${apiBase}/game/weekly-event/current`, {
    method: 'GET',
    headers,
  });

  const data = (await res.json()) as CurrentEventResponse;
  if (!res.ok) {
    throw new Error((data as any)?.error || `HTTP ${res.status}`);
  }

  // Ước lượng server time tại thời điểm giữa RTT.
  const rtt = Date.now() - sentAt;
  const dateHeader = res.headers.get('date');
  let skewMs = 0;
  if (dateHeader) {
    const serverMs = new Date(dateHeader).getTime();
    if (Number.isFinite(serverMs)) {
      skewMs = serverMs - (sentAt + rtt / 2);
    }
  }

  return { data, skewMs };
}

/** Deadline tham gia = scheduledStartAt + waitingDuration phút. */
export function computeDeadlineMs(event: {
  scheduledStartAt: string;
  waitingDuration: number;
}): number {
  const start = new Date(event.scheduledStartAt).getTime();
  const waitingMs = (event.waitingDuration ?? 5) * 60 * 1000;
  return start + waitingMs;
}
