# Ngữ cảnh cho Cursor

File này là điểm vào chung để hiểu repository UniClub.

## Phạm vi

- Áp dụng cho toàn bộ repository, không chỉ riêng MindGame.
- Nếu tài liệu và code khác nhau, ưu tiên code làm nguồn sự thật.
- Nếu cần đi sâu theo domain, hãy đọc file kiến trúc tương ứng trước khi kết luận.

## Thứ tự nên đọc

1. `docs/ARCHITECTURE.md`
2. `shared/ARCHITECTURE.md`
3. Một hoặc nhiều file trong danh sách sau tùy task:
	- `backend/ARCHITECTURE.md`
	- `frontend/ARCHITECTURE.md`
	- `cms/ARCHITECTURE.md`

## Mỗi file bao phủ gì

- `docs/ARCHITECTURE.md`: kiến trúc hệ thống tổng thể, monorepo, package boundaries, tech stack, workflow phát triển.
- `shared/ARCHITECTURE.md`: types, constants, quy tắc chia sẻ contract giữa các package.
- `backend/ARCHITECTURE.md`: runtime backend, REST, Socket.IO, Redis, MongoDB, services, routes, và các domain đã được tài liệu hóa.
- `frontend/ARCHITECTURE.md`: game frontend, route, state, WebView constraints, socket flow, và các domain đã được tài liệu hóa.
- `cms/ARCHITECTURE.md`: admin frontend, REST-only flow, module quản trị, và các domain đã được tài liệu hóa.

## Cách chọn file theo task

- Task liên quan types, constants, event names, DTOs: đọc `shared/ARCHITECTURE.md` trước.
- Task liên quan API, Redis, MongoDB, Socket.IO, services: đọc `backend/ARCHITECTURE.md`.
- Task liên quan UI game, pages, hooks, Zustand, WebView: đọc `frontend/ARCHITECTURE.md`.
- Task liên quan admin dashboard, config forms, admin API usage: đọc `cms/ARCHITECTURE.md`.
- Task liên quan MindGame: sau khi đọc file tổng, đi vào section MindGame trong backend/frontend/cms.

## Quy tắc đọc

- Ưu tiên các mục `Cách đọc tài liệu này`, `Snapshot`, `Source Of Truth Files`, `Contracts`, `Current State`, `Current Limitations`.
- Không giả định domain nào đã được implement đầy đủ nếu file kiến trúc ghi `Partial` hoặc `Planned`.
- Nếu một domain chỉ có mặt ở backend nhưng chưa có ở frontend hoặc CMS, coi đó là trạng thái hiện tại của repo, không phải lỗi của tài liệu.
