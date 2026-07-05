/**
 * Kiểu dữ liệu tối giản mà widget cần — chỉ subset của contract backend
 * (`CurrentEventResponse` trong @uniclub/shared). Khai báo local để bundle
 * không kéo theo runtime nào của shared package.
 */

export type CurrentStatus = 'before-open' | 'open' | 'in-progress' | 'closed';

export interface CurrentEvent {
  _id?: string;
  title: string;
  /** ISO string — mốc bắt đầu dự kiến (mở phòng chờ). */
  scheduledStartAt: string;
  /** Thời gian chờ (phút). */
  waitingDuration: number;
}

/** Response của GET /api/game/weekly-event/current (subset dùng ở widget). */
export interface CurrentEventResponse {
  success?: boolean;
  event: CurrentEvent | null;
  status: CurrentStatus;
  nextEventAt?: string | null;
  hasJoined?: boolean;
  roomId?: string;
}

export interface PanelOptions {
  /** JWT — bắt buộc (trừ khi truyền mockCurrent để test UI). */
  token?: string;
  /** Base REST, mặc định `${origin}/api`. */
  apiBase?: string;
  /** Đích nút "Tham gia ngay"; mặc định `${origin}/weekly-event`. */
  weeklyEventUrl?: string;
  /**
   * Khung neo panel. Nếu truyền (selector hoặc element), panel dùng
   * `position: absolute` bám theo khung này (vd: stage game 16:9) thay vì
   * phủ toàn viewport. Bỏ trống => fixed theo viewport (shell native).
   */
  container?: string | HTMLElement;
  /** ms; > 0 để bật polling bắt sự kiện mở/hủy. Mặc định 0 = tắt. */
  pollInterval?: number;
  /** Bề rộng thiết kế (min-width) của panel full, px. Mặc định 640. */
  designWidth?: number;
  /** Hệ số scale nhỏ nhất khi vùng chứa hẹp. Mặc định 0.5. */
  minScale?: number;
  /**
   * Callback CHUNG cho cả "Tham gia ngay" và "Quay lại phòng chờ".
   * Nhận đủ context để tùy biến cách vào game; nếu không truyền, widget tự
   * điều hướng tới weeklyEventUrl (kèm token). Phân biệt 2 nút qua `ctx.hasJoined`.
   */
  onJoin?: (ctx: JoinContext) => void;
  /** Bỏ qua fetch, dùng dữ liệu này (chỉ để test UI). */
  mockCurrent?: CurrentEventResponse;
  /** Cho phép skew client/server; nếu không truyền sẽ tính từ header `Date`. */
  serverNowMs?: number;
}

/** Context truyền vào onJoin khi bấm "Tham gia ngay" / "Quay lại phòng chờ". */
export interface JoinContext {
  /** true = học sinh đã ở trong phòng (nút "Quay lại phòng chờ"); false = "Tham gia ngay". */
  hasJoined: boolean;
  /** Id sự kiện tuần hiện tại. */
  eventId?: string;
  /** Id phòng đã tham gia (chỉ có khi hasJoined). */
  roomId?: string;
  /** JWT đang dùng (nếu host truyền vào). */
  token?: string;
  /** URL /weekly-event mặc định (đã kèm ?token= nếu có) — dùng nếu muốn điều hướng. */
  weeklyEventUrl: string;
  /** Mốc hết phòng chờ (epoch ms). */
  deadlineMs: number;
  /** Giây còn lại tại thời điểm bấm. */
  remainingSec: number;
}

export interface PanelInstance {
  destroy(): void;
}
