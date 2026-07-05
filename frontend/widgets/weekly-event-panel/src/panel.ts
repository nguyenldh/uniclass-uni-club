import robotUrl from './robot.png';
import { CSS } from './styles';
import { formatMMSS, urgencyOf, startCountdown } from './countdown';
import type { PanelOptions, JoinContext } from './types';
import {
  isCollapsed,
  setCollapsed,
  getPillTop,
  setPillTop,
  setDismissed,
} from './storage';

export interface PanelContext {
  deadlineMs: number;
  skewMs: number;
  hasJoined: boolean;
  eventId?: string;
  roomId?: string;
  /** Khung neo (đã resolve). Nếu có => panel bám absolute theo khung này. */
  containerEl?: HTMLElement | null;
  onDismiss: () => void;
}

const PILL_MARGIN = 12;
const DEFAULT_DESIGN_W = 640;
const DEFAULT_MIN_SCALE = 0.5;
const EDGE_MARGIN = 16; // chừa mép để panel không chạm sát viền khi scale=1

export class Panel {
  private opts: PanelOptions;
  private ctx: PanelContext;

  private root: HTMLDivElement;
  private clockEl!: HTMLDivElement;
  private pillTimeEl!: HTMLSpanElement;
  private pillEl!: HTMLDivElement;
  private stopCountdown: (() => void) | null = null;
  private detach: Array<() => void> = [];
  private ro: ResizeObserver | null = null;

  constructor(host: HTMLElement, opts: PanelOptions, ctx: PanelContext) {
    this.opts = opts;
    this.ctx = ctx;

    // Neo trong khung game: đảm bảo container là positioned + đưa host vào trong.
    const container = ctx.containerEl;
    if (container) {
      const pos = getComputedStyle(container).position;
      if (pos === 'static') container.style.position = 'relative';
      if (host.parentElement !== container) container.appendChild(host);
    }

    const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = CSS;
    shadow.appendChild(style);

    this.root = document.createElement('div');
    this.root.className = container ? 'we-root is-contained' : 'we-root';
    shadow.appendChild(this.root);

    this.render();
    this.setCollapsedView(isCollapsed());
    this.setupScaling();
    this.startTimer();
  }

  /** Chiều cao tham chiếu để clamp pill: khung game (contained) hoặc viewport. */
  private refHeight(): number {
    return this.ctx.containerEl?.clientHeight || window.innerHeight;
  }

  /** Bề rộng tham chiếu: khung game (contained) hoặc viewport. */
  private refWidth(): number {
    return this.ctx.containerEl?.clientWidth || window.innerWidth;
  }

  // ---------- scale theo bề rộng vùng chứa ----------
  private setupScaling(): void {
    const designW = this.opts.designWidth ?? DEFAULT_DESIGN_W;
    this.root.style.setProperty('--we-design-w', `${designW}px`);
    this.updateScale();

    // Theo dõi thay đổi kích thước của khung tham chiếu.
    const target = this.ctx.containerEl ?? document.documentElement;
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.updateScale());
      this.ro.observe(target);
    }
  }

  private updateScale(): void {
    const designW = this.opts.designWidth ?? DEFAULT_DESIGN_W;
    const minScale = this.opts.minScale ?? DEFAULT_MIN_SCALE;
    const avail = this.refWidth() - EDGE_MARGIN * 2;
    const scale = Math.max(minScale, Math.min(1, avail / designW));
    this.root.style.setProperty('--we-scale', String(scale));
  }

  // ---------- render ----------
  private render(): void {
    const joinLabel = this.ctx.hasJoined ? 'Quay lại phòng chờ' : 'Tham gia ngay';

    this.root.innerHTML = `
      <div class="we-full" hidden>
        <div class="we-card">
          <div class="we-content">
            <h3 class="we-title">Sự kiện bắt đầu rồi!!!</h3>
            <p class="we-sub">Thời gian cuối cùng để tham gia</p>
            <div class="we-clock is-green" data-role="clock">--:--</div>
            <div class="we-actions">
              <button class="we-btn we-btn-primary" data-role="join">${joinLabel}</button>
              <button class="we-btn we-btn-ghost" data-role="collapse">Thu gọn</button>
              <button class="we-btn we-btn-text" data-role="dismiss">Tắt</button>
            </div>
          </div>
          <img class="we-robot" src="${robotUrl}" alt="" />
        </div>
      </div>

      <div class="we-pill-wrap" hidden>
        <div class="we-pill" data-role="pill">
          <span class="we-pill-trophy" aria-hidden="true">🏆</span>
          <span class="we-pill-time is-green" data-role="pill-time">--:--</span>
        </div>
      </div>
    `;

    this.clockEl = this.root.querySelector('[data-role="clock"]')!;
    this.pillTimeEl = this.root.querySelector('[data-role="pill-time"]')!;
    this.pillEl = this.root.querySelector('[data-role="pill"]')!;

    this.on(this.root.querySelector('[data-role="join"]')!, 'click', () => this.handleJoin());
    this.on(this.root.querySelector('[data-role="collapse"]')!, 'click', () => this.setCollapsedView(true));
    this.on(this.root.querySelector('[data-role="dismiss"]')!, 'click', () => this.handleDismiss());

    this.setupPillInteractions();
  }

  private on(el: EventTarget, ev: string, fn: EventListenerOrEventListenerObject): void {
    el.addEventListener(ev, fn);
    this.detach.push(() => el.removeEventListener(ev, fn));
  }

  // ---------- actions ----------
  /** URL /weekly-event mặc định, kèm ?token= để trang đích nhận diện. */
  private buildWeeklyEventUrl(): string {
    const base =
      this.opts.weeklyEventUrl || `${window.location.origin}/weekly-event`;
    if (this.opts.token) {
      return base + (base.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(this.opts.token);
    }
    return base;
  }

  private handleJoin(): void {
    const url = this.buildWeeklyEventUrl();
    const remainingSec = Math.max(
      0,
      Math.round((this.ctx.deadlineMs - (Date.now() + this.ctx.skewMs)) / 1000)
    );
    const joinCtx: JoinContext = {
      hasJoined: this.ctx.hasJoined,
      eventId: this.ctx.eventId,
      roomId: this.ctx.roomId,
      token: this.opts.token,
      weeklyEventUrl: url,
      deadlineMs: this.ctx.deadlineMs,
      remainingSec,
    };

    if (this.opts.onJoin) {
      this.opts.onJoin(joinCtx);
      return;
    }
    window.location.href = url;
  }

  private handleDismiss(): void {
    setDismissed(this.ctx.eventId);
    this.ctx.onDismiss();
  }

  // ---------- collapse / pill ----------
  private setCollapsedView(collapsed: boolean): void {
    setCollapsed(collapsed);
    const full = this.root.querySelector('.we-full') as HTMLElement;
    const pillWrap = this.root.querySelector('.we-pill-wrap') as HTMLElement;

    if (collapsed) {
      this.root.classList.remove('is-full');
      this.root.classList.add('is-pill');
      full.hidden = true;
      pillWrap.hidden = false;
      this.applyPillTop(getPillTop());
    } else {
      this.root.classList.remove('is-pill');
      this.root.classList.add('is-full');
      full.hidden = false;
      pillWrap.hidden = true;
      this.root.style.top = '';
    }
  }

  private applyPillTop(px: number | null): void {
    const h = this.pillEl.offsetHeight || 48;
    const ref = this.refHeight();
    const max = Math.max(PILL_MARGIN, ref - h - PILL_MARGIN);
    const top = px == null ? Math.round(ref * 0.4) : px;
    this.root.style.top = `${Math.min(max, Math.max(PILL_MARGIN, top))}px`;
  }

  private setupPillInteractions(): void {
    let dragging = false;
    let moved = false;
    let startY = 0;
    let startTop = 0;

    const onDown = (e: PointerEvent) => {
      dragging = true;
      moved = false;
      startY = e.clientY;
      startTop = parseFloat(this.root.style.top || '0') || 0;
      this.pillEl.classList.add('is-dragging');
      this.pillEl.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dy = e.clientY - startY;
      if (Math.abs(dy) > 4) moved = true;
      const h = this.pillEl.offsetHeight || 48;
      const max = Math.max(PILL_MARGIN, this.refHeight() - h - PILL_MARGIN);
      const top = Math.min(max, Math.max(PILL_MARGIN, startTop + dy));
      this.root.style.top = `${top}px`;
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      this.pillEl.classList.remove('is-dragging');
      const top = parseFloat(this.root.style.top || '0') || 0;
      setPillTop(top);
      // Tap (không kéo) => mở lại full.
      if (!moved) this.setCollapsedView(false);
    };

    this.on(this.pillEl, 'pointerdown', onDown as EventListener);
    this.on(window, 'pointermove', onMove as EventListener);
    this.on(window, 'pointerup', onUp as EventListener);
    this.on(window, 'resize', () => {
      this.updateScale();
      if (this.root.classList.contains('is-pill')) this.applyPillTop(getPillTop());
    });
  }

  // ---------- countdown ----------
  private startTimer(): void {
    this.stopCountdown = startCountdown(
      this.ctx.deadlineMs,
      this.ctx.skewMs,
      (sec) => this.paint(sec),
      () => this.ctx.onDismiss() // hết giờ => tự ẩn/destroy qua controller
    );
  }

  private paint(sec: number): void {
    const text = formatMMSS(sec);
    const urg = urgencyOf(sec);
    const cls = `is-${urg}`;

    this.clockEl.textContent = text;
    this.clockEl.className = `we-clock ${cls}`;

    this.pillTimeEl.textContent = text;
    this.pillTimeEl.className = `we-pill-time ${cls}`;
  }

  // ---------- teardown ----------
  destroy(): void {
    this.stopCountdown?.();
    this.stopCountdown = null;
    this.ro?.disconnect();
    this.ro = null;
    this.detach.forEach((fn) => fn());
    this.detach = [];
    this.root.remove();
  }
}
