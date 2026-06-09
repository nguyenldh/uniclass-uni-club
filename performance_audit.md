# 🔍 Performance Audit — UniClub Backend @ 20k Users

## Tổng quan

Rà soát toàn bộ backend codebase để tìm các bottleneck tiềm ẩn khi scale lên **~20.000 user đồng thời**. Các vấn đề được phân loại theo mức độ nghiêm trọng:

| Severity | Ý nghĩa |
|----------|---------|
| 🔴 **Critical** | Gây crash/lag rõ rệt, cần fix trước khi scale |
| 🟠 **High** | Gây giảm hiệu suất đáng kể, nên fix sớm |
| 🟡 **Medium** | Có thể gây vấn đề khi peak, nên cải thiện |
| 🟢 **Low** | Tối ưu thêm, không cấp bách |

---

## 🔴 P1 — `io.fetchSockets()` quét toàn bộ connections (Critical)

**File**: [matchmaking.handler.ts](file:///f:/Outsource/UniClub/backend/src/sockets/handlers/matchmaking.handler.ts#L258-L266)

```typescript
async function getOpponentSocketId(io: Server, userId: string): Promise<string | undefined> {
  const sockets = await io.fetchSockets(); // ← O(N) với N = tổng connections
  for (const s of sockets) {
    if (s.data.userId === userId) {
      return s.id;
    }
  }
  return undefined;
}
```

**Vấn đề**: `io.fetchSockets()` lấy **toàn bộ socket** trên **tất cả server instances** (qua Redis Adapter). Với 20k user, mỗi lần matchmaking thành công phải fetch và duyệt **20.000+ sockets** để tìm 1 người.

**Impact**: Mỗi match thành công mất O(N) + network round-trip qua Redis pub/sub. Nếu 1000 cặp match/phút → 1000 lần fetch 20k sockets.

**Fix**: Lưu mapping `userId → socketId` trong Redis Hash. Khi connect → `HSET user:sockets userId socketId`, khi disconnect → `HDEL`. Lookup O(1).

---

## 🔴 P2 — `timeoutMap` / `partitionKeyMap` lưu trong memory process (Critical)

**File**: [matchmaking.handler.ts](file:///f:/Outsource/UniClub/backend/src/sockets/handlers/matchmaking.handler.ts#L22-L24)

```typescript
const timeoutMap = new Map<string, NodeJS.Timeout>();
const partitionKeyMap = new Map<string, string | undefined>();
```

**File**: [quiz-arena.service.ts](file:///f:/Outsource/UniClub/backend/src/games/quiz-arena/services/quiz-arena.service.ts#L135-L144)

```typescript
const questionTimeouts = new Map<string, NodeJS.Timeout>();
const nextQuestionTimers = new Map<string, NodeJS.Timeout>();
const botTurnTimers = new Map<string, NodeJS.Timeout>();
const disconnectTimers = new Map<string, NodeJS.Timeout>();
```

**Vấn đề**: Khi chạy **nhiều backend instances** (scale-out), timeout và timer chỉ tồn tại trên 1 instance. Nếu user reconnect vào instance khác, timeout sẽ không bị clear → **match zombie**, **duplicate AI sessions**, hoặc **game state mismatch**.

**Impact**: Với 20k users trên 3+ instances → race conditions trong matchmaking, game sessions bị stuck hoặc duplicate.

**Fix ngắn hạn**: Sử dụng Redis pub/sub để coordinate timeout cancellation giữa instances.
**Fix dài hạn**: Migrate timeout logic sang BullMQ delayed jobs (Redis-backed, distributed).

---

## 🔴 P3 — `syncLeaderboardFromDB` load toàn bộ UserScore (Critical)

**File**: [score.service.ts](file:///f:/Outsource/UniClub/backend/src/services/score.service.ts#L193-L209)

```typescript
static async syncLeaderboardFromDB(scope: LeaderboardScope = 'total'): Promise<void> {
  const docs = await UserScoreModel.find().lean(); // ← LOAD TẤT CẢ USERS
  // ...
  for (const doc of docs) {
    multi.zadd(key, scoreValue, doc.userId);
  }
}
```

**Vấn đề**: Khi Redis cache miss hoặc expire, hàm load **toàn bộ** UserScore từ MongoDB. Với 20k users, mỗi document ~500 bytes → ~10MB data transfer + parse + pipeline ZADD 20k lệnh.

**Impact**: Blocking I/O kéo dài 2-5 giây. Mỗi khi TTL hết (1 giờ), bất kỳ request nào hit cache miss sẽ trigger sync → spike latency.

**Fix**: 
- Chỉ sync top N (vd: top 500) thay vì tất cả: `UserScoreModel.find().sort({ totalPoints: -1 }).limit(500).lean()`
- Dùng streaming cursor thay vì load hết vào RAM
- Hoặc duy trì sorted set vĩnh viễn (không expire), chỉ rebuild khi admin yêu cầu

---

## 🔴 P4 — Weekly Event Scheduler tick mỗi 5 giây (Critical)

**File**: [weekly-event-scheduler.service.ts](file:///f:/Outsource/UniClub/backend/src/games/weekly-event/services/weekly-event-scheduler.service.ts#L41-L45)

```typescript
this.cronInterval = setInterval(() => {
  this.tick().catch(/* ... */);
}, 5000); // ← Mỗi 5 giây
```

**Vấn đề**: 
1. **Multi-instance**: Mỗi backend instance chạy cron riêng → 3 instances = 3x query/5s = **36 queries MongoDB/phút** chỉ cho scheduler (mỗi tick query `WeeklyEventModel.find` + loop qua 12 grades)
2. **Không có distributed lock** cho `checkStateTransitions` (chỉ có cho `tryAutoGenerate`) → nhiều instances đồng thời xử lý cùng một transition, gây **duplicate grading**, **duplicate broadcasts**

**Impact**: Race condition trong grading có thể tạo duplicate `WeeklyEventResult`, leaderboard sai. Đặc biệt nguy hiểm khi 20k user cùng thi Weekly Event.

**Fix**:
- Tăng interval lên 30-60s (đủ chính xác cho lifecycle phút)
- Thêm distributed lock (`SET NX EX`) cho mỗi transition grade
- Hoặc chỉ chạy scheduler trên 1 instance (leader election)

---

## 🟠 P5 — `getLeaderboard` N+1 query pattern (High)

**File**: [score.service.ts](file:///f:/Outsource/UniClub/backend/src/services/score.service.ts#L167-L188)

```typescript
static async getLeaderboard(scope, limit = 20): Promise<UserScore[]> {
  // ...
  const scores = await Promise.all(userIds.map((id) => this.getUserScore(id)));
  // ← Mỗi getUserScore = 1 Redis GET + có thể 1 MongoDB query
  return scores;
}
```

**Vấn đề**: Lấy top 20 → 20 lần `getUserScore()`, mỗi lần cache miss = 1 MongoDB query. Best case: 20 Redis calls. Worst case: 20 Redis + 20 MongoDB calls.

**Fix**: Batch lấy Redis bằng `MGET`, batch MongoDB bằng `find({ userId: { $in: userIds } })`.

---

## 🟠 P6 — Boss Battle `submitAnswer` waterfall queries (High)

**File**: [boss-battle.service.ts](file:///f:/Outsource/UniClub/backend/src/games/boss-battle/services/boss-battle.service.ts#L242-L344)

```
submitAnswer() flow:
  1. DailyAttemptModel.findById(attemptId)          ← MongoDB
  2. BossInstanceModel.findById(attempt.bossInstanceId) ← MongoDB  
  3. BossQuestionSetModel.findById(attempt.questionSetId) ← MongoDB
  4. BossQuestionService.getById(questionId)          ← MongoDB
  5. redis.get(startedKey)                             ← Redis
  6. BossAnswerRecordModel.create(...)                 ← MongoDB write
  7. attempt.save()                                    ← MongoDB write
  8. redis.del + redis.set                             ← Redis
  9. finalizeAttempt() → thêm 4-5 queries nữa         ← MongoDB + Redis
```

**Vấn đề**: Mỗi answer submit = **7-12 sequential database round-trips**. Với 20k users, mỗi ngày 5 câu/user = 100k answers → 700k-1.2M database calls/ngày chỉ cho Boss Battle.

**Fix**:
- Parallelize independent queries: `Promise.all([findById(attemptId), getById(questionId)])`
- Cache `BossQuestionSet` và `BossInstance` trong Redis (ít thay đổi trong ngày)
- Dùng `findByIdAndUpdate` thay vì `findById` → modify → `save()` (giảm 1 round-trip)

---

## 🟠 P7 — Boss Battle Leaderboard recompute mỗi lần submit (High)

**File**: [boss-battle.service.ts](file:///f:/Outsource/UniClub/backend/src/games/boss-battle/services/boss-battle.service.ts#L434-L436)

```typescript
// Trong finalizeAttempt():
LeaderboardService.invalidateAndBroadcast(instance.weekKey, instance.gradeLevel)
```

**File**: [leaderboard.service.ts](file:///f:/Outsource/UniClub/backend/src/games/boss-battle/services/leaderboard.service.ts#L149-L166)

```typescript
static async invalidateAndBroadcast() {
  await redis.del(cacheKey);          // ← Xóa cache
  const fresh = await this.recompute(); // ← Query lại toàn bộ progress + users
  io.to(room).emit(/* broadcast */);
}
```

**Vấn đề**: Mỗi lần 1 học sinh hoàn thành attempt → **recompute toàn bộ top 200 + query UserModel JOIN** → broadcast. Với 20k users, 12 khối lớp, mỗi lần recompute = 2 MongoDB queries (sort + join). Peak: hàng trăm recompute/phút.

**Fix**:
- **Debounce**: Gộp recompute trong 5-10 giây, chỉ chạy 1 lần cuối
- **Incremental update**: Chỉ insert/update vị trí của student mới trong Redis Sorted Set, không rebuild toàn bộ
- **Rate limit broadcast**: Max 1 broadcast/10s per grade

---

## 🟠 P8 — `addWinPointsBatch` sequential Redis updates (High)

**File**: [score.service.ts](file:///f:/Outsource/UniClub/backend/src/services/score.service.ts#L116-L131)

```typescript
for (const update of updates) {
  // ...
  await redis.set(/* cache */);      // ← Sequential
  await redis.zadd(/* total */);     // ← Sequential  
  await redis.zadd(/* gameType */);  // ← Sequential
}
```

**Vấn đề**: Trong `addWinPointsBatch` (dùng cho Weekly Event grading), mỗi user update = 3 Redis calls sequential. Với 2000 participants/grade → 6000 Redis calls **tuần tự**, mỗi call ~0.5ms RTT = **~3 giây blocking**.

> [!NOTE]
> Comment giải thích: tránh CROSSSLOT trên Redis Cluster. Đúng khi dùng `multi/exec`, nhưng có thể dùng **per-key pipeline** hoặc **nhóm theo hash slot**.

**Fix**: Dùng `redis.pipeline()` thay vì sequential `await`. Pipeline không yêu cầu cùng hash slot (khác với MULTI/EXEC):
```typescript
const pipe = redis.pipeline();
for (const update of updates) {
  pipe.set(/*...*/);
  pipe.zadd(/*...*/);
}
await pipe.exec();
```

---

## 🟡 P9 — Analytics Service — Full collection scan (Medium)

**File**: [analytics.service.ts](file:///f:/Outsource/UniClub/backend/src/services/analytics.service.ts#L157-L165)

```typescript
const userCreations = await UserModel.aggregate([
  {
    $group: {
      _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
      count: { $sum: 1 },
    },
  },
  { $sort: { _id: 1 } },
]);
```

**Vấn đề**: Full collection `$group` trên `UserModel` không có `$match` filter → scan toàn bộ 20k+ documents. Thêm vào đó, `getOverview()` chạy **5 parallel aggregations** trên nhiều collections.

Phần tính `bossTotal` còn loop ngày-by-ngày:
```typescript
while (tempDate.getTime() <= endCalc.getTime()) {
  bossTotal += getActiveUsersAtDateStr(dateStr); // ← O(N) mỗi ngày
  tempDate.setDate(tempDate.getDate() + 1);
}
```
Với period "all" + 365 ngày → 365 × N iterations.

**Fix**: 
- Thêm `$match` filter vào aggregation
- Pre-compute analytics metrics bằng cron job hàng ngày, lưu vào collection riêng
- Cache kết quả analytics trong Redis TTL 5-10 phút

---

## 🟡 P10 — Matchmaking Queue `lrange(0, -1)` full scan (Medium)

**File**: [matchmaking.service.ts](file:///f:/Outsource/UniClub/backend/src/services/matchmaking.service.ts#L47)

```typescript
const queueData = await redis.lrange(key, 0, -1); // ← Toàn bộ queue
for (const data of queueData) {
  const waiting: MatchmakingEntry = JSON.parse(data);
  if (waiting.userId == userId) continue;
  // ...
}
```

**Vấn đề**: `lrange(0, -1)` load toàn bộ queue. Bình thường queue ngắn, nhưng khi có spike (vd: Weekly Event vừa kết thúc, nhiều người tràn sang Quiz Arena) → queue có thể tăng đột biến.

Phương thức `leaveQueue` cũng tương tự: load all → loop tìm.

**Fix ngắn hạn**: Thường queue nhỏ (partition theo grade:bucket) nên OK cho 20k. Nhưng nên monitor queue size.

**Fix dài hạn**: Dùng Redis Stream hoặc Sorted Set thay vì List cho matchmaking queue.

---

## 🟡 P11 — Weekly Event Grading — Memory pressure (Medium)

**File**: [weekly-event-grading.service.ts](file:///f:/Outsource/UniClub/backend/src/games/weekly-event/services/weekly-event-grading.service.ts#L154-L351)

```typescript
static async gradeAllStudents(eventId, roomId, grade, exam) {
  const participations = await WeeklyEventParticipationModel.find({ eventId, grade }).lean();
  // ← Nếu 2000 students/grade → 2000 documents trong RAM
  
  const pipeline = redis.pipeline();
  for (const p of participations) {
    pipeline.hgetall(answersKey); // ← 2000 HGETALL
  }
  // ← Tất cả answers trong RAM
  
  const resultsToInsert: any[] = []; // ← 2000 result objects, mỗi object chứa mảng answers
  // ...
}
```

**Vấn đề**: Với 2000 students/grade × 25 câu hỏi = **50.000 answer records** được load vào RAM cùng lúc. Nhân 12 grades chạy tuần tự → peak memory ~100-200MB cho grading session.

**Fix hiện tại đã tốt**: Chunking 500 records/batch cho insertMany + scoreUpdate. Nhưng nên monitor memory khi scale.

---

## 🟡 P12 — `console.log` trong production hot paths (Medium)

Nhiều file có `console.log` trong request path:

- [matchmaking.service.ts:49](file:///f:/Outsource/UniClub/backend/src/services/matchmaking.service.ts#L49): `console.log(entry)` — **mỗi lần join queue**
- [matchmaking.service.ts:57](file:///f:/Outsource/UniClub/backend/src/services/matchmaking.service.ts#L57): `console.log('Matching entry:', ...)`
- [matchmaking.service.ts:67](file:///f:/Outsource/UniClub/backend/src/services/matchmaking.service.ts#L67): `console.log('Opponent', opponent)`
- [boss-battle.service.ts:256](file:///f:/Outsource/UniClub/backend/src/games/boss-battle/services/boss-battle.service.ts#L256): `console.log(attempt.studentId, studentId)`
- [boss-battle.service.ts:420](file:///f:/Outsource/UniClub/backend/src/games/boss-battle/services/boss-battle.service.ts#L420): `console.log('[BossBattle] Emitting hp-update...', JSON.stringify(hpPayload))`
- [quiz-arena.service.ts:766](file:///f:/Outsource/UniClub/backend/src/games/quiz-arena/services/quiz-arena.service.ts#L766): `console.log("Here 3")`
- [sockets/index.ts:23,29](file:///f:/Outsource/UniClub/backend/src/sockets/index.ts#L22-L31): Log mỗi connect/disconnect

**Impact**: Với 20k users, mỗi connect/disconnect = 2 log entries. Matchmaking active = 3-4 logs/match. `JSON.stringify` payloads on hot path blocks event loop. stdout I/O trở thành bottleneck khi log volume cao.

**Fix**: Dùng structured logger (pino/winston) với log level. Loại bỏ debug logs hoặc đặt ở level `debug`.

---

## 🟡 P13 — QuizArena `getSession` luôn query UserService (Medium)

**File**: [quiz-arena.service.ts](file:///f:/Outsource/UniClub/backend/src/games/quiz-arena/services/quiz-arena.service.ts#L156-L174)

```typescript
static async getSession(sessionId: string): Promise<QuizArenaSession | null> {
  const data = await redis.get(/*...*/);
  const session = JSON.parse(data);
  session.playerAData = await UserService.getUser(session.playerA);  // ← Redis/MongoDB
  session.playerBData = await UserService.getUser(session.playerB);  // ← Redis/MongoDB
  return session;
}
```

**Vấn đề**: `getSession` được gọi **cực kỳ thường xuyên** trong gameplay flow:
- `submitAnswer` → `getSession` (line 392)
- `resolveQuestion` → `getSession` (line 527)  
- `startNextQuestion` → `getSession` (line 310)
- `handleQuestionTimeout` → `getSession` (line 494)
- `endMatch` → `getSession` (line 643)

Mỗi lần getSession = 1 Redis GET (session) + 2 Redis GET (user A + B) = **3 Redis calls tối thiểu**. Một trận 10 câu hỏi → ~40-50 getSession calls → **120-150 Redis calls/trận**.

**Fix**: Lưu `playerAData`/`playerBData` trực tiếp vào session Redis khi tạo, thay vì re-fetch mỗi lần.

---

## 🟢 P14 — `GameMatchLogModel.create()` fire-and-forget không batch (Low)

**File**: [game-result-event.service.ts](file:///f:/Outsource/UniClub/backend/src/services/game-result-event.service.ts)

```typescript
GameMatchLogModel.create({
  userId: session.playerA,
  // ...
}).catch((err) => console.error(/*...*/));
```

**Vấn đề**: Mỗi trận kết thúc tạo 1-2 `create()` calls fire-and-forget. Với traffic cao, MongoDB write load tăng. Không gây crash nhưng tăng write pressure.

**Fix**: Buffer writes và `insertMany` theo batch mỗi 5-10 giây, hoặc dùng write-behind queue.

---

## Bảng tóm tắt

| # | Vấn đề | Severity | Ảnh hưởng chính | Fix effort |
|---|--------|----------|-----------------|------------|
| P1 | `io.fetchSockets()` full scan | 🔴 Critical | Matchmaking chậm O(N) | Thấp |
| P2 | In-memory timers multi-instance | 🔴 Critical | Race condition, zombie sessions | Trung bình |
| P3 | `syncLeaderboardFromDB` load all | 🔴 Critical | Spike latency 2-5s | Thấp |
| P4 | Scheduler tick 5s, no lock | 🔴 Critical | Duplicate grading, race condition | Thấp |
| P5 | Leaderboard N+1 queries | 🟠 High | Latency tăng | Thấp |
| P6 | Boss Battle waterfall queries | 🟠 High | High latency per answer | Trung bình |
| P7 | Boss Leaderboard recompute/submit | 🟠 High | DB overload khi nhiều user | Trung bình |
| P8 | Sequential Redis in batch | 🟠 High | 3s+ blocking trong grading | Thấp |
| P9 | Analytics full collection scan | 🟡 Medium | Slow admin dashboard | Trung bình |
| P10 | Matchmaking queue full scan | 🟡 Medium | Spike khi queue lớn | Thấp |
| P11 | WE Grading memory pressure | 🟡 Medium | OOM risk tại peak | Trung bình |
| P12 | console.log trong hot paths | 🟡 Medium | stdout I/O bottleneck | Thấp |
| P13 | QuizArena getSession re-fetch users | 🟡 Medium | 120+ Redis calls/trận | Thấp |
| P14 | Analytics fire-and-forget creates | 🟢 Low | Write pressure | Thấp |

---

## Khuyến nghị thứ tự fix

1. **P1 + P4** — Fix nhanh, impact lớn nhất (userId→socketId mapping + distributed lock cho scheduler)
2. **P2** — Quan trọng khi chạy multi-instance
3. **P3 + P5 + P8** — Cải thiện rõ rệt cho leaderboard và grading
4. **P6 + P7** — Boss Battle optimization
5. **P12 + P13** — Quick wins, giảm overhead
6. **P9 + P11 + P14** — Longer term improvements

> [!IMPORTANT]
> Nếu hệ thống hiện tại chỉ chạy **1 backend instance**, P2 và P4 chưa gây vấn đề ngay. Nhưng khi scale-out (Nginx + 3 instances theo sơ đồ trong docs/ARCHITECTURE.md), chúng sẽ là điểm fail đầu tiên.
