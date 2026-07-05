# Weekly Event Countdown Panel (widget scriptJS)

Panel thông báo đếm ngược "Thời gian cuối cùng để tham gia" của **Sự kiện tuần**,
hiện trên các màn game (So Tài / Đấu trí / Săn boss). Đóng gói dạng **IIFE độc lập**,
cô lập bằng **Shadow DOM** — không đụng CSS/JS của trang host.

## Build

```bash
# từ thư mục frontend/
npm run build:widget
# => output: frontend/public/widgets/weekly-event-panel.js  (self-contained, robot inline)
```

Bundle được serve cùng frontend tại `/widgets/weekly-event-panel.js`.

## Nhúng

### Cách A — auto-init qua data-attribute

```html
<div id="we-panel"></div>
<script
  src="https://<frontend>/widgets/weekly-event-panel.js"
  data-auto
  data-token="<JWT>"
  data-api-base="https://<backend>/api"
  data-weekly-event-url="https://<frontend>/weekly-event"
  data-target="#we-panel"
></script>
```

### Cách B — init thủ công (khuyên dùng khi host tự quản lý vòng đời)

```html
<div id="we-panel"></div>
<script src="https://<frontend>/widgets/weekly-event-panel.js"></script>
<script>
  const panel = WeeklyEventPanel.init('#we-panel', {
    token: '<JWT>',
    apiBase: 'https://<backend>/api',              // mặc định `${origin}/api`
    weeklyEventUrl: 'https://<frontend>/weekly-event', // mặc định `${origin}/weekly-event`
    pollInterval: 0,                                // 0 = tắt polling (mặc định)
    // onJoin: () => navigate('/weekly-event'),     // override điều hướng (client-side nav)
  });
  // panel.destroy(); // khi rời màn hình
</script>
```

## Hành vi

- Gọi `GET /api/game/weekly-event/current` **một lần** lúc init.
- Chỉ hiện khi `status === 'open'` (phòng chờ đang mở) và `deadline > now`.
- Deadline = `scheduledStartAt + waitingDuration*60000`; đồng hồ tự tính local
  (skew lấy từ HTTP `Date` header), chạm 0 → tự ẩn.
- `status === 'before-open'`: hẹn `setTimeout` tới mốc mở rồi mới hiện (không polling).
- `hasJoined === true`: CTA đổi thành **"Quay lại phòng chờ"** (vẫn tới `/weekly-event`).
- **Vị trí**: mặc định `fixed` phủ viewport (shell native). Truyền `container` (vd stage game 16:9) => panel `absolute` neo trong khung đó, không đè viền letterbox.
- **Thu gọn** → pill 🏆 + `mm:ss` ở cạnh trái, kéo dọc, nhớ vị trí (localStorage).
- **Tắt** → ẩn theo **phiên** (sessionStorage), theo `eventId`.

## Options

| Option | Mặc định | Ý nghĩa |
|---|---|---|
| `token` | — | JWT (bắt buộc, trừ khi dùng `mockCurrent`) |
| `apiBase` | `${origin}/api` | Base REST |
| `weeklyEventUrl` | `${origin}/weekly-event` | Đích "Tham gia ngay" |
| `container` | — | Selector/element khung neo (vd stage game 16:9). Có => panel `absolute` bám khung; bỏ trống => `fixed` theo viewport (shell native) |
| `pollInterval` | `0` | ms; >0 để bật polling bắt sự kiện mở/hủy |
| `onJoin` | — | Callback CHUNG cho "Tham gia ngay" & "Quay lại phòng chờ" — nhận `JoinContext` |
| `designWidth` | `640` | Bề rộng thiết kế (min-width); hẹp hơn thì scale |
| `minScale` | `0.5` | Hệ số scale nhỏ nhất |

`JoinContext` truyền vào `onJoin`:
```ts
{
  hasJoined: boolean;      // true = "Quay lại phòng chờ", false = "Tham gia ngay"
  eventId?: string;
  roomId?: string;         // chỉ có khi hasJoined
  token?: string;
  weeklyEventUrl: string;  // /weekly-event (đã kèm ?token=)
  deadlineMs: number;      // mốc hết phòng chờ
  remainingSec: number;    // giây còn lại lúc bấm
}
```
| `mockCurrent` | — | Bỏ qua fetch, dùng data này (chỉ để test UI) |

## Test UI (không cần backend)

Mở `http://localhost:5173/widgets/demo.html` (khi chạy `npm run dev`).
Trang có nút mô phỏng đủ trạng thái: 4:14 (xanh) / 0:45 (cam) / 0:12 (đỏ) /
đã tham gia / chưa mở / đóng, và thử thu gọn–kéo pill–tắt.

## Màu đồng hồ

`> 60s` xanh `#16a34a` · `≤ 60s` cam `#ea580c` · `≤ 20s` đỏ `#dc2626`.
