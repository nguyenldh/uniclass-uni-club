# Uniclass · Sự kiện tuần (Weekly Event) — React Component Package

Bộ component **React + TypeScript** cho tính năng **Sự kiện tuần** (9 phòng thi theo khối,
10h00–10h30 thứ Bảy hàng tuần), tách rời theo tài liệu giải pháp
(`weekly-event-solution.md`). Xây trên design system Uniclass (`react-design-system/`):
font Nunito, palette cam brand `#e8530e`, tokens `--g-*` — phủ thêm một lớp theme
**"đấu trường" tối / trang trọng** (`--we-*`).

> Mỗi screen & component đều **gắn sẵn mã định danh** từ tài liệu vào DOM qua thuộc tính
> `data-scr="UI-S-00x"` (màn hình) và `data-ui="UI-C-0xx"` (thành phần). Tra cứu trong DevTools:
> `document.querySelector('[data-ui="UI-C-001"]')`.

> **Phạm vi:** chỉ phần **học sinh** (UI-S-001 → UI-S-007) + 10 component dùng chung
> (UI-C-001 → UI-C-010). **Bỏ qua CMS** (UI-S-008 → UI-S-012) theo yêu cầu.

---

## Phụ thuộc

Folder `weeklyevent/` **không tự đứng độc lập hoàn toàn** — dùng lại building block của
design system gốc:

| Cần | Lấy từ |
|---|---|
| `GameButton` | `../game` |
| `TrophyIcon`, `IconSprites` | `../icons` |
| Tokens (`--g-*`, `--o-*`, `--f-game`, `--success`…) | `../index.css` |

Khi copy sang project khác, mang theo cả `react-design-system/` (hoặc tối thiểu
`game.tsx`, `icons.tsx`, `index.css`). `IconSprites` phải mount **1 lần** ở root.

```tsx
import { IconSprites } from './react-design-system';
import {
  EventEntry, WaitingRoom, ExamScreen, SubmissionLoading,
  LeaderboardScreen, PersonalResultScreen, EventClosedScreen,
} from './react-design-system/weeklyevent';

export default function App() {
  return (
    <>
      <IconSprites />               {/* mount 1 lần */}
      <WaitingRoom /* … */ />
    </>
  );
}
```

---

## Cấu trúc

```
weeklyevent/
├── weeklyevent.css   — toàn bộ style (.we-* namespace, theme đấu trường tối)
├── index.tsx         — barrel re-export
├── shared.tsx        — UI-C-001 … UI-C-010 (component dùng chung)
├── entry.tsx         — UI-S-001 · Cổng vào (+ WeHeader, WeCrest)
├── waiting.tsx       — UI-S-002 · Phòng chờ
├── exam.tsx          — UI-S-003 · Làm bài (+ SyncTimer)
├── loading.tsx       — UI-S-004 · Chờ chấm bài
├── leaderboard.tsx   — UI-S-005 · Vinh danh
├── result.tsx        — UI-S-006 · Kết quả cá nhân
└── closed.tsx        — UI-S-007 · Đã kết thúc
```

Tất cả component là **presentational** — state/realtime (socket.io, time-sync, chấm điểm,
xếp hạng) do consumer quản lý và truyền vào qua props, đúng theo các Flow `FLOW-*` và
Socket event `SOCK-EVT-*` trong tài liệu.

---

## Bản đồ component ↔ mã định danh

### Màn hình (Screen)

| Screen | Component | Selector | File | Realtime chính |
|---|---|---|---|---|
| `UI-S-001` | `EventEntry` | `[data-scr="UI-S-001"]` | `entry.tsx` | DATA-R-006 state · FLOW-003 |
| `UI-S-002` | `WaitingRoom` | `[data-scr="UI-S-002"]` | `waiting.tsx` | S01/S02/S03/S09 · FLOW-004 |
| `UI-S-003` | `ExamScreen` | `[data-scr="UI-S-003"]` | `exam.tsx` | S03/S04/S05/S09/S10/S11 · FLOW-005/006/007 |
| `UI-S-004` | `SubmissionLoading` | `[data-scr="UI-S-004"]` | `loading.tsx` | chờ S06/S07 · FLOW-008/009 |
| `UI-S-005` | `LeaderboardScreen` | `[data-scr="UI-S-005"]` | `leaderboard.tsx` | S06/S07 · FLOW-010 |
| `UI-S-006` | `PersonalResultScreen` | `[data-scr="UI-S-006"]` | `result.tsx` | DATA-M-006 |
| `UI-S-007` | `EventClosedScreen` | `[data-scr="UI-S-007"]` | `closed.tsx` | route bởi S08 |

### Component dùng chung (Reusable)

| UI ID | Component | Selector | Mô tả |
|---|---|---|---|
| `UI-C-001` | `CountdownTimer` | `[data-ui="UI-C-001"]` | Đếm ngược, đồng bộ server-time qua `skewMs` (SOCK-EVT-S09). `layout="block"\|"inline"`. |
| `UI-C-002` | `OnlineCounter` | `[data-ui="UI-C-002"]` | Số HS trong phòng — cập nhật qua `count` (SOCK-EVT-S02). |
| `UI-C-003` | `QuestionCard` | `[data-ui="UI-C-003"]` | Câu hỏi + 4 đáp án (đã trộn từ server). KHÔNG nhận `correctKey` lúc làm bài. |
| `UI-C-004` | `ProgressBar` | `[data-ui="UI-C-004"]` | Đã trả lời X/total — tăng khi nhận `SOCK-EVT-S05` ack. |
| `UI-C-005` | `ConnectionStatus` | `[data-ui="UI-C-005"]` | `connected` (xanh) / `reconnecting` (cam) / `disconnected` (đỏ). |
| `UI-C-006` | `LeaderboardRow` | `[data-ui="UI-C-006"]` | Avatar, tên, số câu đúng, thời gian, hạng. |
| `UI-C-007` | `PersonalStatsCard` | `[data-ui="UI-C-007"]` | Đúng / Sai / Bỏ qua / Điểm / Hạng / Thời gian. |
| `UI-C-008` | `GradeRoomBadge` | `[data-ui="UI-C-008"]` | Nhãn "Phòng Khối X" (màu theo khối). |
| `UI-C-009` | `AutoResumeNotification` | `[data-ui="UI-C-009"]` | Toast "Đã khôi phục bài làm" — trigger khi nhận `SOCK-EVT-S04`. |
| `UI-C-010` | `DisconnectWarningModal` | `[data-ui="UI-C-010"]` | Banner KHÔNG chặn input — vẫn cho làm bài offline, replay khi reconnect. |

Thành phần phụ (không có UI ID riêng): `SyncTimer` (đồng hồ đồng bộ câu, trong `exam.tsx`),
`WeHeader` / `WeCrest` (header dùng chung, trong `entry.tsx`).

---

## Lưu ý thiết kế quan trọng

### Đề ĐỒNG BỘ (lockstep), không có "Câu trước / Câu sau"
Theo chốt nghiệp vụ: câu hỏi xuất hiện **đồng bộ cho cả phòng**, mỗi câu giới hạn `perQuestionSec`
giây rồi **tự chuyển** sang câu kế — học sinh **không** điều hướng tới/lui. Vì vậy:

- `ExamScreen` không có nút Prev/Next; chỉ có `SyncTimer` đếm ngược câu hiện tại.
- Khi hết giờ câu → set `locked` để khoá lựa chọn, chờ server đồng bộ câu sau.
- `index` / `question` / `options` do consumer đẩy theo `SOCK-EVT-S03` (đề per-student đã trộn).

### Anti-cheat
`QuestionCard` **không** nhận `correctKey` ở chế độ làm bài — chỉ hiển thị đáp án đang chọn
(`is-selected`) + tick "đã lưu" khi nhận ack. Việc tô đúng/sai (`reveal` + `correct`) chỉ dùng
ở màn **Xem lại đáp án** (nếu config cho phép). Mọi chấm điểm tập trung ở backend (`FLOW-008`).

### Đồng bộ thời gian
`CountdownTimer` nhận `skewMs = serverTime − clientTime` (tính từ `SOCK-EVT-S09`). Component
render theo `serverNow = Date.now() + skewMs`, **không** tin client clock thuần.

```tsx
<CountdownTimer to={startAtMs} skewMs={clockSkew} label="Phát đề sau" urgentBelowSec={60} />
```

---

## Ví dụ sử dụng

### Phòng chờ (UI-S-002)
```tsx
<WaitingRoom
  weeklyTitle="Đấu Trường Số 47: Thử Thách Hình Học"
  grade={5}
  onlineCount={online}                 // SOCK-EVT-S02
  startAt={examStartAtMs} skewMs={skew} // SOCK-EVT-S03 / S09
  faces={crowdFaces}
/>
```

### Làm bài (UI-S-003)
```tsx
<ExamScreen
  grade={5}
  index={qi + 1} total={25}
  question={q.stem} options={q.options}   // đã trộn từ server (không có correctKey)
  answeredCount={answered}
  selected={selected} saved={savedAck}    // saved = đã nhận SOCK-EVT-S05
  remaining={remaining} perQuestionSec={20}
  locked={remaining <= 0}
  conn={connState}                        // UI-C-005
  showDisconnect={connState !== 'connected'}  // UI-C-010
  resume={justResumed ? { remainingMin: 12, restoredCount: 8 } : null} // UI-C-009
  onSelect={(key) => emit('answer:submit', { questionId: q.id, key })} // SOCK-EVT-C02
/>
```

### Vinh danh (UI-S-005)
```tsx
<LeaderboardScreen
  grade={5} weeklyTitle="Đấu Trường Số 47"
  entries={sortedTopN}     // DATA-M-007, rank tăng dần (consumer sắp sẵn)
  total={25}
  me={myResult}            // ghim PersonalStatsCard ở đáy; null nếu không có
/>
```

`LeaderboardEntry`:
```ts
{ rank, displayName, className?, avatar?, avatarBg?, correctCount, totalTimeMs, isMe? }
```

---

## Tokens riêng (`weeklyevent.css`)

Lớp theme thêm biến `--we-*` (đặt cạnh tokens gốc):

- **Stage**: `--we-stage-1/2/3` (midnight), `--we-panel`, `--we-line`
- **Accent**: `--we-accent` (= `--o-500`), `--we-accent-2`, `--we-glow`, `--we-gold`/`--we-gold-2`
- **Connection**: `--we-ok` / `--we-warn` / `--we-bad`

---

## Xem preview

Mở **`Sự kiện tuần.html`** (ở project root). Hai tab:
- **Luồng demo** bấm được: Cổng → Phòng chờ → Làm bài (lockstep) → Chờ chấm → Vinh danh → Kết quả → Đóng.
- **Thư viện component**: từng component + các trạng thái cạnh nhau (gồm cả realtime/edge-case
  có nút giả lập: connection, mất kết nối, khôi phục bài).

> File `_bundle-weeklyevent.tsx` ở thư mục cha **chỉ phục vụ preview** (mirror `weeklyevent/*.tsx`
> đã strip import/export để chạy bằng Babel standalone). Khi đưa vào project React thật, **import
> trực tiếp** các file `.tsx` trong folder này — không cần bundle.
