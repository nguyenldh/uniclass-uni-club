# AGENTS.md — Sự kiện tuần (weeklyevent/)

Hướng dẫn cho coding agent dùng bộ component này. Đọc hết trước khi viết code.
Tất cả component **presentational, không có state nội bộ về nghiệp vụ** — bạn (consumer)
giữ state và truyền xuống qua props. KHÔNG sửa file trong `weeklyevent/` hay core; chỉ import.

## Import map (đường dẫn chính xác)

```ts
// CSS: nạp 1 lần ở root app
import 'react-design-system/index.css';            // tokens + font + nút game (BẮT BUỘC)
// weeklyevent.css đã được weeklyevent/index.tsx tự import.

import { IconSprites } from 'react-design-system/icons';   // mount <IconSprites/> 1 LẦN ở root
import {
  // Screens
  EventEntry, WaitingRoom, ExamScreen, SubmissionLoading,
  LeaderboardScreen, PersonalResultScreen, EventClosedScreen,
  // Reusable
  CountdownTimer, OnlineCounter, QuestionCard, ProgressBar, ConnectionStatus,
  LeaderboardRow, PersonalStatsCard, GradeRoomBadge, AutoResumeNotification,
  DisconnectWarningModal,
  // Phụ trợ
  SyncTimer, WeHeader, WeCrest,
  // Types & helpers
  type AnswerOption, type ConnState, type LeaderboardEntry,
  fmtDuration, gradeColor, initialOf,
} from 'react-design-system/weeklyevent';
```

Bắt buộc: (1) `<IconSprites/>` mount 1 lần; (2) `index.css` nạp ở root. Thiếu (1) → mất icon cúp; thiếu (2) → mất font/màu/nút.

## QUY TẮC — không được vi phạm

1. **Lockstep.** Đề đồng bộ cả phòng. `ExamScreen` KHÔNG có nút Prev/Next và bạn KHÔNG được
   thêm. Chuyển câu do server (`SOCK-EVT-S03`) đẩy `index/question/options` mới. Hết giờ câu →
   set `locked=true`, đừng tự `index+1`.
2. **Anti-cheat.** KHÔNG bao giờ truyền đáp án đúng vào `options` khi đang làm bài. `QuestionCard`
   lúc làm bài không nhận `correct`. Chỉ dùng `reveal + correct` ở màn xem lại đáp án.
3. **Đồng bộ giờ.** Mọi countdown nhận `skewMs = serverTime − clientTime` (từ `SOCK-EVT-S09`).
   Đừng tính giờ bằng `Date.now()` thuần.
4. **Sắp xếp leaderboard ở consumer.** `entries` phải đã sort theo `rank` tăng dần. Component
   không sort.
5. **`to` / `startAt` / `openAt`** là **mốc kết thúc tuyệt đối** (ms epoch hoặc `Date`), KHÔNG
   phải số giây còn lại.

## Chữ ký props (rút gọn, đủ để gọi)

```ts
// UI-S-001
EventEntry: { status:'before-open'|'open'|'in-progress'|'closed'; weeklyTitle:ReactNode;
  grade:number; openAt?:number|Date; nextEventAt?:number|Date; alreadyJoined?:boolean;
  skewMs?:number; onJoin?():void; onResume?():void }

// UI-S-002
WaitingRoom: { weeklyTitle:ReactNode; grade:number; onlineCount:number; startAt:number|Date;
  skewMs?:number; faces?:{name:string;avatarBg?:string}[]; tips?:ReactNode[] }

// UI-S-003  (đề đồng bộ)
ExamScreen: { grade:number; index:number/*1-based*/; total:number; question:ReactNode;
  image?:string; options:AnswerOption[]; answeredCount:number; selected?:string|null;
  saved?:boolean; locked?:boolean; remaining:number; perQuestionSec:number;
  conn?:ConnState; showDisconnect?:boolean;
  resume?:{remainingMin?:number;restoredCount?:number}|null;
  onSelect?(key:'A'|'B'|'C'|'D'):void }

// UI-S-004
SubmissionLoading: { grade:number; announceAt?:ReactNode; title?:ReactNode }

// UI-S-005
LeaderboardScreen: { grade:number; weeklyTitle?:ReactNode; entries:LeaderboardEntry[];
  total?:number/*=25*/; me?:PersonalResult|null; right?:ReactNode }

// UI-S-006
PersonalResultScreen: { grade:number; name:string; correct:number; wrong:number; skipped:number;
  score:number; rank:number; totalTimeMs:number; totalParticipants?:number; avatarBg?:string;
  allowReview?:boolean; onReview?():void; onLeaderboard?():void }

// UI-S-007
EventClosedScreen: { nextEventAt:number|Date; grade?:number; skewMs?:number;
  cancelled?:boolean; cancelReason?:ReactNode; onBackHome?():void }

// Types
type AnswerOption  = { key:'A'|'B'|'C'|'D'; label:ReactNode };  // KHÔNG có trường đáp án đúng
type ConnState     = 'connected'|'reconnecting'|'disconnected';
type LeaderboardEntry = { rank:number; displayName:string; correctCount:number; totalTimeMs:number;
  studentId?:string; className?:ReactNode; avatar?:ReactNode; avatarBg?:string; isMe?:boolean };
type PersonalResult   = { name:string; correct:number; wrong:number; skipped:number;
  score:number; rank:number; totalTimeMs:number; className?:ReactNode; avatarBg?:string };
```

## Hợp đồng nối realtime (prop ⟵ nguồn)

| Prop | Nguồn |
|---|---|
| `WaitingRoom.onlineCount` | `SOCK-EVT-S02` (online count) |
| `WaitingRoom.startAt`, `ExamScreen` câu mới | `SOCK-EVT-S03` (phát đề / chuyển câu) |
| `ExamScreen.resume` | `SOCK-EVT-S04` (khôi phục bài) → `{remainingMin, restoredCount}` |
| `ExamScreen.saved` | `SOCK-EVT-S05` (ack lưu đáp án) → `true` |
| `*.skewMs` | `SOCK-EVT-S09` (time-sync) |
| `ExamScreen.conn` / `showDisconnect` | trạng thái socket (`S10/S11`) |
| `LeaderboardScreen.entries` | `SOCK-EVT-S06/S07` (DATA-M-007) |
| `EventClosedScreen.cancelled` | `SOCK-EVT-S08` (huỷ sự kiện) |
| `onSelect(key)` | emit lên server (vd `answer:submit`) — đừng tự chấm ở client |

## Khung controller mẫu (state machine)

```tsx
type Phase = 'entry'|'waiting'|'exam'|'loading'|'leaderboard'|'result'|'closed';

function WeeklyEventController() {
  const [phase, setPhase] = useState<Phase>('entry');
  const [skewMs, setSkew] = useState(0);
  const [q, setQ] = useState<{index:number; total:number; stem:string; options:AnswerOption[]}|null>(null);
  const [selected, setSelected] = useState<string|null>(null);
  const [saved, setSaved] = useState(false);
  const [locked, setLocked] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [conn, setConn] = useState<ConnState>('connected');

  useEffect(() => {
    socket.on('time:sync', d => setSkew(d.serverNow - Date.now()));
    socket.on('exam:question', d => {           // S03: câu mới (đồng bộ)
      setQ(d); setSelected(null); setSaved(false); setLocked(false);
      setRemaining(d.perQuestionSec); setPhase('exam');
    });
    socket.on('exam:lock', () => setLocked(true));      // hết giờ câu
    socket.on('answer:ack', () => setSaved(true));      // S05
    socket.on('exam:graded', () => setPhase('loading'));
    socket.on('leaderboard', () => setPhase('leaderboard')); // S06/S07
    socket.io.on('reconnect_attempt', () => setConn('reconnecting'));
    socket.io.on('reconnect', () => setConn('connected'));
    socket.on('disconnect', () => setConn('disconnected'));
    return () => socket.removeAllListeners();
  }, []);

  const pick = (key:'A'|'B'|'C'|'D') => {
    if (locked) return;
    if (selected == null) setAnswered(a => a + 1);
    setSelected(key); setSaved(false);
    socket.emit('answer:submit', { questionId: q!.index, key });  // chờ ack → saved
  };

  switch (phase) {
    case 'entry':   return <EventEntry status="open" weeklyTitle={title} grade={grade} onJoin={()=>socket.emit('join')} />;
    case 'waiting': return <WaitingRoom weeklyTitle={title} grade={grade} onlineCount={online} startAt={startAt} skewMs={skewMs} />;
    case 'exam':    return q && (
      <ExamScreen grade={grade} index={q.index} total={q.total} question={q.stem} options={q.options}
        answeredCount={answered} selected={selected} saved={saved} locked={locked}
        remaining={remaining} perQuestionSec={perQ} conn={conn}
        showDisconnect={conn!=='connected'} onSelect={pick} />
    );
    case 'loading':     return <SubmissionLoading grade={grade} announceAt="10h27" />;
    case 'leaderboard': return <LeaderboardScreen grade={grade} entries={entries} total={25} me={me} />;
    case 'result':      return <PersonalResultScreen grade={grade} {...me} totalParticipants={n} onLeaderboard={()=>setPhase('leaderboard')} />;
    case 'closed':      return <EventClosedScreen grade={grade} nextEventAt={next} skewMs={skewMs} />;
  }
}
```

> `remaining` đếm lùi: dùng `setInterval` 1s, hoặc tính `Math.ceil((deadline-(Date.now()+skewMs))/1000)`.
> `SyncTimer` bên trong `ExamScreen` chỉ vẽ vòng tròn theo `remaining/perQuestionSec` — không tự đếm.

## Lỗi thường gặp (tránh)

- ❌ Tự tăng `index` khi hết giờ — phải chờ `SOCK-EVT-S03`. ✅ Chỉ set `locked=true`.
- ❌ Đưa đáp án đúng vào `options` lúc làm bài. ✅ Server trộn options, không gửi key đúng.
- ❌ Truyền số giây vào `to`/`startAt`. ✅ Truyền mốc epoch/`Date`.
- ❌ Quên `<IconSprites/>` hoặc `index.css`. ✅ Mount + nạp ở root.
- ❌ Sort leaderboard trong component. ✅ Sort ở consumer trước khi truyền `entries`.
- ❌ Chấm điểm ở client. ✅ Chỉ emit `onSelect`; điểm/hạng do backend trả về.

## Selector mã định danh (debug/test)
Mỗi màn có `data-scr="UI-S-00x"`, mỗi component có `data-ui="UI-C-0xx"`.
VD: `container.querySelector('[data-ui="UI-C-003"]')` để lấy QuestionCard trong test.

> Tài liệu cho người đọc: xem `README.md` cùng folder. File này chỉ dành cho coding agent.
