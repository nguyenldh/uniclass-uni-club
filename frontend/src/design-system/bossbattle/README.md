# Uniclass · Săn Boss — React Component Package

Bộ component **React + TypeScript** cho tính năng **Săn Boss (Boss Battle tuần)**, tách rời theo
tài liệu giải pháp (`SanBoss_Solution_Doc.md`). Xây trên design system Uniclass (`react-design-system/`):
font Nunito, palette cam brand `#e8530e`, tokens `--g-*` — phủ thêm một lớp theme **"hang boss" tối / sử thi**.

> Mỗi screen & component đều **gắn sẵn mã định danh** từ tài liệu vào DOM qua thuộc tính
> `data-scr="SCR-xx"` (màn hình) và `data-ui="UI-xxx"` (thành phần). Tra cứu trực tiếp trong DevTools:
> `document.querySelector('[data-ui="UI-101"]')`.

---

## Phụ thuộc

Folder `bossbattle/` **không tự đứng độc lập hoàn toàn** — nó dùng lại building block của design system gốc:

| Cần | Lấy từ |
|---|---|
| `GameButton`, `GamePill` | `../game` |
| `FlameIcon`, `LockIcon`, `CheckIcon`, `TrophyIcon`, `IconSprites` | `../icons` |
| Tokens (`--g-*`, `--o-*`, `--f-game`, `--success`…) | `../index.css` |

Vì vậy khi copy sang project khác, hãy mang theo cả `react-design-system/` (hoặc tối thiểu
`game.tsx`, `icons.tsx`, `index.css`). `IconSprites` phải được mount **1 lần** ở root.

```tsx
import { IconSprites } from './react-design-system';
import {
  BossLobby, BossBattle, BossResult, BossLeaderboard, BossHonor,
} from './react-design-system/bossbattle';

export default function App() {
  return (
    <>
      <IconSprites />               {/* mount 1 lần */}
      <BossLobby /* … */ />
    </>
  );
}
```

---

## Cấu trúc

```
bossbattle/
├── bossbattle.css   — toàn bộ style (.bb-* namespace, theme hang boss tối)
├── index.tsx        — barrel re-export
├── lobby.tsx        — SCR-01 · Sảnh Săn Boss
├── battle.tsx       — SCR-02 · Chiến đấu / Câu hỏi
├── result.tsx       — SCR-03 · Kết quả lượt ngày
├── leaderboard.tsx  — SCR-04 · Bảng xếp hạng
└── honor.tsx        — SCR-05 · Vinh danh & phần thưởng
```

Tất cả component là **presentational** — state/logic (chấm điểm, đếm giờ, cộng dồn HP, xếp hạng) do
consumer quản lý và truyền vào qua props, đúng theo các Flow `FLW-01…08` trong tài liệu.

---

## Bản đồ component ↔ mã định danh

### SCR-01 · `<BossLobby>` — Sảnh Săn Boss (`lobby.tsx`)
Root: `[data-scr="SCR-01"]`

| UI ID | Component | Selector | Mô tả |
|---|---|---|---|
| `UI-101` | `BossDisplay` | `[data-ui="UI-101"]` | Ảnh Boss đổi theo % HP còn lại (CFG-08). |
| `UI-102` | `BossHpBar` | `[data-ui="UI-102"]` | Thanh máu Boss (drain) + % tiến độ khối. |
| `UI-103` | `DailyQuotaBadge` | `[data-ui="UI-103"]` | "Câu hỏi hôm nay x/5" (CFG-02). |
| `UI-104` | `WeeklyCountdown` | `[data-ui="UI-104"]` | Đếm ngược tới 00h00 Thứ Hai kế. |
| `UI-105` | `BattleCTA` | `[data-ui="UI-105"]` | Nút Chiến đấu · 3 trạng thái. |
| `UI-106` | `BossNameLabel` | `[data-ui="UI-106"]` | Tên Boss tuần (CFG-07). |

`<BossLobby>` gom toàn bộ; cũng có thể dùng từng mảnh rời.

```tsx
<BossLobby
  bossName="Hắc Long Tri Thức"
  hpPercent={40}                 // % HP CÒN LẠI (progressPercent = 100 − hpPercent)
  states={DEFAULT_BOSS_STATES}   // CFG-08 — số mốc tuỳ biến (xem dưới)
  dailyDone={2} dailyTotal={5}   // DM-04
  ctaStatus="ready"              // 'ready' | 'completed' | 'defeated'  (UI-105 / FLW-04)
  resetAt={mondayMs}             // mặc định = 00h Thứ Hai kế
  grade="Khối 4"
  onBattle={() => goBattle()}
/>
```

### SCR-02 · `<BossBattle>` — Chiến đấu (`battle.tsx`)
Root: `[data-scr="SCR-02"]`

| UI ID | Component | Selector | Mô tả |
|---|---|---|---|
| `UI-201` | `BattleQuestionCard` | `[data-ui="UI-201"]` | Đề bài + ảnh (DM-06). |
| `UI-202` | `AnswerGrid` | `[data-ui="UI-202"]` | Lưới đáp án trắc nghiệm, kiểu Kahoot. |
| `UI-203` | `QuestionTimer` | `[data-ui="UI-203"]` | Đồng hồ/câu, trần = `timeLimit` (CFG-05). |
| `UI-204` | `QuestionIndex` | `[data-ui="UI-204"]` | "Câu i/5" + pips trạng thái. |

`BossStrip` (máu boss + mặt boss nhận đòn) là phần phụ ở đầu màn, không có UI ID riêng.

```tsx
<BossBattle
  bossName="Hắc Long Tri Thức" bossHpPercent={hp}
  index={qi + 1} total={5} pips={pips}
  remaining={remaining} timeLimit={30}
  question={q.content} image={q.image}
  options={[{key:'A',label:'…'}, …]}
  phase={phase}                  // 'answering' | 'revealing'
  selected={selected} correct={phase==='revealing' ? q.correct : null}
  onSelect={key => grade(key)}   // FLW-05 chấm ở backend, đây chỉ truyền kết quả vào
  lastDamage={pts} bossHit={hit}
/>
```

### SCR-03 · `<BossResult>` — Kết quả (`result.tsx`)
Root: `[data-scr="SCR-03"]`

| UI ID | Component | Selector | Mô tả |
|---|---|---|---|
| `UI-301` | `ResultStat` (Câu đúng) | `[data-ui="UI-301"]` | DM-04.correctCount. |
| `UI-302` | `ResultStat` (Tổng thời gian) | `[data-ui="UI-302"]` | DM-04.totalResponseTime. |
| `UI-303` | `ResultStat` (Điểm đóng góp) | `[data-ui="UI-303"]` | DM-04.pointsEarned (gồm speed bonus). |
| `UI-304` | `BossDamageRecap` | `[data-ui="UI-304"]` | Hiệu ứng máu Boss tụt sau lượt (DM-02). |
| `UI-305` | nút Xem BXH | `[data-ui="UI-305"]` | Điều hướng SCR-04. |

`bossDefeated` → màn ăn mừng "HẠ GỤC BOSS!" (FLW-06: HP về 0% → khoá lượt cả tuần).

### SCR-04 · `<BossLeaderboard>` — Bảng xếp hạng (`leaderboard.tsx`)
Root: `[data-scr="SCR-04"]`

| UI ID | Component | Selector | Mô tả |
|---|---|---|---|
| `UI-401` | `Podium` | `[data-ui="UI-401"]` | Bục Top 3, vương miện Vàng/Bạc/Đồng. |
| `UI-402` | `RankList` | `[data-ui="UI-402"]` | Danh sách cuộn được (rank 4+). |
| `UI-403` | `MyRankCard` | `[data-ui="UI-403"]` | Thẻ cá nhân ghim đáy; có trạng thái "Chưa xếp hạng". |

> Phân vùng BXH theo khối **do backend trả về** (không có UI lọc khối). Thứ tự xếp hạng theo
> `correctCount` ↓ → `totalCorrectTimeSec` ↑ → `lastAchievedAt` ↑ (FLW-07) — consumer sắp sẵn rồi truyền vào `entries`.

```tsx
<BossLeaderboard
  entries={sortedEntries}        // DM-08, rank tăng dần
  myEntry={myEntry /* hoặc null */}
  questionsPerWeek={35}          // CFG-02b — mẫu số "x/35 câu"
  grade="Khối 4"
/>
```

### SCR-05 · `<BossHonor>` — Vinh danh (`honor.tsx`)
Root: `[data-scr="SCR-05"]`

| UI ID | Component | Selector | Mô tả |
|---|---|---|---|
| `UI-501` | `HonorBannerCarousel` | `[data-ui="UI-501"]` | Banner luân phiên Top 10 (DM-09). |
| `UI-502` | `WeeklyAvatarFrame` | `[data-ui="UI-502"]` | Khung "Dũng sĩ diệt Boss", hiệu lực 7 ngày. |
| `UI-503` | `HonorHallPodium` | `[data-ui="UI-503"]` | Bục vinh danh Top 3 (dùng lại `Podium`). |

---

## Trạng thái Boss (CFG-08) — số mốc TUỲ BIẾN

`BossDisplay` / `BossHpBar` nhận một mảng `states: BossState[]` bất kỳ — **không cố định 3 mốc**.

```ts
interface BossState {
  min: number;        // HP còn lại tối thiểu (%)
  max: number;        // HP còn lại tối đa (%)
  label: ReactNode;   // nhãn hiển thị, vd "HUNG HÃN"
  tone: 'normal' | 'injured' | 'rage' | 'defeated';  // khoá màu/hiệu ứng
  img?: string;       // URL ảnh boss cho mốc này (production)
  glyph?: string;     // emoji fallback khi chưa có ảnh
}
```

Mặc định `DEFAULT_BOSS_STATES` có 4 mốc (normal / injured / rage / defeated). Muốn 5 mốc thì truyền 5 phần tử:

```tsx
const FIVE = [
  { min:81, max:100, label:'NGỦ YÊN',   tone:'normal',   img:'/boss/sleep.png' },
  { min:61, max:80,  label:'THỨC GIẤC', tone:'normal',   img:'/boss/awake.png' },
  { min:31, max:60,  label:'BỊ THƯƠNG', tone:'injured',  img:'/boss/hurt.png' },
  { min:1,  max:30,  label:'CUỒNG NỘ',  tone:'rage',     img:'/boss/rage.png' },
  { min:0,  max:0,   label:'GỤC NGÃ',   tone:'defeated', img:'/boss/dead.png' },
];
<BossDisplay hpPercent={hp} states={FIVE} />
```

Helper `bossStateFor(hpPercent, states)` suy ra mốc hiện tại từ % HP còn lại.

**Ảnh Boss:** truyền `img` trong mỗi `BossState` (hoặc prop `art={<…/>}` để chèn lớp tuỳ ý). Khi
chưa có ảnh, component vẽ **placeholder sọc có nhãn** ghi rõ state + dải HP để đội art biết cần bỏ ảnh gì vào.

---

## Tokens riêng (`bossbattle.css`)

Lớp theme thêm các biến `--bb-*` (đặt cạnh tokens gốc):

- **Máu Boss**: `--bb-hp-1/2/3` (đỏ → ember)
- **Hắc Long**: `--bb-arcane-1/2/3` (tím arcane), `--bb-cyan` (hơi rồng)
- **Nền hang**: `--bb-void-1/2/3`
- **Vinh danh**: `--bb-gold` / `--bb-silver` / `--bb-bronze`

---

## Xem preview

Mở **`Săn Boss.html`** (ở project root). Hai tab:
- **Luồng demo** bấm được: Sảnh → Chiến đấu (5 câu) → Kết quả → BXH → Vinh danh.
- **Thư viện component**: từng component + các trạng thái cạnh nhau.

> File `_bundle-bossbattle.tsx` ở thư mục cha **chỉ phục vụ preview** (mirror `bossbattle/*.tsx` đã
> strip import/export để chạy bằng Babel standalone). Khi đưa vào project React thật, **import trực tiếp
> các file `.tsx`** trong folder này — không cần bundle.
