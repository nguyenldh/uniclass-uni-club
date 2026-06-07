// ============================================================
// Weekly Event — Admin Socket Handler (namespace /we-admin)
// FLOW-013: Real-time monitoring
// ============================================================

import type { Socket, Server } from 'socket.io';
import {
  WEEKLY_EVENT_ADMIN_SOCKET_EVENTS,
  WEEKLY_EVENT_ADMIN_ROOM_PREFIX,
  WEEKLY_EVENT_ADMIN_METRICS_INTERVAL_MS,
} from '@uniclub/shared';
import { WeeklyEventRoomService } from '../services/weekly-event-room.service';
import { WeeklyEventService } from '../services/weekly-event.service';
import { WeeklyEventModel } from '../../../models/index';

function adminRoomName(eventId: string): string {
  return `${WEEKLY_EVENT_ADMIN_ROOM_PREFIX}:${eventId}`;
}

export function registerWeeklyEventAdminHandlers(io: Server, socket: Socket): void {
  const adminId = socket.data.adminId as string;

  if (!adminId) {
    socket.emit(WEEKLY_EVENT_ADMIN_SOCKET_EVENTS.MONITOR_ALERT, {
      level: 'critical',
      code: 'AUTH_FAILED',
      message: 'Admin authentication required',
    });
    socket.disconnect();
    return;
  }

  console.log(`[WeeklyEvent Admin] Admin connected: ${adminId} (socket=${socket.id})`);

  let metricsInterval: ReturnType<typeof setInterval> | null = null;
  let subscribedEventId: string | null = null;

  // ============================================================
  // A03: monitor:subscribe — subscribe vào event để nhận metrics
  // ============================================================
  socket.on(WEEKLY_EVENT_ADMIN_SOCKET_EVENTS.MONITOR_SUBSCRIBE, async (payload, ack) => {
    try {
      const { eventId } = payload || {};
      if (!eventId) {
        ack?.({ ok: false, error: 'Missing eventId' });
        return;
      }

      // Rời room cũ nếu có
      if (subscribedEventId) {
        socket.leave(adminRoomName(subscribedEventId));
      }

      // Join room mới
      subscribedEventId = eventId;
      socket.join(adminRoomName(eventId));

      // Clear interval cũ
      if (metricsInterval) clearInterval(metricsInterval);

      // Bắt đầu push metrics mỗi 2s
      metricsInterval = setInterval(async () => {
        try {
          const event = await WeeklyEventModel.findById(eventId).lean();
          if (!event) return;

          const metrics = [];
          for (const grade of event.activeGrades) {
            const online = await WeeklyEventRoomService.getOnlineCount(eventId, grade);
            const rooms = await WeeklyEventService.getRooms(eventId);
            const room = rooms.find((r) => r.grade === grade);

            metrics.push({
              grade,
              online,
              submitted: room?.submittedCount || 0,
              errorRate: 0, // TODO: implement error rate tracking
            });
          }

          io.to(adminRoomName(eventId)).emit(
            WEEKLY_EVENT_ADMIN_SOCKET_EVENTS.MONITOR_METRICS,
            metrics,
          );
        } catch (err) {
          console.error('[WeeklyEvent Admin] Metrics error:', err);
        }
      }, WEEKLY_EVENT_ADMIN_METRICS_INTERVAL_MS);

      ack?.({ ok: true });
    } catch (err: any) {
      ack?.({ ok: false, error: err.message });
    }
  });

  // ============================================================
  // A04: event:cancel — hủy sự kiện khẩn cấp
  // ============================================================
  socket.on(WEEKLY_EVENT_ADMIN_SOCKET_EVENTS.EVENT_CANCEL, async (payload, ack) => {
    try {
      const { eventId, reason } = payload || {};
      if (!eventId) {
        ack?.({ ok: false, error: 'Missing eventId' });
        return;
      }

      const event = await WeeklyEventService.cancelEvent(eventId, reason || 'Admin cancelled via monitor');

      // Broadcast cancel tới tất cả student rooms
      for (const grade of event.activeGrades) {
        io.to(`${eventId}:${grade}`).emit('room:cancelled', {
          reason: reason || 'Sự kiện đã bị hủy',
          cancelledAt: new Date().toISOString(),
        });
      }

      ack?.({ ok: true, event });
    } catch (err: any) {
      ack?.({ ok: false, error: err.message });
    }
  });

  // ============================================================
  // disconnect — cleanup
  // ============================================================
  socket.on('disconnect', () => {
    console.log(`[WeeklyEvent Admin] Admin disconnected: ${adminId} (socket=${socket.id})`);
    if (metricsInterval) {
      clearInterval(metricsInterval);
      metricsInterval = null;
    }
  });
}
