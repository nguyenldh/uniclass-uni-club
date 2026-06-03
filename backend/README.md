# @uniclub/backend

Backend server cung cấp REST API + WebSocket (Socket.IO) cho toàn bộ hệ thống UniClub.

## Tổng quan

- **REST API** cho game client và CMS admin
- **Socket.IO** cho real-time gameplay
- **Stateless** — scale ngang không cần sticky session
- **Redis** — cache + Socket.IO adapter
- **MongoDB** — persistent storage

## Cấu trúc

```
backend/
├── package.json
├── tsconfig.json
├── Dockerfile
├── vitest.config.ts
└── src/
    ├── index.ts            # Entry point
    ├── app.ts              # Express app (không listen)
    ├── config/             # DB, Redis, env config
    ├── models/             # Mongoose models
    ├── routes/
    │   ├── game/           # API cho học sinh
    │   └── admin/          # API cho CMS
    ├── sockets/
    │   ├── index.ts        # Socket.IO init
    │   └── handlers/       # Event handlers
    ├── services/           # Business logic
    ├── middleware/         # Auth, validation, error handling
    ├── games/
    │   ├── mind-game/      # Đấu Trí module
    │   └── quiz-arena/     # So Tài module
    ├── scripts/            # Seed scripts
    └── utils/              # Helpers
```

## Cài đặt

### Environment Variables

Copy `.env.example` sang `.env` và điều chỉnh:

```bash
cp .env.example .env
```

| Biến | Mô tả | Default |
|------|-------|---------|
| `PORT` | Port server | `3000` |
| `MONGO_URI` | MongoDB connection string | — |
| `REDIS_MODE` | `standalone` hoặc `cluster` | `standalone` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis password | — |
| `JWT_SECRET` | Secret key cho JWT | — |
| `JWT_EXPIRES_IN` | Thời gian hết hạn token | `7d` |
| `KAFKA_ENABLED` | Bật/tắt Kafka integration | `false` |
| `KAFKA_BROKERS` | Danh sách Kafka brokers (phẩy ngăn cách) | `localhost:9092` |
| `KAFKA_CLIENT_ID` | Client ID cho Kafka producer | `uniclub-backend` |
| `KAFKA_SSL_ENABLED` | Bật/tắt SSL cho Kafka connection | `false` |
| `KAFKA_SASL_USERNAME` | Username SASL/PLAIN (chỉ dùng khi SSL bật) | — |
| `KAFKA_SASL_PASSWORD` | Password SASL/PLAIN (chỉ dùng khi SSL bật) | — |

## Scripts

| Command | Mô tả |
|---------|-------|
| `npm run dev` | Chạy dev server (tsx watch, port 3000) |
| `npm run build` | Build TypeScript |
| `npm start` | Chạy production build |
| `npm run typecheck` | Kiểm tra types |
| `npm test` | Chạy tests |
| `npm run test:watch` | Chạy tests ở chế độ watch |
| `npm run seed:admin` | Seed admin user |
| `npm run seed:bots` | Seed bot profiles |
| `npm run seed:questions` | Seed câu hỏi Quiz Arena |

## API Routes

### Game Routes (`/api/game`)

- `/api/game/mind-game/*` — Đấu Trí (Gomoku, Card Flip)
- `/api/game/quiz-arena/*` — So Tài

### Admin Routes (`/api/admin`)

- `/api/admin/config` — Cấu hình game
- `/api/admin/leaderboard` — Bảng xếp hạng
- `/api/admin/questions` — Quản lý câu hỏi

## Socket.IO Events

### Mind Game

| Event | Direction | Mô tả |
|-------|-----------|-------|
| `GOMOKU_MOVE` | Client → Server | Đi nước Gomoku |
| `GOMOKU_STATE` | Server → Client | Cập nhật trạng thái |
| `GOMOKU_END` | Server → Client | Kết thúc game |
| `CARD_FLIP_FLIP` | Client → Server | Lật thẻ |
| `CARD_FLIP_STATE` | Server → Client | Cập nhật trạng thái |
| `CARD_FLIP_END` | Server → Client | Kết thúc game |

### Matchmaking

| Event | Direction | Mô tả |
|-------|-----------|-------|
| `JOIN_MATCHMAKING` | Client → Server | Tham gia hàng đợi |
| `LEAVE_MATCHMAKING` | Client → Server | Rời hàng đợi |
| `MATCHMAKING_STATUS` | Server → Client | Trạng thái tìm trận |
| `MATCH_FOUND` | Server → Client | Đã tìm được đối thủ |

## Docker

### Build image

```bash
docker build -t uniclub-backend .
```

### Run container

```bash
docker run -p 3000:3000 \
  -e MONGO_URI=mongodb://... \
  -e REDIS_HOST=... \
  -e JWT_SECRET=... \
  uniclub-backend
```

## Kiến trúc

### Stateless Design

- Auth dùng JWT — không cần session store
- Game state lưu Redis — không lưu memory
- Scale ngang bằng cách thêm instance

### Socket.IO + Redis Adapter

```
Client1 ──► Instance1 ──┐
Client2 ──► Instance2 ──┼──► Redis Pub/Sub
Client3 ──► Instance3 ──┘
```

Khi một client emit event, Redis Adapter broadcast tới tất cả instance.

### Routes vs Services

- **Routes**: Parse request → gọi service → trả response
- **Services**: Business logic, validation, database operations
- **Socket handlers**: Tương tự routes nhưng cho WebSocket

## Testing

```bash
# Chạy tất cả tests
npm test

# Watch mode
npm run test:watch

# Với coverage
npm test -- --coverage
```

## Tài liệu chi tiết

Xem [ARCHITECTURE.md](./ARCHITECTURE.md) để hiểu chi tiết về:

- Runtime flows (Matchmaking, Gomoku, Card Flip)
- REST & Socket contracts
- Persistence rules
- Non-obvious rules & limitations
