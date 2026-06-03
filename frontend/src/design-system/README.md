# Uniclass · Game so tài — React Design System (TypeScript)

Bộ component **React + TypeScript** xuất từ `Design System.html` (v1.0).
Không phụ thuộc thư viện UI nào (không Tailwind, không Bootstrap), chỉ cần React 18+.

## Cài đặt vào project React

1. Copy nguyên folder `react-design-system/` vào `src/`.
2. Trong file root (vd. `App.tsx` hoặc `main.tsx`), import 1 lần:

```tsx
import { IconSprites } from './react-design-system';

export default function App() {
  return (
    <>
      <IconSprites />  {/* mount once để các SVG icon hoạt động */}
      {/* ...phần còn lại của app */}
    </>
  );
}
```

> `IconSprites` đặt 1 lần duy nhất ở root (hoặc trong layout dùng chung). Nó render `<svg>` invisible chứa các `<symbol>` + `<linearGradient>` mà các icon component dùng qua `<use>`.

3. Import component bạn cần — đầy đủ TypeScript autocomplete:

```tsx
import {
  // App UI
  Button, Input, Field, CheckboxRow, Tabs, Badge, Card, Avatar,
  AppList, AppListItem, Toast, Modal,

  // Game UI
  GameCanvas, WoodPanel, Banner, Sign, Stamp, Speech, AvatarFrame,
  GameButton, GamePill, Slot, SlotGrid, GroupBoard, Streak,
  Chat, ChatMessage, MapCanvas, MapPath, MapNode, Cactus, TreasurePopup,
  MatchmakingPanel,

  // Icons
  StarIcon, CoinIcon, FlameIcon, TrophyIcon, ChestIcon,
  CheckIcon, LockIcon, SparkIcon, SendIcon, ChatIcon,

  // Types (nếu bạn cần extend props)
  type ButtonVariant, type GameButtonColor, type SlotState, type MapNodeState,
  type MatchmakingState, type MatchmakingPlayer,
} from './react-design-system';
```

## Cấu trúc

```
react-design-system/
├── index.css       — toàn bộ CSS variables, font, App + Game styles
├── index.tsx       — barrel re-export
├── icons.tsx       — IconSprites + 10 icon SVG (Star, Coin, Flame…)
├── app.tsx         — App UI components (Button, Input, Card…)
├── game.tsx        — Game UI components (Banner, GameButton, MapCanvas…)
├── games/          — Mini-games (Caro · Lật thẻ · HUD · Overlay)
│   ├── games.css   — CSS riêng cho mini-games (animation, layouts)
│   ├── caro.tsx    — CaroBoard, CaroCell, CaroX, CaroO, WinLine
│   ├── memory.tsx  — MemoryBoard, MemoryCard (3D flip)
│   ├── gameHud.tsx — GameHud, PlayerCard, Timer, HintButton, TurnIndicator
│   ├── overlay.tsx — GameStateOverlay (win/lose/draw)
│   └── index.tsx
├── css.d.ts        — ambient module để TS chấp nhận `import './index.css'`
├── tsconfig.json   — cấu hình TS tham khảo (target ES2020, strict)
├── demo.html       — preview chạy độc lập bằng Babel standalone
└── README.md
```

## Các bộ type chính

| Type | Giá trị | Dùng cho |
|---|---|---|
| `ButtonVariant` | `'primary' \| 'secondary' \| 'ghost' \| 'danger' \| 'disabled'` | `<Button>` |
| `ButtonSize` | `'sm' \| 'md' \| 'lg'` | `<Button>` |
| `BadgeTone` | `'neutral' \| 'brand' \| 'success' \| 'warning' \| 'danger' \| 'info'` | `<Badge>` |
| `GameButtonColor` | `'orange' \| 'green' \| 'blue' \| 'red' \| 'ghost'` | `<GameButton>` |
| `GamePillTone` | `'gold' \| 'green' \| 'red' \| 'blue'` | `<GamePill>` |
| `SlotState` | `'empty' \| 'filled' \| 'done' \| 'inviting'` | `<Slot>` |
| `MapNodeState` | `'done' \| 'current' \| 'locked' \| 'upcoming'` | `<MapNode>` |
| `ToastTone` | `'success' \| 'warning'` | `<Toast>` |

Mọi component đều extend HTML-attribute interface của element gốc (ví dụ `ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>`), nên bạn pass `onClick`, `id`, `aria-*`, v.v. tự do.

## Ví dụ sử dụng

### Button (App UI)
```tsx
<Button variant="primary">Bắt đầu so tài</Button>
<Button variant="secondary">Xem lại bài</Button>
<Button variant="danger" size="sm" onClick={() => leave()}>Xoá lớp</Button>
```

### Game button + pill
```tsx
<GameButton color="green" size="lg" icon={<StarIcon size={22} />}>
  Sao chép link
</GameButton>

<GamePill icon={<StarIcon size={20} />}>1.250 sao</GamePill>
<GamePill tone="green" icon={<CheckIcon size={16} color="#fff" />}>5/5 bạn</GamePill>
```

### Banner treo thừng
```tsx
<Banner>THẢO LUẬN NHÓM</Banner>
<Banner size="sm">TIÊU ĐỀ</Banner>
<Banner variant="cream" rope={false}>RÚ BẠN CÙNG HỌC</Banner>
```

### Map hành trình
```tsx
<MapCanvas>
  <MapPath d="M 64 238 Q 132 80 200 102 T 360 177 T 520 245 T 680 102" />
  <MapNode left={8}  top={70} state="done" />
  <MapNode left={25} top={30} state="done" />
  <MapNode left={45} top={52} state="current" label="3" />
  <MapNode left={65} top={72} state="locked" />
  <MapNode left={85} top={30} state="locked" />
  <Cactus left={17} />
  <Cactus left={36} />
  <Cactus left={56} />
  <Cactus left={76} />
</MapCanvas>
```

> Path coordinates dùng viewBox **800 × 340**. Tọa độ node trong `d=` là `(left% × 8, top% × 3.4)`.

### Group board + slots
```tsx
<GroupBoard>
  <SlotGrid>
    <Slot state="filled" avatar="T" name="Thanh" />
    <Slot state="empty"  avatar="" name="..." />
    <Slot state="done"   avatar="L" name="Loan" />
    <Slot state="filled" avatar="M" name="Minh" />
  </SlotGrid>
</GroupBoard>
```

### Streak bar
```tsx
<Streak value={6} total={10} />
```

### Treasure popup
```tsx
import type { TreasureReward } from './react-design-system';

const rewards: TreasureReward[] = [
  { emoji: '🧸', name: 'Gấu bông', desc: 'Mời 3 bạn', unlocked: true },
  { emoji: '⌚',  name: 'Đồng hồ',  desc: 'Mời 5 bạn' },
  { emoji: '📱', name: 'Máy tính bảng', desc: 'Mời 10 bạn' },
];

<TreasurePopup
  ribbon="PHẦN THƯỞNG MỚI"
  title="NHẬN QUÀ SIÊU ĐỘC"
  subtitle="Rủ đủ 5 bạn cùng học để mở khoá phần thưởng"
  rewards={rewards}
  actions={
    <>
      <GameButton>Sao chép link mời</GameButton>
      <GameButton color="ghost">Để sau</GameButton>
    </>
  }
/>
```

### Chat
```tsx
<Chat onSend={(msg) => console.log(msg)}>
  <ChatMessage who="Khôi">Mọi người ơi!</ChatMessage>
  <ChatMessage who="Loan">Mình vào rồi nha</ChatMessage>
</Chat>
```

### Matchmaking panel
Panel hiển thị quá trình ghép trận — 2 trạng thái `'searching'` (đếm ngược + halo + dots) / `'found'` (avatar đối thủ slide vào + VS + sparkles).

```tsx
import { MatchmakingPanel, GameButton, StarIcon } from './react-design-system';

function Matchmaking() {
  const [state, setState] = React.useState<'searching' | 'found'>('searching');
  const [seconds, setSeconds] = React.useState(30);

  React.useEffect(() => {
    if (state !== 'searching') return;
    if (seconds <= 0) { setState('found'); return; }
    const t = setTimeout(() => setSeconds(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [state, seconds]);

  return (
    <MatchmakingPanel
      state={state}
      secondsRemaining={seconds}
      totalSeconds={30}
      me={{
        name: 'Minh Khôi', avatar: 'MK',
        avatarBg: 'linear-gradient(135deg,#ffb24a,#e8530e)',
        level: 12, sublabel: '1.250 ⭐',
      }}
      opponent={{
        name: 'Thuỳ Linh', avatar: 'TL',
        avatarBg: 'linear-gradient(135deg,#a3c4ff,#3a6df0)',
        level: 14, sublabel: '1.480 ⭐',
      }}
      actions={
        state === 'searching'
          ? <GameButton color="ghost" onClick={() => setState('found')}>Huỷ</GameButton>
          : <GameButton color="green" icon={<StarIcon size={20}/>}>Vào trận ngay</GameButton>
      }
    />
  );
}
```

**Props chính:**

| Prop | Type | Mô tả |
|---|---|---|
| `state` | `'searching' \| 'found'` | Trạng thái. Mặc định `'searching'`. |
| `me` | `MatchmakingPlayer` | Người chơi hiện tại (bắt buộc). |
| `opponent` | `MatchmakingPlayer` | Đối thủ — dùng khi `state='found'`. |
| `secondsRemaining` | `number` | Giây còn lại trong countdown. |
| `totalSeconds` | `number` | Tổng giây — vẽ progress ring. Mặc định `30`. |
| `searchingTitle` / `foundTitle` | `ReactNode` | Override text mặc định. |
| `actions` | `ReactNode` | Nút bên dưới (vd. Huỷ / Vào trận). |
| `sparkles` | `boolean` | Confetti khi found. Mặc định `true`. |

Ring tự đổi màu khi countdown thấp: ≤10s → vàng, ≤5s → đỏ + pulse.

`MatchmakingPlayer`:
```ts
{
  name: string;
  avatar?: ReactNode;     // text/emoji/<img>. Mặc định = name[0]
  avatarBg?: string;      // CSS background gradient
  level?: ReactNode;      // badge ở góc avatar
  sublabel?: ReactNode;   // dòng phụ dưới name (vd. "1.250 ⭐")
}
```

## Tokens

Toàn bộ CSS variables được định nghĩa trong `index.css`. Truy cập từ bất kỳ component nào:

```css
.my-component {
  color: var(--o-500);          /* brand orange */
  background: var(--g-wood-1);  /* wood light */
  border-radius: var(--r-md);
  box-shadow: var(--sh-2);
}
```

Hệ thống token:

- **Color**: `--o-50` → `--o-900` (brand), `--ink-0` → `--ink-900` (neutral), `--success`/`--warning`/`--danger`/`--info`, `--g-*` (game palette)
- **Spacing**: `--s-1` (4px) → `--s-16` (64px), step 4pt
- **Radius**: `--r-xs` → `--r-xl`, `--r-pill`
- **Shadow**: `--sh-1` (hairline), `--sh-2` (card), `--sh-3` (modal), `--sh-game` (chunky 3D)
- **Font**: `--f-app` (SF Pro), `--f-game` (Nunito)

## TypeScript config

Folder kèm sẵn `tsconfig.json` (target ES2020, strict, react-jsx). Nếu project bạn đã có config riêng, cứ giữ nó — config trong folder này chỉ dùng tham khảo.

Đảm bảo `css.d.ts` được TypeScript pick up (mặc định mọi `.d.ts` trong project sẽ được include). Nếu bị bỏ qua, thêm vào `tsconfig.json`:

```json
{
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.d.ts"]
}
```

## Xem preview

Mở `demo.html` trong browser — file độc lập, không cần build, dùng Babel standalone (preset `typescript,react`) để chạy TSX trực tiếp.

---

## Mini-games

Folder `games/` chứa 2 mini-game: **Cờ caro** và **Lật thẻ**, kèm bộ HUD chung và overlay kết quả.
Tất cả components đều **presentational** — logic chơi (turn-taking, matching, win detection) do consumer quản lý qua state.

### Caro

```tsx
import {
  CaroBoard,
  makeCaroCells,
  type CaroValue,
  type CaroWinInfo,
} from './react-design-system';

function CaroGame() {
  const [cells, setCells] = React.useState<CaroValue[][]>(() => makeCaroCells(5));
  const [turn, setTurn] = React.useState<'X' | 'O'>('X');
  const [last, setLast] = React.useState<[number, number] | null>(null);
  const [win, setWin] = React.useState<CaroWinInfo | null>(null);

  const place = (r: number, c: number) => {
    if (cells[r][c] || win) return;
    const next = cells.map((row, ri) => row.map((v, ci) =>
      ri === r && ci === c ? turn : v
    ));
    setCells(next);
    setLast([r, c]);
    setTurn(turn === 'X' ? 'O' : 'X');
    // ...tự check win + call setWin(...)
  };

  return (
    <CaroBoard
      cells={cells}
      lastMove={last}
      win={win}
      disabled={!!win}
      onCellClick={place}
    />
  );
}
```

**Props chính của `CaroBoard`:**

| Prop | Type | Mặc định | Mô tả |
|---|---|---|---|
| `cells` | `CaroValue[][]` | (bắt buộc) | Ma trận `size × size`. Mỗi ô = `'X'` / `'O'` / `null`. |
| `lastMove` | `[row, col] \| null` | `null` | Toạ độ nước cuối — hiển thị chấm cam ở góc ô. |
| `win` | `CaroWinInfo \| null` | `null` | Đường thắng + danh sách ô highlight. Tự kẻ line. |
| `disabled` | `boolean` | `false` | Disable toàn bộ board (vd. khi đã có winner). |
| `onCellClick` | `(r, c) => void` | — | Callback khi click ô trống. |

`CaroBoard` tự động chọn `--cell` size theo prop `cells.length`: 3 → 92px, 5 → 64px, 10 → 44px, 15 → 32px, 20 → 26px. Custom: override CSS variable `--cell` bằng inline style.

### Lật thẻ (Memory)

```tsx
import {
  MemoryBoard,
  makeMemoryDeck,
  type MemoryCardData,
  type MemoryCardState,
} from './react-design-system';

function MemoryGame() {
  // Khởi tạo deck shuffle
  const [deck, setDeck] = React.useState(() =>
    makeMemoryDeck([
      { content: '🐱', type: 'text' },
      { content: '🐶', type: 'text' },
      { content: '#e8530e', type: 'color' },
      { content: '#2bb673', type: 'color' },
      // ...thêm bao nhiêu cặp cũng được
    ])
  );
  const [states, setStates] = React.useState<Record<string, MemoryCardState>>({});

  const cards = deck.map(c => ({ ...c, state: states[c.id] ?? 'hidden' as const }));

  return (
    <MemoryBoard
      cards={cards}
      columns={4}
      onCardClick={(id) => {
        // logic flip + match...
      }}
    />
  );
}
```

**`MemoryCardData`:**
```ts
{
  id: string;                  // unique
  pairId: string;              // 2 thẻ cùng pairId thì match
  type?: 'text' | 'color' | 'image' | 'custom';
  content: string | ReactNode; // theo type
}
```

**`type` quyết định render:**
- `'text'` — render `content` thẳng vào front (chữ/số/emoji với Nunito 900)
- `'color'` — `content` = CSS color, fill toàn bộ front face
- `'image'` — `content` = URL, hiển thị `<img>` 80%
- `'custom'` — `content` = ReactNode tuỳ ý

`MEMORY_LEVELS` preset cho `pairs` + `columns`:
```ts
MEMORY_LEVELS.easy   // { pairs: 6,  columns: 4 }
MEMORY_LEVELS.medium // { pairs: 8,  columns: 4 }
MEMORY_LEVELS.hard   // { pairs: 10, columns: 5 }
MEMORY_LEVELS.expert // { pairs: 12, columns: 6 }
```

### GameHud — HUD dùng chung

```tsx
import { GameHud, Timer, TurnIndicator, HintButton } from './react-design-system';

<GameHud
  playerA={{
    name: 'Minh Khôi', mark: 'X',
    score: 1250, streak: 3,
    active: true,                                      // đang đến lượt → glow
    avatarBg: 'linear-gradient(135deg,#ffb24a,#e8530e)',
  }}
  playerB={{ name: 'Thuỳ Linh', mark: 'O', score: 980 }}
  center={
    <>
      <Timer seconds={18} total={30} />
      <TurnIndicator>Lượt của Khôi</TurnIndicator>
      <HintButton cost={20} remaining={2} onClick={giveHint} />
    </>
  }
/>
```

`<Timer>` tự đổi sang `warning` (≤10s) rồi `danger` (≤5s, pulse). Pass `total` để hiện progress ring; nếu `total >= 60` label sẽ là `M:SS`.

### Game state overlay

```tsx
<GameStateOverlay
  state="win"   // win | lose | draw | idle
  stats={[
    { label: 'Thời gian', value: '1:23' },
    { label: 'Sao thưởng', value: '+250' },
    { label: 'Chuỗi', value: '🔥 3' },
  ]}
  actions={
    <>
      <GameButton onClick={replay}>Chơi lại</GameButton>
      <GameButton color="ghost" onClick={leave}>Rời</GameButton>
    </>
  }
/>
```

- `win` → tone vàng + crown trophy + confetti tự rơi
- `lose` → tone xám-be, không confetti
- `draw` → tone xanh
- `idle` → tone giấy, "SẴN SÀNG CHƯA?"

Title + subtitle có default tiếng Việt; override bằng prop `title` / `subtitle`.

### Animations

Tất cả animation chạy bằng CSS thuần (no JS):

| Animation | Trigger | Thời lượng |
|---|---|---|
| X/O draw stroke | Mount cell `value` | 0.35s / 0.45s |
| Win-line draw | Mount `<CaroWinLine>` | 0.6s (delay 0.15s) |
| Winning cell pulse | `cell.win === true` | 1.2s loop |
| Memory card flip | `state === 'revealed' \| 'matched'` | 0.5s 3D |
| Matched card bounce | `state === 'matched'` | 0.5s |
| Player card glow | `active === true` | 1.6s loop |
| Timer danger pulse | `seconds <= 5` | 0.8s loop |
| Overlay confetti | `state === 'win'` | 2.2s loop, 28 mảnh |

Tôn trọng `prefers-reduced-motion`? Chưa — nếu cần, wrap toàn bộ keyframes trong `@media (prefers-reduced-motion: no-preference) { ... }`.
