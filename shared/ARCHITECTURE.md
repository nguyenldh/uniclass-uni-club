# @uniclub/shared — Kiến trúc

## Vai trò

Package trung tâm chứa tất cả **types**, **interfaces**, **DTOs**, **enums**, và **constants** dùng chung cho toàn bộ hệ thống. Là single source of truth — backend, frontend, CMS đều import từ đây.

## Cấu trúc

```
shared/
├── package.json          # name: @uniclub/shared
├── tsconfig.json         # extends ../tsconfig.base.json
└── src/
    ├── index.ts          # Barrel export: export * from './types' + './constants'
    ├── types/
    │   └── index.ts      # Interfaces, DTOs, enums
    └── constants/
        └── index.ts      # Hằng số dùng chung
```

## Quy luật

### 1. Zero dependencies

Shared package **không được import bất kỳ thư viện runtime nào** (express, react, mongoose, v.v.). Chỉ chứa pure TypeScript types & constants.

### 2. Chỉ types & constants — không logic

- ✅ Interfaces, type aliases, enums, const objects
- ❌ Functions, classes, business logic, API calls

### 3. Barrel export

Mọi thứ được export qua `src/index.ts`. Các package khác import:

```ts
import { SomeType, SOME_CONSTANT } from '@uniclub/shared';
```

### 4. Cách import trong monorepo

- **Backend**: Qua workspace symlink — `tsx` resolve trực tiếp
- **Frontend / CMS**: Qua Vite `resolve.alias` trỏ vào `shared/src` (để HMR hoạt động)

### 5. Không build khi dev

Shared không cần build riêng khi dev — các consumer (backend/frontend/cms) tự resolve TypeScript source trực tiếp.

## Tech stack

| Thành phần | Lựa chọn |
|---|---|
| Language | TypeScript |
| Build | tsc (chỉ khi build production) |
| Dependencies | **Không có** |
