import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Server as HttpServer } from 'http';
import { redis, env } from '../config';
import { registerGameHandlers } from './handlers/index';
import { registerWeeklyEventHandlers } from '../games/weekly-event/sockets/index';
import { SocketRegistry } from '../services';

let io: Server;

export function initSocket(httpServer: HttpServer): Server {
  // Redis Adapter cần pub/sub client riêng biệt
  const pubClient = redis.duplicate();
  const subClient = redis.duplicate();

  io = new Server(httpServer, {
    adapter: createAdapter(pubClient, subClient),
    cors: {
      origin: '*', // Sẽ restrict sau
    },
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Đăng ký game handlers
    registerGameHandlers(io, socket);

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
      const userId = socket.data.userId;
      if (userId) {
        SocketRegistry.deregister(userId, socket.id).catch(console.error);
      }
    });
  });

  // Đăng ký Weekly Event namespaces (/we, /we-admin)
  registerWeeklyEventHandlers(io);

  console.log(`[Socket] Socket.IO initialized with Redis Adapter (${env.REDIS_MODE})`);
  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
}
