// ============================================================
// Weekly Event — Socket.IO initialization
// Tạo 2 namespaces: /we (student) và /we-admin (CMS)
// ============================================================

import type { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../../../config/index';
import { WEEKLY_EVENT_NAMESPACES } from '@uniclub/shared';
import { registerWeeklyEventStudentHandlers } from './student.handler';
import { registerWeeklyEventAdminHandlers } from './admin.handler';
import { WeeklyEventSocketService } from '../services/weekly-event-socket.service';
import type { WeeklyEventSocketTokenPayload } from '../services/weekly-event-socket.service';

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
        // Kick socket cũ
        const oldSocket = studentNamespace.sockets.get(oldSocketId);
        if (oldSocket) {
          oldSocket.emit('session:terminated', { reason: 'new_login' });
          oldSocket.disconnect(true);
        }
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

  console.log('[WeeklyEvent] Socket.IO namespaces initialized: /we, /we-admin');
}
