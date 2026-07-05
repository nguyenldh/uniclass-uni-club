import { Panel } from './panel';
import { fetchCurrent, computeDeadlineMs } from './api';
import { isDismissed } from './storage';
import type { CurrentEventResponse, PanelInstance, PanelOptions } from './types';

const INIT_FLAG = '__weInited';
const MAX_SCHEDULE_MS = 24 * 60 * 60 * 1000; // không đặt timer quá 24h

function resolveTarget(target: string | HTMLElement): HTMLElement {
  if (typeof target !== 'string') return target;
  const el = document.querySelector(target);
  if (el) return el as HTMLElement;
  // Không có sẵn div => tự tạo và append body.
  const created = document.createElement('div');
  created.id = target.replace(/^[#.]/, '') || 'we-panel';
  document.body.appendChild(created);
  return created;
}

class Controller implements PanelInstance {
  private host: HTMLElement;
  private opts: PanelOptions;
  private panel: Panel | null = null;
  private scheduleTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;

  constructor(host: HTMLElement, opts: PanelOptions) {
    this.host = host;
    this.opts = {
      apiBase: `${window.location.origin}/api`,
      pollInterval: 0,
      ...opts,
    };
  }

  async start(): Promise<void> {
    await this.evaluate();
    const interval = this.opts.pollInterval ?? 0;
    if (interval > 0) {
      this.pollTimer = setInterval(() => this.evaluate(), interval);
    }
  }

  /** Lấy dữ liệu (hoặc mock) rồi quyết định hiển thị. */
  private async evaluate(): Promise<void> {
    if (this.destroyed) return;

    let data: CurrentEventResponse;
    let skewMs = this.opts.serverNowMs != null ? this.opts.serverNowMs - Date.now() : 0;

    if (this.opts.mockCurrent) {
      data = this.opts.mockCurrent;
    } else {
      // Token tùy chọn: /current gọi được không cần token (mất hasJoined).
      try {
        const res = await fetchCurrent(this.opts.apiBase!, this.opts.token);
        data = res.data;
        if (this.opts.serverNowMs == null) skewMs = res.skewMs;
      } catch (err) {
        console.warn('[WeeklyEventPanel] lỗi gọi /current:', err);
        return;
      }
    }

    this.apply(data, skewMs);
  }

  private apply(data: CurrentEventResponse, skewMs: number): void {
    const { status, event } = data;
    const serverNow = Date.now() + skewMs;

    // Chỉ hiện khi phòng chờ đang mở.
    if (status === 'open' && event) {
      const deadlineMs = computeDeadlineMs(event);
      if (deadlineMs <= serverNow) {
        this.teardownPanel();
        return;
      }
      if (isDismissed(event._id)) {
        this.teardownPanel();
        return;
      }
      this.mountPanel(data, deadlineMs, skewMs);
      return;
    }

    // Chưa mở: đã biết mốc mở (scheduledStartAt) và mốc hết phòng chờ.
    if (status === 'before-open' && event) {
      const openAt = new Date(event.scheduledStartAt).getTime();
      const deadlineMs = computeDeadlineMs(event);

      // (a) Chưa tới giờ mở => ẩn + hẹn đúng lúc mở mới hiện (không đếm ngược lộ ra).
      if (serverNow < openAt) {
        this.teardownPanel();
        const wait = openAt - serverNow;
        if (wait <= MAX_SCHEDULE_MS) {
          this.clearSchedule();
          this.scheduleTimer = setTimeout(() => this.evaluate(), wait + 500);
        }
        return;
      }

      // (b) Đã tới/qua giờ mở nhưng backend chưa kịp chuyển sang Waiting:
      //     vẫn hiện panel dựa trên cửa sổ phòng chờ tính từ event (chống trễ).
      if (deadlineMs > serverNow && !isDismissed(event._id)) {
        this.mountPanel(data, deadlineMs, skewMs);
      } else {
        this.teardownPanel();
      }
      return;
    }

    // in-progress / closed => ẩn.
    this.teardownPanel();
  }

  private mountPanel(
    data: CurrentEventResponse,
    deadlineMs: number,
    skewMs: number
  ): void {
    if (this.panel) return; // đã hiện rồi
    this.panel = new Panel(this.host, this.opts, {
      deadlineMs,
      skewMs,
      hasJoined: !!data.hasJoined,
      eventId: data.event?._id,
      roomId: data.roomId,
      containerEl: this.resolveContainer(),
      onDismiss: () => this.teardownPanel(),
    });
  }

  private resolveContainer(): HTMLElement | null {
    const c = this.opts.container;
    if (!c) return null;
    if (typeof c !== 'string') return c;
    return document.querySelector(c) as HTMLElement | null;
  }

  private teardownPanel(): void {
    this.panel?.destroy();
    this.panel = null;
  }

  private clearSchedule(): void {
    if (this.scheduleTimer) clearTimeout(this.scheduleTimer);
    this.scheduleTimer = null;
  }

  destroy(): void {
    this.destroyed = true;
    this.clearSchedule();
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
    this.teardownPanel();
    // Xoá cờ guard để init() sau tạo controller mới (không trả bản đã destroy).
    const anyHost = this.host as HTMLElement & { [INIT_FLAG]?: unknown };
    if (anyHost[INIT_FLAG] === this) delete anyHost[INIT_FLAG];
  }
}

function init(target: string | HTMLElement, opts: PanelOptions = {}): PanelInstance {
  const host = resolveTarget(target);
  const anyHost = host as HTMLElement & { [INIT_FLAG]?: Controller };
  if (anyHost[INIT_FLAG]) return anyHost[INIT_FLAG]!; // guard double-init

  const controller = new Controller(host, opts);
  anyHost[INIT_FLAG] = controller;
  void controller.start();
  return controller;
}

// ---------- auto-init từ data-attribute trên chính <script> ----------
function autoInit(): void {
  const script = document.currentScript as HTMLScriptElement | null;
  if (!script || !script.hasAttribute('data-auto')) return;

  const ds = script.dataset;
  const opts: PanelOptions = {
    token: ds.token,
    apiBase: ds.apiBase,
    weeklyEventUrl: ds.weeklyEventUrl,
    container: ds.container,
    pollInterval: ds.pollInterval ? parseInt(ds.pollInterval, 10) : 0,
  };
  const targetSel = ds.target || '#we-panel';

  const run = () => init(targetSel, opts);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
}

// Vite IIFE gán module exports vào global `WeeklyEventPanel`
// => window.WeeklyEventPanel.init(...). Chạy auto-init ngay khi script load.
autoInit();

export { init };
