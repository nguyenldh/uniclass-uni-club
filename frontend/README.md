# @uniclub/frontend

Frontend game cho học sinh, nhúng vào ứng dụng UniClass qua WebView.

## Tổng quan

- **React 18** với TypeScript
- **Zustand** cho state management
- **Socket.IO Client** cho real-time gameplay
- **Vite** cho build & HMR
- **WebView-first** — tối ưu cho iOS & Android

## Cấu trúc

```
frontend/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
└── src/
    ├── main.tsx            # Entry point
    ├── App.tsx             # Root component + Router
    ├── components/         # Shared UI components
    ├── pages/              # Page components
    │   └── mind-game/      # Đấu Trí pages
    ├── stores/             # Zustand stores
    ├── hooks/              # Custom hooks
    ├── services/           # API & Socket clients
    ├── utils/              # Helpers
    └── design-system/      # UI components cơ bản
```

## Cài đặt

### Environment Variables

Copy `.env.example` sang `.env`:

```bash
cp .env.example .env
```

| Biến | Mô tả | Default |
|------|-------|---------|
| `VITE_API_BASE_URL` | REST API endpoint | `http://localhost:3000/api` |
| `VITE_SOCKET_URL` | WebSocket endpoint | `http://localhost:3000` |

## Scripts

| Command | Mô tả |
|---------|-------|
| `npm run dev` | Chạy dev server (Vite HMR, port 5173) |
| `npm run build` | Build production |
| `npm run preview` | Preview production build |
| `npm run typecheck` | Kiểm tra types |

## Routes

| Route | Component | Mô tả |
|-------|-----------|-------|
| `/` | HomePage | Trang chủ |
| `/mind-game` | MindGameLobby | Lobby chọn game Đấu Trí |
| `/matchmaking/:gameType` | MatchmakingPage | Tìm trận |
| `/mind-game/gomoku` | GomokuPage | Chơi Gomoku |
| `/mind-game/card-flip` | CardFlipPage | Chơi Card Flip |

## Game Flows

### Matchmaking Flow

```
MindGameLobby ──► MatchmakingPage ──► GomokuPage/CardFlipPage
     │                  │                      │
     │                  │                      │
  Chọn game      Socket: searching      REST: hydrate session
                 Socket: matched        Socket: gameplay
```

### Gomoku Gameplay

1. Page nhận `sessionId` từ router state
2. Gọi REST để lấy session ban đầu
3. Join Socket.IO room
4. Local render move → Server validate → Broadcast state
5. Khi game kết thúc, hiển thị winning line

### Card Flip Gameplay

1. Page nhận `sessionId` từ router state
2. Gọi REST để lấy session ban đầu
3. Join Socket.IO room
4. Flip card → Server validate → Broadcast state
5. Không match → Animation → Reset flipped

## State Management

### Zustand Stores

| Store | Mô tả |
|-------|-------|
| `useGomokuStore` | Session, board, currentTurn, lastMove, win |
| `useCardFlipStore` | Session, cards, scores, currentTurn |
| `useMatchmakingStore` | Phase, opponentId, sessionId |

### AI Logic

- **Gomoku AI**: Chạy ở frontend (`GomokuAI`)
- **Card Flip AI**: Chạy ở frontend (`CardFlipAI`)
- Backend vẫn validate và lưu state cuối cùng

## Docker

### Build image

```bash
docker build -t uniclub-frontend .
```

### Run container

```bash
docker run -p 5173:80 uniclub-frontend
```

## Development

### Hot Reload

Vite HMR watch cả `frontend/src/` và `shared/src/`. Khi sửa types trong shared, frontend tự reload.

### Thêm page mới

1. Tạo component trong `src/pages/`
2. Thêm route trong `src/App.tsx`
3. Tạo store nếu cần trong `src/stores/`
4. Tạo hook nếu cần trong `src/hooks/`

### WebView Constraints

- Không dùng API browser-specific không được WebView hỗ trợ
- Test trên cả iOS và Android WebView
- Tỷ lệ 16:9, responsive với letterbox/pillarbox

## Tài liệu chi tiết

Xem [ARCHITECTURE.md](./ARCHITECTURE.md) để hiểu chi tiết về:

- Route & entry flows
- Matchmaking rules
- State model
- Gameplay flows
- REST & Socket contracts
