// ============================================================
// Weekly Event — Socket.IO initialization
// Tạo 2 namespaces: /we (student) và /we-admin (CMS)
// ============================================================

import type { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { redis, env } from '../../../config/index';
import { WEEKLY_EVENT_NAMESPACES, WEEKLY_EVENT_SOCKET_EVENTS } from '@uniclub/shared';
import { registerWeeklyEventStudentHandlers } from './student.handler';
import { registerWeeklyEventAdminHandlers } from './admin.handler';
import { WeeklyEventSocketService } from '../services/weekly-event-socket.service';
import type { WeeklyEventSocketTokenPayload } from '../services/weekly-event-socket.service';
import { WeeklyEventService } from '../services/weekly-event.service';
import { WeeklyEventRoomService } from '../services/weekly-event-room.service';
import { WeeklyEventGradingService } from '../services/weekly-event-grading.service';

export function registerWeeklyEventHandlers(io: Server): void {
  // ============================================================
  // Namespace /we — Học sinh
  // ============================================================
  const studentNamespace = io.of(WEEKLY_EVENT_NAMESPACES.STUDENT);

  studentNamespace.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token as string;
      if (!token) {
        return next(new Error('Missing socket token'));
      }

      const payload = WeeklyEventSocketService.verifySocketToken(token);
      socket.data.studentId = payload.studentId;
      socket.data.eventId = payload.eventId;
      socket.data.grade = payload.grade;

      // Phát hiện multi-tab
      const oldSocketId = await WeeklyEventSocketService.detectMultiTab(
        payload.eventId,
        payload.studentId,
      );

      if (oldSocketId) {
        // Kick socket cũ hoạt động chính xác trên multi-process qua Redis Adapter
        studentNamespace.to(oldSocketId).emit('session:terminated', { reason: 'new_login' });
        studentNamespace.in(oldSocketId).disconnectSockets(true);
      }

      // Đăng ký socket mapping mới
      await WeeklyEventSocketService.registerSocketMapping(
        payload.eventId,
        payload.studentId,
        socket.id,
        process.env.HOSTNAME || 'unknown',
      );

      next();
    } catch (err: any) {
      next(new Error(`Auth failed: ${err.message}`));
    }
  });

  studentNamespace.on('connection', (socket) => {
    registerWeeklyEventStudentHandlers(io, socket);
  });

  // ============================================================
  // Namespace /we-admin — CMS Monitoring
  // ============================================================
  const adminNamespace = io.of(WEEKLY_EVENT_NAMESPACES.ADMIN);

  adminNamespace.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token as string;
      if (!token) {
        return next(new Error('Missing admin token'));
      }

      const payload = jwt.verify(token, env.JWT_SECRET) as any;
      if (!payload.adminId || !payload.role) {
        return next(new Error('Admin role required'));
      }

      socket.data.adminId = payload.adminId;
      socket.data.role = payload.role;
      next();
    } catch (err: any) {
      next(new Error(`Admin auth failed: ${err.message}`));
    }
  });

  adminNamespace.on('connection', (socket) => {
    registerWeeklyEventAdminHandlers(io, socket);
  });

  // 1. Khởi tạo Subscription Client cho các luồng Pub/Sub liên cụm (Clustering)
  const subClient = redis.duplicate();
  
  subClient.on('message', async (channel, message) => {
    if (channel === 'we:events:transitions') {
      try {
        const { eventId, grade, status } = JSON.parse(message);
        if (status === 'Showing') {
          // Lấy toàn bộ socket được kết nối cục bộ tới node này
          const localSockets = await studentNamespace.in(`room:${eventId}:${grade}`).local.fetchSockets();
          
          // Đẩy kết quả bất đồng bộ cho từng học sinh online thông qua Redis Cache
          for (const socket of localSockets) {
            const studentId = socket.data.studentId;
            if (studentId) {
              WeeklyEventGradingService.getPersonalResult(eventId, studentId, grade)
                .then((personalResult) => {
                  if (personalResult) {
                    socket.emit(WEEKLY_EVENT_SOCKET_EVENTS.PERSONAL_RESULT, {
                      correctCount: personalResult.correctCount,
                      totalAnswered: personalResult.totalAnswered,
                      rank: personalResult.rank,
                      score: personalResult.score,
                      totalTimeMs: personalResult.totalTimeMs,
                    });
                  }
                })
                .catch((err) => console.error(`[WeeklyEvent] Push result failed for ${studentId}:`, err));
            }
          }
        }
      } catch (err) {
        console.error('[WeeklyEvent] PubSub message error:', err);
      }
    }
  });

  subClient.connect().then(() => {
    subClient.subscribe('we:events:transitions').catch((err) => {
      console.error('[WeeklyEvent] SubClient subscribe error:', err);
    });
  }).catch((err) => {
    console.error('[WeeklyEvent] SubClient connect error:', err);
  });

  // 2. Chạy timer định kỳ 5 giây để broadcast online-count cục bộ (Khử bão tin nhắn)
  setInterval(async () => {
    try {
      const currentEvent = await WeeklyEventService.getCurrentEvent();
      if (!currentEvent || !currentEvent._id) return;

      const eventId = currentEvent._id;
      for (const grade of currentEvent.activeGrades) {
        const count = await WeeklyEventRoomService.getOnlineCount(eventId, grade);
        const roomName = `room:${eventId}:${grade}`;
        
        // Chỉ emit cho các sockets kết nối trực tiếp trên server node này
        studentNamespace.local.to(roomName).emit(WEEKLY_EVENT_SOCKET_EVENTS.ROOM_ONLINE_COUNT, {
          grade,
          count,
        });
      }
    } catch (err) {
      console.error('[WeeklyEvent] Periodic online count broadcast failed:', err);
    }
  }, 5000);

  console.log('[WeeklyEvent] Socket.IO namespaces initialized: /we, /we-admin');
}
