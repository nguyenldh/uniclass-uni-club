// ============================================================
// useInviteRoom — phòng chờ "Mời bạn" + Tái đấu (game-agnostic)
// Dùng cho InviteRoomPage (host/guest) và cả game page (reconnect để tái đấu).
// ============================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { INVITE_ROOM_SOCKET_EVENTS } from '@uniclub/shared';
import type { InviteRoom, MatchmakingGameType } from '@uniclub/shared';

export interface InviteRoomStartPayload {
  sessionId: string;
  gameType: MatchmakingGameType;
  roomId: string;
  role: 'first' | 'second';
  rematchRemaining: number;
}

export interface UseInviteRoomOptions {
  userId: string;
  displayName?: string;
  grade?: number;
  avatar?: string;
  gameType: MatchmakingGameType;
  /** Gọi khi server phát START (bắt đầu một ván) */
  onStart?: (payload: InviteRoomStartPayload) => void;
  /** Gọi khi phòng bị đóng */
  onClosed?: (reason: string) => void;
  /** Bật/tắt kết nối socket. Mặc định true. Trận thường (không phải phòng mời) truyền false. */
  enabled?: boolean;
}

export interface UseInviteRoomReturn {
  room: InviteRoom | null;
  error: { message: string; code?: string } | null;
  /** Host tạo phòng mới */
  create: () => void;
  /** Vào phòng theo roomId (guest lần đầu, hoặc reconnect) */
  join: (roomId: string) => void;
  /** Đặt trạng thái sẵn sàng / tái đấu */
  setReady: (ready: boolean) => void;
  /** Rời/hủy phòng */
  leave: () => void;
}

type Intent = { type: 'create' } | { type: 'join'; roomId: string };

export function useInviteRoom({
  userId,
  displayName,
  grade,
  avatar,
  gameType,
  onStart,
  onClosed,
  enabled = true,
}: UseInviteRoomOptions): UseInviteRoomReturn {
  const [room, setRoom] = useState<InviteRoom | null>(null);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const intentRef = useRef<Intent | null>(null);

  // Giữ callback + identity mới nhất qua ref để socket listener không cần re-bind
  const onStartRef = useRef(onStart);
  const onClosedRef = useRef(onClosed);
  const identityRef = useRef({ userId, displayName, grade, avatar, gameType });
  onStartRef.current = onStart;
  onClosedRef.current = onClosed;
  identityRef.current = { userId, displayName, grade, avatar, gameType };

  // Emit theo intent (dùng cho lần đầu và mỗi lần reconnect)
  const emitIntent = useCallback(() => {
    const socket = socketRef.current;
    const intent = intentRef.current;
    if (!socket || !socket.connected || !intent) return;
    const id = identityRef.current;
    if (intent.type === 'create') {
      socket.emit(INVITE_ROOM_SOCKET_EVENTS.CREATE, {
        userId: id.userId,
        displayName: id.displayName,
        grade: id.grade,
        avatar: id.avatar,
        gameType: id.gameType,
      });
    } else {
      socket.emit(INVITE_ROOM_SOCKET_EVENTS.JOIN, {
        roomId: intent.roomId,
        userId: id.userId,
        displayName: id.displayName,
        grade: id.grade,
        avatar: id.avatar,
      });
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const socket = io(import.meta.env.VITE_SOCKET_URL || '/', {
      transports: ['websocket'],
      reconnection: true,
    });
    socketRef.current = socket;

    // (Re)connect → phát lại intent để re-register socket ở server
    socket.on('connect', emitIntent);

    socket.on(INVITE_ROOM_SOCKET_EVENTS.STATE, (data: { room: InviteRoom }) => {
      setRoom(data.room);
    });
    socket.on(INVITE_ROOM_SOCKET_EVENTS.START, (data: InviteRoomStartPayload) => {
      onStartRef.current?.(data);
    });
    socket.on(INVITE_ROOM_SOCKET_EVENTS.CLOSED, (data: { reason: string }) => {
      onClosedRef.current?.(data.reason);
    });
    socket.on(INVITE_ROOM_SOCKET_EVENTS.ERROR, (data: { message: string; code?: string }) => {
      setError(data);
    });

    return () => {
      socket.off('connect', emitIntent);
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = useCallback(() => {
    setError(null);
    intentRef.current = { type: 'create' };
    emitIntent();
  }, [emitIntent]);

  const join = useCallback(
    (roomId: string) => {
      setError(null);
      intentRef.current = { type: 'join', roomId };
      emitIntent();
    },
    [emitIntent],
  );

  const setReady = useCallback((ready: boolean) => {
    const socket = socketRef.current;
    const roomId = room?.roomId ?? (intentRef.current?.type === 'join' ? intentRef.current.roomId : undefined);
    if (!socket || !roomId) return;
    socket.emit(INVITE_ROOM_SOCKET_EVENTS.READY, {
      roomId,
      userId: identityRef.current.userId,
      ready,
    });
  }, [room?.roomId]);

  const leave = useCallback(() => {
    const socket = socketRef.current;
    const roomId = room?.roomId ?? (intentRef.current?.type === 'join' ? intentRef.current.roomId : undefined);
    if (!socket || !roomId) return;
    socket.emit(INVITE_ROOM_SOCKET_EVENTS.LEAVE, {
      roomId,
      userId: identityRef.current.userId,
    });
    intentRef.current = null;
  }, [room?.roomId]);

  return { room, error, create, join, setReady, leave };
}
