// ============================================================
// Boss Battle — Socket.IO handlers
// Chỉ phục vụ join/leave room realtime BXH; gameplay đi qua REST.
// ============================================================

import type { Socket, Server } from 'socket.io';
import { BOSS_BATTLE_SOCKET_EVENTS, BOSS_BATTLE_ROOM_PREFIX } from '@uniclub/shared';

function roomName(weekKey: string, gradeLevel: number): string {
  return `${BOSS_BATTLE_ROOM_PREFIX}:${weekKey}:${gradeLevel}`;
}

export function registerBossBattleHandlers(_io: Server, socket: Socket): void {
  socket.on(
    BOSS_BATTLE_SOCKET_EVENTS.JOIN_ROOM,
    (payload: { weekKey: string; gradeLevel: number }, ack?: (res: { ok: boolean; error?: string }) => void) => {
      try {
        if (!payload?.weekKey || typeof payload.gradeLevel !== 'number') {
          ack?.({ ok: false, error: 'Invalid payload' });
          return;
        }
        socket.join(roomName(payload.weekKey, payload.gradeLevel));
        ack?.({ ok: true });
      } catch (err: any) {
        ack?.({ ok: false, error: err.message });
      }
    },
  );

  socket.on(
    BOSS_BATTLE_SOCKET_EVENTS.LEAVE_ROOM,
    (payload: { weekKey: string; gradeLevel: number }, ack?: (res: { ok: boolean }) => void) => {
      if (payload?.weekKey && typeof payload?.gradeLevel === 'number') {
        socket.leave(roomName(payload.weekKey, payload.gradeLevel));
      }
      ack?.({ ok: true });
    },
  );
}
