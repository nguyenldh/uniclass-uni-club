# @uniclub/cms

Admin Dashboard cho đội ngũ vận hành UniClub.

## Tổng quan

- **React 18** với TypeScript
- **Ant Design** cho UI components
- **Zustand** cho state management
- **REST API only** — không dùng Socket.IO
- **Vite** cho build & HMR

## Cấu trúc

```
cms/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
└── src/
    ├── main.tsx            # Entry point
    ├── App.tsx             # Root component + Router
    ├── components/         # Shared UI components
    │   ├── AppLayout.tsx   # Layout wrapper
    │   ├── RequireAuth.tsx # Auth guard
    │   └── ...
    ├── pages/              # Page components
    │   ├── mind-game/      # Cấu hình Đấu Trí
    │   └── quiz-arena/     # Cấu hình So Tài
    ├── stores/             # Zustand stores
    ├── hooks/              # Custom hooks
    ├── services/           # API clients
    └── utils/              # Helpers (Excel, etc.)
```

## Cài đặt

### Environment Variables

Copy `.env.example` sang `.env`:

```bash
cp .env.example .env
```

| Biến | Mô tả | Default |
|------|-------|---------|
| `VITE_API_BASE_URL` | REST API admin endpoint | `http://localhost:3000/api/admin` |

## Scripts

| Command | Mô tả |
|---------|-------|
| `npm run dev` | Chạy dev server (Vite HMR, port 5174) |
| `npm run build` | Build production |
| `npm run preview` | Preview production build |
| `npm run typecheck` | Kiểm tra types |

## Routes

| Route | Page | Mô tả |
|-------|------|-------|
| `/login` | LoginPage | Đăng nhập admin |
| `/` | DashboardPage | Dashboard tổng quan |
| `/bot-profiles` | BotProfilesPage | Quản lý bot profiles |
| `/quiz-arena/questions` | QuestionsPage | Ngân hàng câu hỏi |
| `/quiz-arena/config` | ConfigPage | Cấu hình So Tài |
| `/mind-game/config` | (Planned) | Cấu hình Đấu Trí |

## Tính năng

### Quản lý câu hỏi

- Import/Export Excel
- CRUD câu hỏi
- Phân loại theo độ khó, chủ đề

### Cấu hình game

- Matchmaking timeout
- Điểm thắng/thua
- Board size (Gomoku)
- Pair count (Card Flip)

### Bot Profiles

- Quản lý avatar, tên bot
- Seed bot cho AI matches

## API Integration

### Admin Endpoints

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/api/admin/config` | Lấy tất cả config |
| `PUT` | `/api/admin/config/gomoku` | Cập nhật config Gomoku |
| `PUT` | `/api/admin/config/card-flip` | Cập nhật config Card Flip |
| `POST` | `/api/admin/config/invalidate-cache` | Clear cache |
| `GET` | `/api/admin/leaderboard` | Lấy leaderboard |
| `GET` | `/api/admin/questions` | Lấy danh sách câu hỏi |
| `POST` | `/api/admin/questions` | Thêm câu hỏi |
| `PUT` | `/api/admin/questions/:id` | Sửa câu hỏi |
| `DELETE` | `/api/admin/questions/:id` | Xóa câu hỏi |

### API Client

```typescript
import { configService } from './services';

// Lấy config
const configs = await configService.getConfigs();

// Cập nhật config
await configService.updateGomokuConfig({ boardSize: 15 });

// Clear cache
await configService.invalidateCache('gomoku');
```

## Docker

### Build image

```bash
docker build -t uniclub-cms .
```

### Run container

```bash
docker run -p 5174:80 uniclub-cms
```

## Development

### Hot Reload

Vite HMR watch cả `cms/src/` và `shared/src/`. Khi sửa types trong shared, CMS tự reload.

### Thêm page mới

1. Tạo component trong `src/pages/`
2. Thêm route trong `src/App.tsx`
3. Thêm menu item trong `AppLayout.tsx`
4. Tạo service nếu cần trong `src/services/`

### Excel Import/Export

```typescript
import { parseExcelToQuestions, exportQuestionsToExcel } from './utils/excel';

// Import
const questions = await parseExcelToQuestions(file);

// Export
exportQuestionsToExcel(questions, 'questions.xlsx');
```

## Trạng thái hiện tại

| Module | Status |
|--------|--------|
| Login/Auth | ✅ Implemented |
| Dashboard | ✅ Implemented |
| Bot Profiles | ✅ Implemented |
| Quiz Arena Questions | ✅ Implemented |
| Quiz Arena Config | ✅ Implemented |
| Mind Game Config | ⏳ Planned |

## Tài liệu chi tiết

Xem [ARCHITECTURE.md](./ARCHITECTURE.md) để hiểu chi tiết về:

- Backend contracts
- Data CMS cần
- Planned integration
- Non-obvious rules
