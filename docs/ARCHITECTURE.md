# UniClub — Kiến trúc Hệ thống

## Tổng quan

UniClub là hệ thống game học tập tích hợp vào hệ sinh thái UniClass, gồm 4 game mode (So Tài, Đấu Trí, Săn Boss, Sự kiện tuần) và 1 CMS quản trị.

**Monorepo**: 4 package (`shared`, `backend`, `frontend`, `cms`) với npm workspaces.

```
UniClub/
├── package.json              # Root: npm workspaces + scripts
├── tsconfig.base.json        # Base TS config dùng chung
├── .gitignore
│
├── shared/                   # @uniclub/shared — Types & constants dùng chung
├── backend/                  # @uniclub/backend — Express + Socket.IO + MongoDB + Redis
├── frontend/                 # @uniclub/frontend — Game UI cho học sinh (React + Zustand + Vite)
├── cms/                      # @uniclub/cms — Admin Dashboard (React + Zustand + Vite)
└── requirements/             # Tài liệu yêu cầu nghiệp vụ (giữ nguyên)
```

## Công nghệ

| Lớp | Công nghệ |
|---|---|
| **Backend** | TypeScript, Express, Socket.IO, Mongoose, ioredis |
| **Frontend (Game)** | TypeScript, React 18, Zustand, React Router, Socket.IO Client, Vite |
| **CMS (Admin)** | TypeScript, React 18, Zustand, React Router, Vite |
| **Database** | MongoDB (replica set), Redis (standalone hoặc cluster) |
| **Shared** | TypeScript types & constants — import qua `@uniclub/shared` |

## Quy luật thiết kế

### 1. Monorepo

- Dùng **npm workspaces** — không cần tool bên ngoài (nx, turborepo, lerna)
- Mỗi package có `package.json` riêng, `tsconfig.json` kế thừa từ `tsconfig.base.json`
- Shared package (`@uniclub/shared`) được import qua workspace symlink từ tất cả package khác

### 2. Backend — Stateless & Scale-out

- **API & Socket.IO chung 1 cổng**, scale cùng nhau trên mỗi instance
- **Stateless**: Auth dùng JWT, session/state lưu Redis — không lưu gì trong memory của instance
- **Socket.IO multi-instance**: Dùng `@socket.io/redis-adapter` — Redis pub/sub đồng bộ event giữa các instance
- **Redis vai trò kép**: Cache + pub/sub broker cho Socket.IO Adapter
- **Hỗ trợ cả standalone & cluster**: Config qua `REDIS_MODE` env
- **Tách `app.ts` / `index.ts`**: `app.ts` tạo Express app (không listen) → test được không cần port; `index.ts` listen
- **Routes phân tách**: `routes/game/` cho học sinh, `routes/admin/` cho CMS
- **Container hóa**: Dockerfile cho backend để dễ scale ngang

### 3. Frontend & CMS — Độc lập

- **2 app React riêng biệt**, build & deploy độc lập
- **Frontend** (port 5173): Game cho học sinh, có Socket.IO client
- **CMS** (port 5174): Admin dashboard, chỉ gọi REST API (không Socket.IO)
- Cả 2 dùng chung `@uniclub/shared` types
- Vite config có `resolve.alias` trỏ thẳng vào `shared/src` + `server.watch` để HMR khi sửa shared

### 4. Shared — Single source of truth

- Chứa tất cả interfaces, DTOs, enums, constants dùng chung
- Backend, Frontend, CMS đều import từ `@uniclub/shared`
- Không chứa logic runtime — chỉ types & constants

### 5. Environment Variables

- Mỗi package có `.env` (gitignored) và `.env.example` (committed)
- Backend: `PORT`, `MONGO_URI`, `REDIS_*`, `JWT_SECRET`, `JWT_EXPIRES_IN`
- Frontend: `VITE_API_BASE_URL`, `VITE_SOCKET_URL`
- CMS: `VITE_API_BASE_URL`

### 6. Dev Workflow

| Command | Mô tả |
|---|---|
| `npm run dev` | Chạy đồng thời backend + frontend + CMS (concurrently) |
| `npm run dev:backend` | Chạy riêng backend (tsx watch, port 3000) |
| `npm run dev:frontend` | Chạy riêng frontend (Vite HMR, port 5173) |
| `npm run dev:cms` | Chạy riêng CMS (Vite HMR, port 5174) |
| `npm run build` | Build tất cả package |
| `npm run typecheck` | Type-check tất cả package |

### 7. Watch / Hot Reload

| Service | Cơ chế | Watch scope |
|---|---|---|
| Backend | `tsx watch` | Toàn bộ file import, bao gồm `shared/` |
| Frontend | Vite HMR | `frontend/src/` + `shared/src/` |
| CMS | Vite HMR | `cms/src/` + `shared/src/` |

## Sơ đồ Scale-out

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

## Package dependencies

```
shared ──► (none — zero dependencies)
backend ──► shared
frontend ──► shared
cms ──► shared
```
