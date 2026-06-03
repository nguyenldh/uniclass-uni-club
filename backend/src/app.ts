import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { initSocket } from './sockets';
import gameRoutes from './routes/game/index';
import adminRoutes from './routes/admin/index';
import authRoutes from './routes/auth/index';
import { registerGomokuMatchmaking, registerCardFlipMatchmaking } from './games/mind-game/services';
import { registerQuizArenaMatchmaking } from './games/quiz-arena/services';

// Đăng ký factory matchmaking cho từng game PvP
registerGomokuMatchmaking();
registerCardFlipMatchmaking();
registerQuizArenaMatchmaking();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/game', gameRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);

const httpServer = createServer(app);

// Socket.IO
initSocket(httpServer);

export { app, httpServer };
