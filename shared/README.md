# @uniclub/shared

Package trung tâm chứa tất cả **types**, **interfaces**, **DTOs**, **enums**, và **constants** dùng chung cho toàn bộ hệ thống UniClub.

## Vai trò

- Single source of truth cho types & constants
- Được import bởi backend, frontend, và CMS
- Zero dependencies — không chứa logic runtime

## Cấu trúc

```
shared/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts          # Barrel export
    ├── types/
    │   └── index.ts      # Interfaces, DTOs, enums
    └── constants/
        └── index.ts      # Hằng số dùng chung
```

## Cách sử dụng

### Import trong các package khác

```typescript
import { SomeType, SOME_CONSTANT } from '@uniclub/shared';
```

### Thêm types mới

1. Tạo hoặc sửa file trong `src/types/`
2. Export trong `src/types/index.ts`
3. Các package khác tự động nhận được qua HMR

### Thêm constants mới

1. Tạo hoặc sửa file trong `src/constants/`
2. Export trong `src/constants/index.ts`

## Quy luật

### ✅ Được phép

- Interfaces, type aliases, enums
- Const objects, literal constants
- Re-export types từ các file con

### ❌ Không được phép

- Import thư viện runtime (express, react, mongoose, etc.)
- Functions, classes, business logic
- API calls, side effects

## Scripts

| Command | Mô tả |
|---------|-------|
| `npm run typecheck` | Kiểm tra types |

## Cơ chế resolve trong monorepo

| Consumer | Cơ chế |
|----------|--------|
| Backend | Workspace symlink — `tsx` resolve trực tiếp |
| Frontend | Vite `resolve.alias` → `../shared/src` |
| CMS | Vite `resolve.alias` → `../shared/src` |

## Lưu ý

- Không cần build riêng khi dev — các consumer resolve TypeScript source trực tiếp
- Khi build production, chạy `tsc` để generate `.d.ts` files
