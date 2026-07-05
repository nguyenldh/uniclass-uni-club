// ============================================================
// WeeklyEventPanel — wrapper React cho widget đếm ngược Sự kiện tuần.
//
// Widget lõi là bundle IIFE độc lập (public/widgets/weekly-event-panel.js)
// expose window.WeeklyEventPanel.init(). Component này chỉ:
//   1) nạp script 1 lần (singleton),
//   2) tạo 1 host div thuần (KHÔNG do React quản lý — vì widget có thể
//      di chuyển div vào `container`, để React quản lý sẽ lỗi khi unmount),
//   3) init() vào host, destroy() khi unmount,
//   4) mặc định token lấy từ sessionStorage, điều hướng "Tham gia ngay"
//      bằng react-router (không reload, token vẫn còn trong session).
//
// Dùng trong các game: So Tài / Đấu trí / Săn boss.
// ============================================================

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStoredToken } from '../services/auth';

const DEFAULT_SCRIPT_SRC = '/widgets/weekly-event-panel.js';

/** Context widget truyền vào onJoin (khớp JoinContext của widget lõi). */
export interface WeeklyEventJoinContext {
  /** true = "Quay lại phòng chờ" (đã tham gia); false = "Tham gia ngay". */
  hasJoined: boolean;
  eventId?: string;
  roomId?: string;
  token?: string;
  /** URL /weekly-event mặc định (đã kèm ?token=). */
  weeklyEventUrl: string;
  deadlineMs: number;
  remainingSec: number;
}

interface WEPanelOptions {
  token?: string;
  apiBase?: string;
  weeklyEventUrl?: string;
  container?: string | HTMLElement;
  pollInterval?: number;
  designWidth?: number;
  minScale?: number;
  onJoin?: (ctx: WeeklyEventJoinContext) => void;
}
interface WEPanelInstance {
  destroy(): void;
}
declare global {
  interface Window {
    WeeklyEventPanel?: {
      init(target: string | HTMLElement, opts?: WEPanelOptions): WEPanelInstance;
    };
  }
}

// Nạp script chia sẻ cho mọi instance (chỉ tải 1 lần).
let scriptPromise: Promise<void> | null = null;
function loadWidgetScript(src: string): Promise<void> {
  if (typeof window !== 'undefined' && window.WeeklyEventPanel) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-we-panel]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Không tải được widget')));
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.dataset.wePanel = '1';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Không tải được ${src}`));
    document.body.appendChild(s);
  });
  return scriptPromise;
}

export interface WeeklyEventPanelProps {
  /** JWT — mặc định lấy từ sessionStorage (uniclub_token). */
  token?: string;
  /** Base REST — mặc định VITE_API_BASE_URL (fallback '/api'). */
  apiBase?: string;
  /** Đích "Tham gia ngay" — mặc định điều hướng client-side tới /weekly-event. */
  weeklyEventUrl?: string;
  /** Khung neo panel (selector / element / ref). Bỏ trống => fixed viewport. */
  container?: string | HTMLElement | React.RefObject<HTMLElement | null>;
  /** ms; >0 để bật polling. Mặc định 0. */
  pollInterval?: number;
  /** Bề rộng thiết kế (min-width) px — mặc định 640. */
  designWidth?: number;
  /** Hệ số scale nhỏ nhất — mặc định 0.5. */
  minScale?: number;
  /** URL script widget — mặc định /widgets/weekly-event-panel.js. */
  scriptSrc?: string;
  /**
   * Callback CHUNG cho "Tham gia ngay" và "Quay lại phòng chờ".
   * Nhận context (hasJoined, eventId, roomId, token, weeklyEventUrl, deadline...)
   * để tùy biến cách vào game. Không truyền => điều hướng client-side /weekly-event.
   */
  onJoin?: (ctx: WeeklyEventJoinContext) => void;
}

export function WeeklyEventPanel({
  token,
  apiBase,
  weeklyEventUrl,
  container,
  pollInterval = 0,
  designWidth,
  minScale,
  scriptSrc = DEFAULT_SCRIPT_SRC,
  onJoin,
}: WeeklyEventPanelProps) {
  const navigate = useNavigate();

  // Giữ onJoin mới nhất mà không buộc effect re-init.
  const onJoinRef = useRef(onJoin);
  onJoinRef.current = onJoin;

  const resolvedToken = token ?? getStoredToken() ?? undefined;
  const resolvedApiBase = apiBase ?? (import.meta.env.VITE_API_BASE_URL || '/api');

  useEffect(() => {
    let instance: WEPanelInstance | null = null;
    let cancelled = false;

    // Host div thuần — widget toàn quyền di chuyển/gỡ (không đụng cây React).
    const host = document.createElement('div');
    host.setAttribute('data-we-panel-mount', '');
    document.body.appendChild(host);

    const resolveContainer = (): string | HTMLElement | undefined => {
      if (!container) return undefined;
      if (typeof container === 'string') return container;
      if (container instanceof HTMLElement) return container;
      return container.current ?? undefined; // RefObject
    };

    loadWidgetScript(scriptSrc)
      .then(() => {
        if (cancelled || !window.WeeklyEventPanel) return;
        instance = window.WeeklyEventPanel.init(host, {
          token: resolvedToken,
          apiBase: resolvedApiBase,
          weeklyEventUrl,
          container: resolveContainer(),
          pollInterval,
          designWidth,
          minScale,
          onJoin: (ctx) => {
            if (onJoinRef.current) {
              onJoinRef.current(ctx);
              return;
            }
            // Client-side nav: không reload, token đã có sẵn trong sessionStorage.
            navigate('/weekly-event');
          },
        });
      })
      .catch((err) => console.warn('[WeeklyEventPanel]', err));

    return () => {
      cancelled = true;
      instance?.destroy();
      host.remove();
    };
    // container/onJoin/navigate cố ý không nằm trong deps: container element/ref
    // thường ổn định; onJoin đọc qua closure mới nhất khi effect chạy lại.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedToken, resolvedApiBase, weeklyEventUrl, pollInterval, designWidth, minScale, scriptSrc]);

  return null;
}
