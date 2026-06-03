# @uniclub/cms — Kiến trúc

## Vai trò

Admin Dashboard cho đội ngũ vận hành. Quản lý cấu hình game, ngân hàng câu hỏi, lịch sự kiện, và theo dõi số liệu. Giao tiếp với backend qua REST API (không dùng Socket.IO).

## Cách đọc tài liệu này

- Scope của file này là code CMS đang tồn tại trong repo, không mô tả UI chưa implement như thể đã tồn tại
- Khi tài liệu và code khác nhau, ưu tiên code làm source of truth
- Trạng thái được hiểu như sau:
  - `Implemented`: đã có page/hook/store/service trong repo
  - `Partial`: đã có contract hoặc một phần luồng
  - `Planned`: mới là định hướng, chưa có code UI tương ứng

## Cấu trúc

```
cms/
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
    │   └── index.ts        # Shared UI components (table, form, modal, etc.)
    ├── pages/
    │   └── index.ts        # Page-level components
    ├── stores/
    │   └── index.ts        # Zustand stores
    ├── hooks/
    │   └── index.ts        # Custom React hooks
    ├── services/
    │   └── index.ts        # API client (admin endpoints)
    └── utils/
        └── index.ts        # Helpers
```

## Quy luật

### 1. Tách biệt hoàn toàn với Frontend

- Build & deploy độc lập với game frontend
- Port dev riêng: 5174 (frontend: 5173)
- Không share components với frontend — mỗi bên có UI kit riêng

### 2. Chỉ REST API — không Socket.IO

- CMS không cần real-time (trừ khi sau này cần dashboard live)
- Gọi API qua `VITE_API_BASE_URL` (trỏ tới `/api/admin`)
- Auth: JWT token (admin role)

### 3. State management — Zustand

- Store cho từng module quản lý (questions, boss config, event config, matchmaking config)
- Pattern giống frontend: store mỏng, logic trong hooks/services

### 4. API client

- Base URL từ `VITE_API_BASE_URL`
- Gắn JWT admin token vào header
- Xử lý lỗi tập trung

### 5. Routing — React Router

- Mỗi module quản lý là một route:
  - `/questions` — Quản lý ngân hàng câu hỏi (import/export Excel)
  - `/config/so-tai` — Cấu hình So Tài
  - `/config/dau-tri` — Cấu hình Đấu Trí
  - `/config/san-boss` — Cấu hình Săn Boss
  - `/config/su-kien-tuan` — Cấu hình Sự kiện tuần
- Auth guard: redirect nếu chưa đăng nhập admin

### 6. Shared types

- Import types từ `@uniclub/shared` qua Vite alias
- Vite config có `resolve.alias` trỏ thẳng vào `../shared/src`
- `server.watch.ignored: ['!**/shared/src/**']` để HMR khi sửa shared

### 7. Components

- `components/`: UI components đặc thù cho admin (data table, config form, file upload, Excel import/export, scheduler form, v.v.)

## Mind Game (Đấu trí)

### Snapshot

| Mục | Giá trị |
|---|---|
| Status | `Partial` |
| UI trong `cms/src` | Chưa có |
| Backend contract | Đã có |
| Socket usage | Không |
| Vai trò hiện tại | Tài liệu hóa contract và định hướng tích hợp |

### Source Of Truth Files

- `backend/src/routes/admin/index.ts`: admin endpoints mà CMS sẽ gọi cho Mind Game
- `backend/src/services/game-config.service.ts`: logic đọc/ghi config và clear cache
- `backend/src/models/index.ts`: schema config `gomoku` và `card_flip`
- `cms/src`: hiện chưa có module Mind Game tương ứng

### Current State

- Trong `cms/src` hiện chưa có `page`, `store`, `hook` hay `service` riêng cho Mind Game
- Điều này có nghĩa: CMS chưa có admin UI thực thi cho Mind Game
- Phần Mind Game ở CMS hiện mới ở mức contract backend + định hướng kiến trúc

### Backend Contracts Available For CMS

- `GET /api/admin/config`: trả `configs.mind_game.gomoku` và `configs.mind_game.card_flip`
- `PUT /api/admin/config/gomoku`: cập nhật cấu hình Gomoku
- `PUT /api/admin/config/card-flip`: cập nhật cấu hình Card Flip
- `POST /api/admin/config/invalidate-cache`: clear cache config sau khi chỉnh sửa
- `GET /api/admin/leaderboard`: có thể dùng để xem leaderboard theo scope nếu CMS cần dashboard vận hành

### Data CMS Will Need

- Gomoku config: `matchmakingTimeout`, `winPoints`, `boardSize`
- Card Flip config: `matchmakingTimeout`, `winPoints`, `pairCount`, `cardItems`
- Các config này được backend lưu ở Mongo và cache ở Redis; CMS chỉ cần đóng vai trò CRUD + trigger invalidation khi cần

### Planned Integration Shape

1. Tạo module `mind-game` trong `cms/src/pages`
2. Tạo `cms/src/services` để gọi admin endpoints tương ứng
3. Tách 2 form độc lập cho `gomoku` và `card_flip`
4. Nếu cần monitoring, bổ sung màn leaderboard/số liệu cho scope `mind_game`, `gomoku`, `card_flip`

### Non-Obvious Rules

- Không nên đọc file này rồi giả định rằng CMS đã có UI Mind Game; hiện tại chưa có
- Nguồn truth cho config Mind Game hiện nằm ở backend, không nằm ở CMS
- Nếu sau này thêm UI CMS cho Mind Game, cần cập nhật file này từ `Partial` sang `Implemented`

## Environment Variables

| Biến | Mô tả | Default |
|---|---|---|
| `VITE_API_BASE_URL` | REST API admin endpoint | `http://localhost:3000/api/admin` |

## Tech stack

| Thành phần | Lựa chọn |
|---|---|
| Framework | React 18 |
| Language | TypeScript |
| State | Zustand |
| Routing | React Router v6 |
| Real-time | Không (REST only) |
| Build | Vite |
| Dev port | 5174 |
