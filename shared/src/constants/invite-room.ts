// ============================================================
// Invite Room Constants — game-agnostic
// ============================================================

/** Redis key prefixes cho phòng mời */
export const INVITE_ROOM_REDIS_KEYS = {
  /** Dữ liệu phòng: invite-room:room:<roomId> */
  ROOM: 'invite-room:room',
  /** Index phòng đang host của user: invite-room:host:<userId> = roomId */
  HOST: 'invite-room:host',
} as const;

/** Socket events cho phòng mời (game-agnostic) */
export const INVITE_ROOM_SOCKET_EVENTS = {
  /** Client → Server: host tạo phòng */
  CREATE: 'invite-room:create',
  /** Client → Server: vào phòng (guest lần đầu, hoặc host/guest reconnect) */
  JOIN: 'invite-room:join',
  /** Client → Server: đặt trạng thái sẵn sàng / tái đấu */
  READY: 'invite-room:ready',
  /** Client → Server: rời phòng */
  LEAVE: 'invite-room:leave',
  /** Server → Client: state phòng thay đổi (broadcast cho cả phòng) */
  STATE: 'invite-room:state',
  /** Server → Client: bắt đầu một ván — kèm sessionId để vào game */
  START: 'invite-room:start',
  /** Server → Client: phòng đã đóng */
  CLOSED: 'invite-room:closed',
  /** Server → Client: lỗi thao tác phòng */
  ERROR: 'invite-room:error',
} as const;

/** Mã lỗi phòng mời */
export const INVITE_ROOM_ERROR_CODES = {
  NOT_FOUND: 'ROOM_NOT_FOUND',
  FULL: 'ROOM_FULL',
  EXPIRED: 'ROOM_EXPIRED',
  SELF_JOIN: 'ROOM_SELF_JOIN',
  NO_QUESTIONS: 'ROOM_NO_QUESTIONS',
  LIMIT_REACHED: 'ROOM_LIMIT_REACHED',
  /** Phát hiện guest dùng cùng thiết bị/máy với host (chống tự chơi với mình) */
  SAME_DEVICE: 'ROOM_SAME_DEVICE',
  /** Tính năng Thách đấu bạn bè (MGM) đang bị admin tắt */
  DISABLED: 'ROOM_DISABLED',
} as const;

/** Lý do đóng phòng */
export const INVITE_ROOM_CLOSE_REASONS = {
  EXPIRED: 'expired',
  HOST_LEFT: 'host_left',
  GUEST_LEFT: 'guest_left',
  LIMIT_REACHED: 'limit_reached',
} as const;

/** Config mặc định cho phòng mời */
export const INVITE_ROOM_CONFIG = {
  /** Thời gian phòng tồn tại nếu chưa bắt đầu ván nào (phút) */
  expiryMinutes: 30,
} as const;
