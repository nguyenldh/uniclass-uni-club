# UniClub

UniClub là hệ thống game học tập tích hợp vào hệ sinh thái UniClass, bao gồm 4 game mode và 1 CMS quản trị.

## Tổng quan

### Game Modes

| Game | Mô tả |
|------|-------|
| **So Tài** | Game đối kháng trả lời câu hỏi |
| **Đấu Trí (Mind Game)** | Game Gomoku và Card Flip |
| **Săn Boss** | Game săn boss theo team |
| **Sự kiện tuần** | Sự kiện theo tuần |

### Tech Stack

| Lớp | Công nghệ |
|-----|-----------|
| **Backend** | TypeScript, Express, Socket.IO, Mongoose, ioredis |
| **Frontend (Game)** | TypeScript, React 18, Zustand, React Router, Socket.IO Client, Vite |
| **CMS (Admin)** | TypeScript, React 18, Zustand, React Router, Vite |
| **Database** | MongoDB (replica set), Redis (standalone hoặc cluster) |
| **Shared** | TypeScript types & constants |

## Cấu trúc Monorepo

```
UniClub/
├── package.json              # Root: npm workspaces + scripts
├── tsconfig.base.json        # Base TS config dùng chung
├── shared/                   # @uniclub/shared — Types & constants dùng chung
├── backend/                  # @uniclub/backend — Express + Socket.IO + MongoDB + Redis
├── frontend/                 # @uniclub/frontend — Game UI cho học sinh (React)
├── cms/                      # @uniclub/cms — Admin Dashboard (React)
├── docs/                     # Tài liệu kiến trúc
└── requirements/             # Tài liệu yêu cầu nghiệp vụ
```

## Cài đặt

### Yêu cầu hệ thống

- Node.js >= 18
- npm >= 9
- MongoDB (replica set)
- Redis

### Cài đặt dependencies

```bash
npm install
```

### Cấu hình môi trường

Mỗi package có file `.env.example`. Copy và điều chỉnh:

```bash
# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env

# CMS
cp cms/.env.example cms/.env
```

#### Backend Environment Variables

| Biến | Mô tả |
|------|-------|
| `PORT` | Port server (default: 3000) |
| `MONGO_URI` | MongoDB connection string |
| `REDIS_MODE` | `standalone` hoặc `cluster` |
| `REDIS_HOST` | Redis host |
| `REDIS_PORT` | Redis port |
| `REDIS_PASSWORD` | Redis password |
| `JWT_SECRET` | Secret key cho JWT |
| `JWT_EXPIRES_IN` | Thời gian hết hạn token |

#### Frontend Environment Variables

| Biến | Mô tả |
|------|-------|
| `VITE_API_BASE_URL` | REST API endpoint (default: `http://localhost:3000/api`) |
| `VITE_SOCKET_URL` | WebSocket endpoint (default: `http://localhost:3000`) |

#### CMS Environment Variables

| Biến | Mô tả |
|------|-------|
| `VITE_API_BASE_URL` | REST API admin endpoint (default: `http://localhost:3000/api/admin`) |

## Scripts

| Command | Mô tả |
|---------|-------|
| `npm run dev` | Chạy đồng thời backend + frontend + CMS |
| `npm run dev:backend` | Chạy riêng backend (port 3000) |
| `npm run dev:frontend` | Chạy riêng frontend (port 5173) |
| `npm run dev:cms` | Chạy riêng CMS (port 5174) |
| `npm run build` | Build tất cả package |
| `npm run typecheck` | Type-check tất cả package |

## Seed dữ liệu

Sau khi cài đặt và cấu hình môi trường, cần seed dữ liệu ban đầu:

### Seed tất cả (khuyên dùng)

```bash
# Chạy tất cả seed scripts
npm -w @uniclub/backend run seed:admin
npm -w @uniclub/backend run seed:bots
npm -w @uniclub/backend run seed:questions
```

### Seed từng loại

## Tiện ích: Tạo nhanh JWT token

Để tạo nhanh JWT token cho việc test API, có thể dùng tool HTML offline:

- Mở file [`guides/jwt-token-tool.html`](./guides/jwt-token-tool.html) bằng trình duyệt (Chrome/Edge).
- Nhập payload, secret, và các trường cần thiết để sinh token.
- Không gửi dữ liệu ra ngoài, tool chạy hoàn toàn offline.

> **Lưu ý:**
> - Secret phải trùng với biến môi trường `JWT_SECRET` của backend.
> - Token sinh ra chỉ dùng cho mục đích test/dev.

#### 1. Admin user

Tạo tài khoản admin để đăng nhập CMS:

```bash
npm -w @uniclub/backend run seed:admin
```

**Credentials mặc định:**
- Email: `admin@uniclub.vn`
- Password: `admin123`

> ⚠️ Đổi password ngay sau khi đăng nhập lần đầu!

#### 2. Bot profiles

Tạo các bot profiles cho AI matches:

```bash
# Chỉ seed nếu chưa có data
npm -w @uniclub/backend run seed:bots

# Force overwrite (xóa và tạo lại)
npm -w @uniclub/backend run seed:bots:force
```

#### 3. Quiz questions (So Tài)

Seed câu hỏi mẫu cho game So Tài:

```bash
npm -w @uniclub/backend run seed:questions
```

### Seed với Docker

Nếu backend chạy trong Docker, exec vào container:

```bash
# Seed admin
docker compose exec backend npm run seed:admin

# Seed bots
docker compose exec backend npm run seed:bots

# Seed questions
docker compose exec backend npm run seed:questions
```

Hoặc chạy tất cả:

```bash
docker compose exec backend sh -c "npm run seed:admin && npm run seed:bots && npm run seed:questions"
```

## Kiến trúc

### Quy luật thiết kế chính

1. **Monorepo với npm workspaces** — Không cần tool bên ngoài (nx, turborepo, lerna)
2. **Stateless Backend** — Auth dùng JWT, state lưu Redis để scale ngang
3. **Socket.IO multi-instance** — Dùng Redis Adapter để sync event giữa các instance
4. **Shared types** — Tất cả types/interfaces/constants được chia sẻ qua `@uniclub/shared`

### Package Dependencies

```
shared ──► (none — zero dependencies)
backend ──► shared
frontend ──► shared
cms ──► shared
```

### Sơ đồ Scale-out

```
                   ┌──────────────┐
                   │   Nginx /    │
                   │   LB (sticky)│
                   └──┬───┬───┬──┘
                      │   │   │
              ┌───────┘   │   └───────┐
              ▼           ▼           ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Backend  │ │ Backend  │ │ Backend  │
        │ Instance1│ │ Instance2│ │ Instance3│
        │ Express  │ │ Express  │ │ Express  │
        │+Socket.IO│ │+Socket.IO│ │+Socket.IO│
        └────┬─────┘ └────┬─────┘ └────┬─────┘
             │            │            │
             └────────────┼────────────┘
                          │ (pub/sub)
                    ┌─────▼─────┐     ┌──────────┐
                    │   Redis   │     │ MongoDB  │
                    │(adapter + │     │(replica  │
                    │  cache)   │     │  set)    │
                    └───────────┘     └──────────┘
```

## Modules

### [@uniclub/shared](./shared/README.md)

Package trung tâm chứa types, interfaces, DTOs, enums, và constants dùng chung.

### [@uniclub/backend](./backend/README.md)

Backend server cung cấp REST API + WebSocket cho game client và CMS.

### [@uniclub/frontend](./frontend/README.md)

Frontend game cho học sinh, nhúng vào UniClass qua WebView.

### [@uniclub/cms](./cms/README.md)

Admin Dashboard cho đội ngũ vận hành.

## Development

### Hot Reload

| Service | Cơ chế | Watch scope |
|---------|--------|-------------|
| Backend | `tsx watch` | Toàn bộ file import, bao gồm `shared/` |
| Frontend | Vite HMR | `frontend/src/` + `shared/src/` |
| CMS | Vite HMR | `cms/src/` + `shared/src/` |

### Thêm types/constants mới

1. Thêm vào `shared/src/types/` hoặc `shared/src/constants/`
2. Export trong file `index.ts` tương ứng
3. Các package khác tự động nhận được qua HMR

## Docker

### Development (chỉ infrastructure)

Chạy MongoDB và Redis cho development local:

```bash
# Chạy infrastructure
docker compose -f docker-compose.dev.yml up -d

# Với admin tools (Mongo Express, Redis Commander)
docker compose -f docker-compose.dev.yml --profile tools up -d

# Dừng
docker compose -f docker-compose.dev.yml down
```

Sau đó chạy app local:

```bash
npm run dev
```

### Production (full stack)

```bash
# Copy và cấu hình environment
cp .env.docker.example .env

# Build và chạy tất cả services
docker compose up -d

# Chỉ backend
docker compose up -d backend

# Với nginx reverse proxy
docker compose --profile proxy up -d

# Xem logs
docker compose logs -f

# Dừng
docker compose down
```

### Ports

| Service | Port | Mô tả |
|---------|------|-------|
| Backend | 3000 | REST API + Socket.IO |
| Frontend | 5173 | Game UI |
| CMS | 5174 | Admin Dashboard |
| MongoDB | 27017 | Database |
| Redis | 6379 | Cache + Pub/Sub |
| Mongo Express | 8081 | MongoDB UI (dev) |
| Redis Commander | 8082 | Redis UI (dev) |
| Nginx | 80, 443 | Reverse proxy (optional) |

### Build từng module riêng

```bash
# Backend
docker build -t uniclub-backend -f backend/Dockerfile .

# Frontend
docker build -t uniclub-frontend -f frontend/Dockerfile \
  --build-arg VITE_API_BASE_URL=https://api.example.com/api \
  --build-arg VITE_SOCKET_URL=https://api.example.com .

# CMS
docker build -t uniclub-cms -f cms/Dockerfile \
  --build-arg VITE_API_BASE_URL=https://api.example.com/api/admin .
```

## Tài liệu

- [Kiến trúc hệ thống](./docs/ARCHITECTURE.md)
- [Shared Package](./shared/ARCHITECTURE.md)
- [Backend](./backend/ARCHITECTURE.md)
- [Frontend](./frontend/ARCHITECTURE.md)
- [CMS](./cms/ARCHITECTURE.md)

## WebView postMessage — Giao tiếp với UniClass

Frontend game chạy bên trong WebView của app UniClass. Để giao tiếp với parent app, frontend sử dụng cơ chế `postMessage` thống nhất.

### Kênh gửi message

| Kênh | Ưu tiên | Mô tả |
|------|----------|-------|
| `window.ReactNativeWebView.postMessage` | 1 (cao nhất) | React Native WebView bridge |
| `window.parent.postMessage` | 2 | iframe / browser fallback |
| `console.log` (DEV only) | 3 | Development fallback — log ra console khi không có parent |

### Format message

Mọi message đều tuân theo format `WebViewMessage<T>`:

```ts
interface WebViewMessage<T> {
  type: WebViewMessageType;  // Loại message (xem bảng dưới)
  payload?: T;                // Dữ liệu tuỳ theo loại message
  timestamp: number;          // Unix timestamp (ms)
  version: number;            // Phiên bản format (hiện tại = 1)
}
```

### Các loại message

| Type | Payload | Mô tả | Trigger |
|------|---------|-------|---------|
| `app:exit` | `WebViewExitPayload` | Yêu cầu đóng WebView | User bấm nút ✕ trên lobby |
| `app:ready` | — | Game đã load xong | Tương lai (chưa dùng) |
| `game:started` | — | Bắt đầu một ván game | Tương lai (chưa dùng) |
| `game:ended` | `WebViewGameEndedPayload` | Kết thúc một ván game | Game kết thúc hoặc user bỏ cuộc |
| `game:score` | — | Cập nhật điểm giữa ván | Tương lai (chưa dùng) |
| `game:error` | — | Lỗi trong game | Tương lai (chưa dùng) |

### Message `app:exit` — Thoát game

**Payload:**

```ts
interface WebViewExitPayload {
  from?: string;    // Route hiện tại (vd. '/mind-game')
  reason?: string;  // Lý do thoát (mặc định 'user_action')
}
```

**Ví dụ:**

```json
{
  "type": "app:exit",
  "payload": { "from": "/mind-game", "reason": "user_action" },
  "timestamp": 1749000000000,
  "version": 1
}
```

**Nút thoát (✕)** chỉ hiển thị tại trang chủ (lobby) của mỗi game:

| Game | Vị trí | Route |
|------|--------|-------|
| Đấu Trí | `MindGameLobby` | `/mind-game` |
| So Tài | `QuizArenaLobbyPage` | `/quiz-arena` |
| Săn Boss | `BossLobbyPage` | `/boss-battle` |

### Message `game:ended` — Kết thúc game

**Payload:**

```ts
interface WebViewGameEndedPayload {
  userId: string;              // User ID (parent app tự map sang profileId)
  gameType: GameType;          // 'mind_game' | 'quiz_arena' | 'boss_battle'
  kafkaGameType: KafkaGameType;// 'SO_TAI' | 'CARO' | 'LAT_MANH_GHEP' | 'SAN_BOSS'
  subGame?: 'gomoku' | 'card_flip'; // Chỉ cho mind_game
  sessionId?: string;          // ID phiên chơi
  point: number;               // UniPoint đạt được
  playTime: number;            // Thời gian chơi (giây)
  sessionCompleted: boolean;   // Có hoàn thành không (false = bỏ cuộc)
  isWin: boolean;              // Có thắng không
  correctCount?: number;       // Số câu đúng (So Tài, Săn Boss)
  totalQuestions?: number;     // Tổng số câu hỏi (So Tài, Săn Boss)
  durationSeconds?: number;    // Thời gian hoàn thành (Lật Mảnh Ghép)
  consecutivePairs?: number;   // Số cặp ghép liên tiếp đúng (Lật Mảnh Ghép)
}
```

Payload tương thích với `ClubGameResultDto` (Kafka) — parent app có thể map trực tiếp hoặc dùng `kafkaGameType` để gửi tiếp lên Kafka.

#### Mapping game type

| Game | `gameType` | `kafkaGameType` | `subGame` |
|------|-----------|-----------------|-----------|
| Cờ Caro | `mind_game` | `CARO` | `gomoku` |
| Lật Thẻ | `mind_game` | `LAT_MANH_GHEP` | `card_flip` |
| So Tài | `quiz_arena` | `SO_TAI` | — |
| Săn Boss | `boss_battle` | `SAN_BOSS` | — |

#### Ví dụ payload theo từng game

**Cờ Caro — thắng:**

```json
{
  "type": "game:ended",
  "payload": {
    "userId": "user-abc123",
    "gameType": "mind_game",
    "kafkaGameType": "CARO",
    "subGame": "gomoku",
    "sessionId": "sess-gom-xyz",
    "point": 100,
    "playTime": 45,
    "sessionCompleted": true,
    "isWin": true
  },
  "timestamp": 1749000000000,
  "version": 1
}
```

**Cờ Caro — bỏ cuộc giữa trận:**

```json
{
  "type": "game:ended",
  "payload": {
    "userId": "user-abc123",
    "gameType": "mind_game",
    "kafkaGameType": "CARO",
    "subGame": "gomoku",
    "sessionId": "sess-gom-xyz",
    "point": 0,
    "playTime": 20,
    "sessionCompleted": false,
    "isWin": false
  },
  "timestamp": 1749000000000,
  "version": 1
}
```

**Lật Thẻ:**

```json
{
  "type": "game:ended",
  "payload": {
    "userId": "user-abc123",
    "gameType": "mind_game",
    "kafkaGameType": "LAT_MANH_GHEP",
    "subGame": "card_flip",
    "sessionId": "sess-cf-xyz",
    "point": 50,
    "playTime": 60,
    "sessionCompleted": true,
    "isWin": true,
    "durationSeconds": 60
  },
  "timestamp": 1749000000000,
  "version": 1
}
```

**So Tài:**

```json
{
  "type": "game:ended",
  "payload": {
    "userId": "user-abc123",
    "gameType": "quiz_arena",
    "kafkaGameType": "SO_TAI",
    "sessionId": "sess-quiz-xyz",
    "point": 80,
    "playTime": 120,
    "sessionCompleted": true,
    "isWin": true,
    "correctCount": 8,
    "totalQuestions": 10
  },
  "timestamp": 1749000000000,
  "version": 1
}
```

**Săn Boss:**

```json
{
  "type": "game:ended",
  "payload": {
    "userId": "user-abc123",
    "gameType": "boss_battle",
    "kafkaGameType": "SAN_BOSS",
    "sessionId": "attempt-xyz",
    "point": 15,
    "playTime": 30,
    "sessionCompleted": true,
    "isWin": true,
    "correctCount": 3,
    "totalQuestions": 5
  },
  "timestamp": 1749000000000,
  "version": 1
}
```

#### Trigger theo từng game

| Game | Trigger | `sessionCompleted` | Ghi chú |
|------|---------|---------------------|---------|
| Cờ Caro | Overlay kết thúc hiện ra | `true` | Gửi khi `overlayState` chuyển từ `idle` → `win`/`lose` |
| Cờ Caro | User bấm "← Thoát" giữa trận | `false` | `isWin: false`, `point: 0` |
| Lật Thẻ | Overlay kết thúc hiện ra | `true` | Gửi khi `overlayState` chuyển từ `idle` → `win`/`lose`/`draw` |
| Lật Thẻ | User bấm "← Thoát" giữa trận | `false` | `isWin: false`, `point: 0` |
| So Tài | Màn hình kết quả hiện ra | `true` | Gửi khi `phase === 'finished'` và `gameResult` available |
| Săn Boss | Màn hình kết quả lượt ngày hiện ra | `true` | Gửi khi `dailyResult` available |

> **Lưu ý:** Mỗi message `game:ended` chỉ được gửi **1 lần duy nhất** per game session (dùng `useRef` guard để tránh gửi lại khi re-render).

### Cách parent app (UniClass) lắng nghe

```js
// React Native WebView
window.ReactNativeWebView?.onMessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.version !== 1) return; // Kiểm tra version

  switch (message.type) {
    case 'app:exit':
      // Đóng WebView
      break;
    case 'game:ended':
      // Xử lý kết quả game
      const { userId, gameType, kafkaGameType, point, isWin } = message.payload;
      break;
  }
};

// iframe / browser
window.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  // ... cùng logic xử lý
});
```

### Source code

| File | Mô tả |
|------|-------|
| `shared/src/types/webview.ts` | Types: `WebViewMessage`, `WebViewExitPayload`, `WebViewGameEndedPayload` |
| `shared/src/constants/webview.ts` | Constants: `WEBVIEW_MESSAGE_TYPES`, `WEBVIEW_MESSAGE_VERSION`, `SUB_GAME_TO_KAFKA` |
| `frontend/src/utils/webview.ts` | Utility: `postWebViewMessage`, `exitWebView`, `notifyGameEnded`, `notifyAppReady` |
| `frontend/src/components/ExitButton.tsx` | Component: Nút ✕ thoát WebView |

## License

Private — UniClub © 2024
