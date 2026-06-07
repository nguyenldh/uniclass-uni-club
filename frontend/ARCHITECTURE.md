# @uniclub/frontend — Kiến trúc

## Vai trò

Frontend game cho học sinh, nhúng vào ứng dụng UniClass qua WebView. Giao tiếp với backend qua REST API + Socket.IO (real-time).

## Cách đọc tài liệu này

- Scope của file này là code frontend đang tồn tại trong repo, không mô tả UI dự kiến nếu chưa có code
- Khi tài liệu và code khác nhau, ưu tiên code làm source of truth
- Trạng thái được hiểu như sau:
    - `Implemented`: đã có page/hook/store/service trong repo
    - `Partial`: đã có flow nhưng còn điểm lệch hoặc phụ thuộc phần khác
    - `Planned`: chưa có code tương ứng

## Cấu trúc

```
frontend/
├── package.json
├── tsconfig.json           # jsx: react-jsx, noEmit
├── vite.config.ts          # React plugin + shared alias + HMR watch
├── index.html              # Entry HTML
├── .env                    # Biến môi trường (gitignored)
├── .env.example            # Template mẫu (committed)
└── src/
    ├── main.tsx            # Entry point — ReactDOM.createRoot
    ├── App.tsx             # Root component + React Router
    ├── components/
    │   └── index.ts        # Shared UI components
    ├── pages/
    │   └── index.ts        # Page-level components
    ├── stores/
    │   └── index.ts        # Zustand stores
    ├── hooks/
    │   └── index.ts        # Custom React hooks
    ├── services/
    │   └── index.ts        # API client + Socket.IO client
    └── utils/
        └── index.ts        # Helpers
```

## Quy luật

### 1. WebView-first

- Thiết kế tối ưu cho WebView trên iOS & Android
- Tỷ lệ gốc 16:9, responsive giữ nguyên tỷ lệ (letterbox/pillarbox)
- Không dùng API browser-specific không được WebView hỗ trợ

### 2. State management — Zustand

- Mỗi domain có store riêng (game, auth, socket, v.v.)
- Store không chứa business logic phức tạp — logic nằm trong hooks hoặc services
- Không dùng Redux — Zustand đủ nhẹ và đơn giản

### 3. Socket.IO client

- Kết nối tới `VITE_SOCKET_URL` (cùng cổng với REST API)
- Tự động reconnect khi mất kết nối
- Event handlers tách theo domain (matchmaking, game, boss, event)

### 4. API client

- Base URL từ `VITE_API_BASE_URL`
- Gắn JWT token vào header
- Xử lý lỗi tập trung (401 → redirect login, v.v.)

### 5. Routing — React Router

- Mỗi game mode là một route riêng
- Auth guard: redirect nếu chưa có token
- WebView nhận token qua URL parameter từ UniClass

### 6. Shared types

- Import types từ `@uniclub/shared` qua Vite alias
- Vite config có `resolve.alias` trỏ thẳng vào `../shared/src`
- `server.watch.ignored: ['!**/shared/src/**']` để HMR khi sửa shared

### 7. Components & Pages

- `components/`: UI components tái sử dụng (button, modal, timer, progress bar, avatar, v.v.)
- `pages/`: Page-level components — mỗi page tương ứng 1 route

## Mind Game (Đấu trí)

### Snapshot

| Mục | Giá trị |
|---|---|
| Status | `Implemented` |
| Entry route | `/mind-game` |
| Matchmaking route | `/matchmaking/:gameType` |
| Game routes | `/mind-game/gomoku`, `/mind-game/card-flip` |
| State | Zustand |
| Real-time | Socket.IO client |

### Source Of Truth Files

- `src/App.tsx`: route map cho Mind Game và matchmaking
- `src/pages/mind-game/MindGameLobby.tsx`: lobby chọn game con
- `src/pages/mind-game/MatchmakingPage.tsx`: page tìm trận dùng chung
- `src/pages/mind-game/GomokuPage.tsx`: flow chơi Gomoku
- `src/pages/mind-game/CardFlipPage.tsx`: flow chơi Card Flip
- `src/components/MatchmakingOverlay.tsx`: UI tìm trận reusable
- `src/stores/mind-game.ts`: Zustand stores cho Gomoku và Card Flip
- `src/hooks/useMatchmaking.ts`: socket matchmaking client
- `src/hooks/useGomokuSocket.ts`: socket gameplay Gomoku
- `src/hooks/useCardFlipSocket.ts`: socket gameplay Card Flip
- `src/services/mind-game.ts`: REST calls cho hydrate session

### Route And Entry Flow

1. Người dùng vào `/mind-game`
2. `MindGameLobby` điều hướng sang `/matchmaking/gomoku` hoặc `/matchmaking/card_flip`
3. `MatchmakingPage` render UI chung dựa trên `gameType`
4. Khi match thành công hoặc timeout sang AI, page điều hướng sang đúng game route và truyền `sessionId`, `opponentId`, `isAI`, `role`
5. Game page gọi REST một lần để hydrate session ban đầu rồi chuyển sang sync real-time bằng socket

### Matchmaking Rules

- `useMatchmaking` quản lý 4 phase: `idle`, `searching`, `matched`, `timeout`
- Hook kết nối thẳng tới `VITE_SOCKET_URL`
- Nếu server trả `status: searching`, client dùng timeout server trả về để render progress chính xác
- Nếu timeout, UI tự chuyển sang flow đấu AI thay vì quay về lobby
- `MatchmakingOverlay` chỉ là UI wrapper; logic state nằm trong hook

### State Model

- `useGomokuStore` giữ `session`, `board`, `currentTurn`, `lastMove`, `win`, `moveCount`, `overlayState`
- `useCardFlipStore` giữ `session`, `cards`, `scores`, `currentTurn`, `lastFlipped`, `overlayState`
- Cả hai store đều tự tính lại `timeElapsed` từ `startedAt` khi hydrate session, nhằm tránh reset timer sau F5
- Với Card Flip, `syncFromServer()` coi socket payload là source of truth cho board/cards state

### Gameplay Flow: Gomoku

1. `GomokuPage` nhận `sessionId` từ state của router
2. Page gọi `mindGameApi.getGomokuSession(sessionId)`
3. `useGomokuSocket` join room theo `sessionId`
4. Client render move của mình local để UI phản hồi nhanh
5. Move của đối thủ được apply từ `GOMOKU_STATE`
6. Khi reload vào session đã kết thúc, page dựng lại winning line từ `winningMove`

### Gameplay Flow: Card Flip

1. `CardFlipPage` nhận `sessionId` từ state của router
2. Page gọi `mindGameApi.getCardFlipSession(sessionId)`
3. `useCardFlipSocket` join room theo `sessionId`
4. Mọi thay đổi cards/scores/currentTurn được sync lại từ `CARD_FLIP_STATE`
5. Nếu không match, frontend chờ animation rồi mới gọi `resetFlipped(sessionId)`

### AI Placement

- Gomoku AI hiện chạy ở frontend qua `GomokuAI`
- Card Flip AI hiện chạy ở frontend qua `CardFlipAI`
- Trong cả hai game, backend vẫn là nơi validate luật, lưu session và broadcast state cuối cùng
- Điều này có nghĩa: AI decision logic nằm ở client, còn game state canonical nằm ở backend

### REST And Socket Contracts

- REST hiện dùng chủ yếu để hydrate session ban đầu
- `mindGameApi.getGomokuSession()` lấy session Gomoku
- `mindGameApi.getCardFlipSession()` lấy session Card Flip
- `joinMatchmaking()` và `leaveMatchmaking()` đang có trong service nhưng flow matchmaking thực tế hiện dùng socket hook
- Socket contracts dùng constants từ `@uniclub/shared`

### Current Limitations

- AI của cả Gomoku và Card Flip hiện không chạy ở backend
- Matchmaking page là shared page cho nhiều game, nên một số metadata vẫn game-agnostic thay vì MindGame-specific hoàn toàn
- Nếu sửa tài liệu hoặc code Mind Game, cần đối chiếu với `@uniclub/shared` trước vì đó là contract event/type chung

## Weekly Event (Sự kiện tuần)

### Snapshot

| Mục | Giá trị |
|---|---|
| Status | `Implemented` |
| Entry route | `/weekly-event` |
| State | Zustand |
| Real-time | Socket.IO Client (namespace `/we`) |

### Source Of Truth Files

- `src/pages/weekly-event/WeeklyEventController.tsx`: Điều phối giao diện (State Machine Controller) dựa theo phase của sự kiện
- `src/stores/weekly-event.ts`: Zustand store quản lý state làm bài, bộ đếm ngược, answers map, offline buffer và leaderboard của sự kiện tuần
- `src/hooks/useWeeklyEventSocket.ts`: Socket connection handler, đồng bộ thời gian (NTP-style clock skew), khôi phục phiên (`session:resume`) và replay answers offline khi có mạng trở lại
- `src/services/weekly-event.ts`: REST API client cho lấy sự kiện hiện tại, xem BXH cũ và kết quả cá nhân
- `src/design-system/weeklyevent/`: Toàn bộ các UI component màn hình của Sự kiện tuần (`closed.tsx`, `entry.tsx`, `exam.tsx`, `leaderboard.tsx`, `loading.tsx`, `result.tsx`, `waiting.tsx`)

### Runtime Flows

1. **Khởi chạy / Rejoin**:
   - Khi vào route `/weekly-event`, `WeeklyEventController` gọi REST API `/current` (kèm JWT token).
   - Nếu học sinh đã đăng ký thi trước đó, API trả về `socketToken` và `roomId` để FE tự động kết nối Socket và khôi phục màn hình thi/vinh danh/chấm bài tương ứng.
   - Nếu không có sự kiện đang chạy, FE render màn hình `EventClosedScreen` và lấy `lastEvent` để hiển thị nút "Xem bảng xếp hạng" của tuần trước.
2. **Đồng bộ thời gian & Tự động chuyển câu**:
   - Khi đang thi (`exam` phase), FE đếm ngược thời gian cho câu hiện tại dựa trên `skewMs` (clock skew đồng bộ định kỳ 10s qua `time:sync`).
   - Hết giờ câu hỏi, FE tự động tăng `currentQuestionIdx` và khóa chọn đáp án câu cũ (Lockstep).
   - Hết giờ thi, FE tự động gọi `submitFinal()` gửi bài lên server.
3. **Offline Mode**:
   - Khi mất kết nối mạng, đáp án chọn được tạm lưu vào `offlineBuffer`.
   - Khi kết nối lại, FE tự động gọi `session:request-resume` để khôi phục trạng thái và replay toàn bộ đáp án trong `offlineBuffer`.

## Environment Variables

| Biến | Mô tả | Default |
|---|---|---|
| `VITE_API_BASE_URL` | REST API endpoint | `http://localhost:3000/api` |
| `VITE_SOCKET_URL` | WebSocket endpoint | `http://localhost:3000` |

## Tech stack

| Thành phần | Lựa chọn |
|---|---|
| Framework | React 18 |
| Language | TypeScript |
| State | Zustand |
| Routing | React Router v6 |
| Real-time | Socket.IO Client |
| Build | Vite |
| Dev port | 5173 |
