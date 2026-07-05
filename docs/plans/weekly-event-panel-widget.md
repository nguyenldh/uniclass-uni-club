# Plan: Weekly Event Countdown Panel (scriptJS Widget)

> Panel thông báo đếm ngược "Thời gian cuối cùng để tham gia" của Sự kiện tuần,
> hiện trên các màn game So Tài / Đấu trí / Săn boss.

## 1. Quyết định đã chốt

| Vấn đề | Chốt |
|---|---|
| Đóng gói | **Bundle JS độc lập (IIFE)** + expose `window.WeeklyEventPanel.init(el, opts)` (host tự init) |
| Nguồn token | **Data-attribute** trên `<script>` / opts (`token`), fallback tùy chọn |
| Nút "Tắt" | Ẩn **theo phiên** (sessionStorage), mở lại tab/WebView sẽ hiện lại nếu sự kiện còn mở |
| Cập nhật dữ liệu | **Init-once + local countdown**; polling tắt mặc định (có opt bật) |

## 2. Nguồn dữ liệu (đã xác minh trong code)

- `GET /api/game/weekly-event/current` (gắn `Authorization: Bearer <token>`) trả:
  - `status`: `before-open` | `open` | `in-progress` | `closed`
  - `event`: `{ scheduledStartAt, waitingDuration, title, ... }`
  - `nextEventAt`, `hasJoined`, `roomId`
- **Panel chỉ hiện khi `status === 'open'`** (backend `Waiting` = phòng chờ đang mở).
- **Deadline đếm ngược** = `new Date(scheduledStartAt).getTime() + waitingDuration*60*1000`
  (đúng công thức `getWaitingEndTime()` tại `WeeklyEventController.tsx:364`).
- Đồng bộ giờ: dùng offset local đơn giản (server time trả kèm response header hoặc bỏ qua skew;
  weekly event dùng `time:sync` qua socket nhưng widget REST-only → chấp nhận sai số nhỏ).

## 3. Kiến trúc build

Thư mục mới: `frontend/widgets/weekly-event-panel/`

```
frontend/widgets/weekly-event-panel/
├── src/
│   ├── index.ts        # entry: định nghĩa window.WeeklyEventPanel + auto-init nếu có data-auto
│   ├── panel.ts        # dựng DOM trong Shadow DOM, render 2 trạng thái (full / thu gọn)
│   ├── api.ts          # fetch /current, tính deadline
│   ├── countdown.ts    # timer + format mm:ss + màu urgent
│   ├── storage.ts      # sessionStorage (tắt), localStorage (vị trí pill)
│   └── styles.ts       # CSS string, inject vào shadowRoot (không đụng CSS host)
├── vite.config.ts      # build.lib format 'iife', name 'WeeklyEventPanel', cssCodeSplit false
└── package.json        # script build → output frontend/public/widgets/weekly-event-panel.js
```

- **Vite library mode**, `format: ['iife']`, output 1 file `.js` self-contained (CSS inline vào JS).
- Dùng **Shadow DOM** cho gốc panel → cô lập hoàn toàn CSS khỏi trang host.
- Import type từ `@uniclub/shared` (chỉ type, tree-shaken khỏi bundle).
- Output đặt tại `frontend/public/widgets/weekly-event-panel.js` để serve cùng frontend
  (hoặc copy sang CDN/native shell tùy deploy — cấu hình sau).

## 4. API công khai của widget

```html
<script src=".../weekly-event-panel.js"
        data-token="<JWT>"
        data-api-base="https://.../api"
        data-weekly-event-url="https://.../weekly-event"
        data-auto></script>
<div id="we-panel"></div>
```

```ts
window.WeeklyEventPanel.init(target: string | HTMLElement, opts: {
  token: string;                 // JWT — bắt buộc
  apiBase?: string;              // mặc định suy từ origin + '/api'
  weeklyEventUrl?: string;       // đích nút "Tham gia ngay", mặc định `${origin}/weekly-event`
  pollInterval?: number;         // ms; mặc định 0 = tắt polling
  onJoin?: () => void;           // override hành vi điều hướng (nếu host muốn tự xử lý)
}): { destroy(): void };
```

- `data-auto`: nếu có, script tự init vào `#we-panel` (hoặc tự tạo div) — đúng ý "tự động init".
- Không `data-auto`: host chủ động gọi `init()` (linh hoạt cho nhiều host).

## 5. Luồng runtime

1. `init()` đọc token/opts → gọi `/current`.
2. Phân nhánh theo `status`:
   - `open`: tính deadline. Nếu `deadline > now` và chưa bị "Tắt" trong phiên → **render panel full**, chạy countdown.
   - `before-open` + có `scheduledStartAt`: `setTimeout` tới mốc mở rồi mới hiện (không poll).
   - `in-progress` / `closed`: không hiện. Nếu `pollInterval>0` → poll để bắt sự kiện mở mới.
3. Countdown mỗi giây: cập nhật `mm:ss`, đổi màu theo ngưỡng urgent. Chạm 0 → ẩn panel (destroy timer).
4. Nếu `hasJoined === true`: vẫn hiện nhưng CTA đổi thành **"Quay lại phòng chờ"** (vẫn điều hướng `/weekly-event`). *(cần bạn xác nhận — mục 8)*

## 6. UI — 2 trạng thái

**Full (ảnh 1):** card bo góc, nền kem, tiêu đề "SỰ KIỆN BẮT ĐẦU RỒI!!!", dòng "Thời gian cuối cùng để tham gia", đồng hồ lớn (đổi màu), minh hoạ robot bên phải, 3 nút:
- **Tham gia ngay** (nút cam đậm) → điều hướng `weeklyEventUrl` (hoặc `onJoin()`).
- **Thu gọn** (nút viền) → chuyển sang trạng thái pill.
- **Tắt** (text) → ẩn + lưu sessionStorage, không hiện lại trong phiên.

**Thu gọn / pill (ảnh 2):** pill nhỏ = icon cúp 🏆 + `mm:ss` (đổi màu), **kéo dọc theo cạnh trái** màn hình, vị trí lưu `localStorage`. Click pill → mở lại full.

**Màu đồng hồ (đề xuất, chờ bạn chốt):**
- `> 60s`: xanh lá `#16a34a`
- `≤ 60s`: cam `#ea580c`
- `≤ 20s`: đỏ `#dc2626`
(khớp ảnh: 4:14 xanh, 0:22 đỏ)

## 7. Chi tiết kỹ thuật cần lưu ý

- **WebView constraint:** kéo pill dùng pointer events (hỗ trợ touch), clamp trong viewport, chỉ trục dọc + dính cạnh trái.
- **Không xung đột nhiều lần init:** guard nếu đã init trên cùng element → trả instance cũ.
- **Điều hướng trong SPA:** nếu widget cùng origin với game, `weeklyEventUrl` là full-page nav (`location.href`) → reload sang route `/weekly-event`. Nếu host muốn client-side nav, dùng `onJoin` callback.
- **z-index cao** + `position: fixed`, không chặn tương tác game khi ở pill.

## 8. Thông tin đã chốt (đã implement)

1. **Ảnh robot**: `frontend/public/images/weekly-event/join-widget/robot.png` → **inline base64** vào bundle (self-contained, chạy được cả khi host khác origin).
2. **Màu/brand**: nền `#FFF7ED`, viền `#F7711D` width `1px 6px 6px 1px`, box-shadow theo spec khách. Đồng hồ: xanh `#16a34a` (>60s) · cam `#ea580c` (≤60s) · đỏ `#dc2626` (≤20s).
3. **Đích "Tham gia ngay"**: `/weekly-event` **cùng origin**, không query → full-page nav (`onJoin` để override client-side nav).
4. **`hasJoined = true`**: vẫn hiện, CTA đổi thành **"Quay lại phòng chờ"**.
5. **"Tắt"**: chỉ ở trạng thái full; ẩn theo **phiên** (sessionStorage), theo `eventId`.
6. **Nhúng**: cả 2 (WebView shell native + SPA) → token qua `data-token`/opts.
7. **Deploy**: serve cùng frontend tại `/widgets/weekly-event-panel.js`.

## 10. Trạng thái: ĐÃ IMPLEMENT

- Nguồn: `frontend/widgets/weekly-event-panel/` · Build: `npm run build:widget` (từ `frontend/`).
- Output: `frontend/public/widgets/weekly-event-panel.js` (86KB / 61KB gzip).
- Test UI: `frontend/public/widgets/demo.html` → `http://localhost:5173/widgets/demo.html`.
- Hướng dẫn nhúng: `frontend/widgets/weekly-event-panel/README.md`.

## 9. Các bước triển khai (sau khi chốt mục 8)

1. Tạo skeleton `frontend/widgets/weekly-event-panel/` + `vite.config.ts` (lib IIFE).
2. `api.ts`: fetch `/current`, map status, tính deadline.
3. `panel.ts` + `styles.ts`: Shadow DOM, render full + pill, illustration.
4. `countdown.ts`: timer, format, màu urgent.
5. `storage.ts`: dismiss theo phiên + vị trí pill.
6. Drag pill (pointer events, clamp, dính trái).
7. `index.ts`: `window.WeeklyEventPanel.init` + auto-init `data-auto`.
8. Thêm npm script `build:widget` + hướng dẫn nhúng.
9. Test thủ công trên 1 màn game + mô phỏng 4 status.
```
