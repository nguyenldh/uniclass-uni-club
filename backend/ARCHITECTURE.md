# @uniclub/backend — Kiến trúc

## Vai trò

Backend server cung cấp REST API + WebSocket (Socket.IO) cho toàn bộ hệ thống. Phục vụ đồng thời game client (học sinh) và CMS (admin).

## Cách đọc tài liệu này

- Scope của file này là code backend đang tồn tại trong repo, không mô tả ý tưởng chưa implement trừ khi có ghi rõ `Planned`
- Khi tài liệu và code khác nhau, ưu tiên code làm source of truth
- Trạng thái được hiểu như sau:
    - `Implemented`: đã có code chạy trong repo
    - `Partial`: đã có một phần code, chưa phủ hết use case
    - `Planned`: mới là định hướng kiến trúc, chưa có code tương ứng

## Cấu trúc

```
backend/
├── package.json
├── tsconfig.json           # module: NodeNext, moduleResolution: NodeNext
├── Dockerfile              # Container hóa để scale
├── .env                    # Biến môi trường (gitignored)
├── .env.example            # Template mẫu (committed)
└── src/
    ├── index.ts            # Entry point — bootstrap & listen
    ├── app.ts              # Express app (tách riêng, không listen)
    ├── config/
    │   ├── index.ts        # Barrel export
    │   ├── env.ts          # Đọc & validate biến môi trường
    │   ├── db.ts           # MongoDB connection (mongoose)
    │   └── redis.ts        # Redis connection (standalone hoặc cluster)
    ├── models/
    │   └── index.ts        # Mongoose models
    ├── routes/
    │   ├── game/
    │   │   └── index.ts    # API cho học sinh
    │   └── admin/
    │       └── index.ts    # API cho CMS
    ├── sockets/
    │   ├── index.ts        # Socket.IO init + Redis Adapter
    │   └── handlers/
    │       └── index.ts    # Event handlers (tách theo domain)
    ├── services/
    │   └── index.ts        # Business logic layer
    ├── middleware/
    │   └── index.ts        # Auth (JWT), validation, error handling
    └── utils/
        └── index.ts        # Helpers
```

## Quy luật

### 1. Stateless

- **Không lưu session/state trong memory của instance**
- Auth dùng JWT — mỗi request tự xác thực, không cần session store
- State tạm thời (matchmaking queue, active games) lưu trong Redis
- Điều này cho phép scale ngang không cần sticky session (trừ WebSocket fallback)

### 2. Tách app.ts / index.ts

- **`app.ts`**: Tạo Express app + Socket.IO, export `{ app, httpServer }` — không gọi `.listen()`
- **`index.ts`**: Import từ `app.ts`, gọi `httpServer.listen()` — entry point thực sự
- Lợi ích: Test được app mà không cần chiếm port; import linh hoạt

### 3. Socket.IO + Redis Adapter

- Socket.IO gắn vào cùng HTTP server với Express → chung 1 cổng
- Dùng `@socket.io/redis-adapter` với pub/sub client riêng biệt (`redis.duplicate()`)
- Khi scale nhiều instance, event broadcast tới tất cả client bất kể instance nào

### 4. Redis — Standalone & Cluster

- Config qua `REDIS_MODE` env: `"standalone"` hoặc `"cluster"`
- **Standalone**: `new Redis({ host, port, password })`
- **Cluster**: `new Redis.Cluster(nodes, { redisOptions: { password } })`
- Socket.IO Adapter tự động dùng đúng kiểu client qua `redis.duplicate()`

### 5. Routes phân tách

- **`routes/game/`**: Endpoint cho học sinh (game client)
- **`routes/admin/`**: Endpoint cho CMS (admin dashboard)
- Phân tách rõ ràng để dễ quản lý permission & middleware

### 6. Services layer

- Business logic nằm trong `services/` — không nằm trong routes hay sockets
- Routes chỉ làm nhiệm vụ parse request → gọi service → trả response
- Socket handlers gọi service tương tự

### 7. Middleware

- JWT auth middleware — verify token, gắn `req.user`
- Validation middleware — validate request body/params
- Error handling middleware — catch toàn bộ lỗi, trả về format chuẩn

### 8. Container hóa

- `Dockerfile`: Node 20 Alpine, build TypeScript → run JavaScript
- Sẵn sàng cho docker-compose hoặc Kubernetes

## Mind Game (Đấu trí)

### Snapshot

| Mục | Giá trị |
|---|---|
| Status | `Implemented` |
| Game con | `gomoku`, `card_flip` |
| Entry REST | `/api/game/mind-game/*` |
| Entry Socket | `registerMindGameHandlers()` |
| State runtime | Redis |
| State cấu hình | MongoDB + Redis cache |

### Source Of Truth Files

- `src/games/mind-game/routes/index.ts`: REST surface cho Mind Game
- `src/games/mind-game/services/matchmaking.service.ts`: queue + timeout + tạo session
- `src/games/mind-game/services/gomoku.service.ts`: luật game và vòng đời Gomoku
- `src/games/mind-game/services/card-flip.service.ts`: luật game và vòng đời Card Flip
- `src/games/mind-game/sockets/index.ts`: gameplay events qua Socket.IO
- `src/services/game-config.service.ts`: đọc/ghi config và cache
- `src/routes/admin/index.ts`: admin contract cho config và leaderboard
- `src/models/index.ts`: schema `GameConfig` và `UserScore`

### Module Boundaries

- Mind Game được tách vào `src/games/mind-game/`
- `src/routes/game/index.ts` mount toàn bộ module dưới prefix `/api/game/mind-game`
- `src/sockets/handlers/index.ts` đăng ký toàn bộ socket handlers của Mind Game
- Constants dùng chung với frontend nằm trong `@uniclub/shared`

### Runtime Flows

#### Flow 1: Matchmaking

1. Client join matchmaking queue theo `gameType`
2. Queue được lưu trong Redis list `mind-game:matchmaking:queue:<gameType>`
3. Nếu có đối thủ đang chờ, backend tạo PvP session ngay
4. Nếu hết timeout, backend tạo AI session
5. Timeout được lấy từ config game qua `GameConfigService`

#### Flow 2: Gomoku

1. Tạo session với board size lấy từ config
2. Session được lưu Redis TTL 30 phút tại `mind-game:gomoku:session:<sessionId>`
3. Gameplay đi qua Socket.IO; REST chỉ dùng để lấy lại session khi reload/truy cập lại trận
4. `makeMove()` validate turn, cell và luật thắng/hòa
5. Khi kết thúc trận, backend cập nhật winner, timestamps và score

#### Flow 3: Card Flip

1. Tạo session với bộ thẻ từ `pairCount` và `cardItems`
2. Nếu chưa có `cardItems`, backend fallback sang `CARD_EMOJIS`
3. Session được lưu Redis TTL 30 phút tại `mind-game:card-flip:session:<sessionId>`
4. Gameplay có thể đi qua Socket.IO; REST vẫn tồn tại cho lấy session và một số action hiện tại
5. Nếu không match, backend không tự úp thẻ lại; client phải gọi reset sau animation

### Contracts

#### REST

- `GET /api/game/mind-game/gomoku/:sessionId`: lấy session Gomoku
- `GET /api/game/mind-game/card-flip/:sessionId`: lấy session Card Flip
- `POST /api/game/mind-game/card-flip/start-vs-ai`: tạo session Card Flip vs AI
- `POST /api/game/mind-game/card-flip/flip`: lật 1 thẻ Card Flip
- `POST /api/game/mind-game/card-flip/reset-flipped`: úp lại các thẻ không match

#### Socket

- Gomoku: `GOMOKU_MOVE`, `GOMOKU_STATE`, `GOMOKU_END`
- Card Flip: `CARD_FLIP_FLIP`, `CARD_FLIP_STATE`, `CARD_FLIP_END`, `CARD_FLIP_TURN`
- Tên event và Redis key prefixes dùng constant từ `@uniclub/shared`

#### Admin

- `GET /api/admin/config`: trả `configs.mind_game.gomoku` và `configs.mind_game.card_flip`
- `PUT /api/admin/config/gomoku`: cập nhật config Gomoku
- `PUT /api/admin/config/card-flip`: cập nhật config Card Flip
- `POST /api/admin/config/invalidate-cache`: clear cache config theo `gameType`

### Persistence Rules

- Config Mind Game lưu trong Mongo collection `GameConfig`
- `gameType` hợp lệ hiện tại là `gomoku` hoặc `card_flip`
- Schema config:
    - Gomoku: `matchmakingTimeout`, `winPoints`, `boardSize`
    - Card Flip: `matchmakingTimeout`, `winPoints`, `pairCount`, `cardItems`
- Redis cache config dùng namespace `game:config:mind-game:*` với TTL 5 phút
- `UserScore` lưu cả aggregate `mind_game` và breakdown theo `gomoku`, `card_flip`

### Non-Obvious Rules

- Gomoku gameplay không đi qua REST cho move thường; source of truth là socket flow + Redis session
- Card Flip hiện có cả REST và Socket.IO cho gameplay-related actions; đây là hiện trạng code, không phải thiết kế thuần một kênh
- Khi đấu AI, AI không có user score riêng trong Mongo
- Với disconnect giữa trận, backend tự chốt thắng/thua và cập nhật score

### Current Limitations

- `MatchmakingService` hiện mới có flow triển khai rõ ràng cho `gomoku`; `card_flip` chưa có coverage tương đương ở service này
- Card Flip hiện còn giữ REST actions song song với socket actions
- Nếu có thay đổi tài liệu liên quan Mind Game, cần đối chiếu lại `@uniclub/shared` trước vì đó là contract dùng chung giữa các app

## Quiz Arena (So Tài)

### Snapshot

| Mục | Giá trị |
|---|---|
| Status | `Implemented` |
| Game con | `quiz` (PvP hoặc vs Bot) |
| Entry REST | `/api/game/quiz-arena/*` |
| Entry Socket | `registerQuizArenaHandlers()` |
| State runtime | Redis |
| State cấu hình | MongoDB + Redis cache |
| Question Bank | MongoDB collection `Question` |

### Source Of Truth Files

- `src/games/quiz-arena/routes/index.ts`: REST surface cho Quiz Arena
- `src/games/quiz-arena/sockets/index.ts`: gameplay events qua Socket.IO
- `src/games/quiz-arena/services/quiz-arena.service.ts`: vòng đời session, tính điểm, tie-breaker, AFK, kết thúc trận
- `src/games/quiz-arena/services/question.service.ts`: chọn câu hỏi theo grade+bucket, ghi nhận thống kê, recompute độ khó
- `src/games/quiz-arena/services/user-ability.service.ts`: phân nhóm năng lực Easy/Medium/Hard theo lịch sử
- `src/games/quiz-arena/services/quiz-bot.service.ts`: giả lập hành vi bot theo profile
- `src/games/quiz-arena/services/quiz-matchmaking.factory.ts`: factory đăng ký vào MatchmakingService + pending context
- `src/games/quiz-arena/services/uniclass-sync.service.ts`: stub sync điểm về UniClass (log + Redis retry queue)
- `src/games/quiz-arena/scripts/seed-questions.ts`: script seed câu hỏi mẫu
- `src/services/game-config.service.ts`: getQuizArenaConfig, updateConfig('quiz_arena'), getMatchmakingTimeout
- `src/models/index.ts`: schema `QuestionModel` + mở rộng `GameConfigModel` cho `quiz_arena`

### Module Boundaries

- Quiz Arena được tách vào `src/games/quiz-arena/`
- `src/routes/game/index.ts` mount dưới prefix `/api/game/quiz-arena`
- `src/sockets/handlers/index.ts` đăng ký `registerQuizArenaHandlers`
- `src/app.ts` gọi `registerQuizArenaMatchmaking()` khi bootstrap
- Matchmaking gameType: `'quiz'` (dùng lại `MatchmakingService` game-agnostic)
- Constants và types dùng chung với frontend nằm trong `@uniclub/shared` (quiz-arena.ts)

### Runtime Flows

#### Flow 1: Matchmaking Quiz Arena

1. Client gửi `matchmaking:join` với `{ gameType: 'quiz', grade, displayName }`
2. Handler tính `abilityBucket` qua `UserAbilityService.getAbilityBucket(userId, config)`
3. `partitionKey = "${grade}:${abilityBucket}"` → queue key có suffix để cô lập theo khối + nhóm
4. Handler lưu `pendingContext = { displayName, grade, abilityBucket }` vào Redis TTL 60s
5. `MatchmakingService.joinQueue(entry)` với `partitionKey`
6. Nếu matched: factory lấy context cả 2 user → tạo PVP session
7. Nếu `realPlayerSearchSeconds` hết (default 15s) và không tìm được người thật → tạo Bot session

#### Flow 2: Gameplay Quiz Arena

1. Client nhận `MATCHMAKING_MATCHED` / `MATCHMAKING_TIMEOUT` → gửi `quiz-arena:join-session { sessionId }`
2. Khi đủ số người trong room: backend gọi `startMatch()` → status 'playing'
3. `startNextQuestion()`: lấy câu hỏi từ `session.questions[currentQuestionIndex]`, set `currentQuestionStartedAt`, broadcast `quiz-arena:question` (không có `correctIndex`), schedule timeout tự động submit null
4. Nếu là Bot session: `QuizBotService.decide()` → schedule bot submit sau `responseTimeMs`
5. Client gửi `quiz-arena:answer { sessionId, selectedIndex }` → `submitAnswer()`:
   - Server tính `responseTimeMs = now - currentQuestionStartedAt` (chống cheat client-side)
   - Tính `earnedPoints` theo công thức decay: `maxPoints * (1 - minRetention * responseTime/timeLimit)`
   - Nếu AFK >= `afkConsecutiveMisses` câu liên tiếp → forfeit
6. Sau khi cả 2 trả lời: emit `quiz-arena:question-result` (có `correctIndex`), sau `nextQuestionDelayMs` → câu tiếp
7. Sau câu cuối: `endMatch()` → tính winner (theo điểm → thời gian → timestamp), cập nhật score, enqueue UniClass sync, emit `quiz-arena:end`

#### Flow 3: Điểm và Tie-breaker

- In-match score (tích lũy): `maxPoints * (1 - 0.5 * responseTime/timeLimit)` nếu đúng, 0 nếu sai
- Phân định thắng theo thứ tự: tổng điểm → totalCorrectTimeMs nhỏ hơn → finalSubmittedAt sớm hơn
- UniPoints đồng bộ về UniClass: `correctCount * uniPointsPerCorrect` (cả 2 đều nhận, độc lập với thắng/thua)

#### Flow 4: Bot

- Sau `realPlayerSearchSeconds`: factory tạo Bot session với `QUIZ_BOT_PROFILES[abilityBucket]`
- Profile: easy (40% đúng, 12-20s), medium (65% đúng, 7-15s), hard (88% đúng, 2-8s)
- Bot tự submit sau `responseTimeMs` ngẫu nhiên trong profile (không vượt quá timeLimit của câu)

### Contracts

#### REST

- `GET /api/game/quiz-arena/:sessionId`: lấy session (ẩn `correctIndex` câu chưa kết thúc)
- `GET /api/game/config/quiz-arena`: lấy config public
- `PUT /api/admin/config/quiz-arena`: cập nhật config (CMS)
- `GET /api/admin/config`: bao gồm `configs.quiz_arena`
- `POST /api/admin/quiz-arena/recompute-difficulty`: bulk recompute độ khó câu hỏi

#### Socket (client → server)

- `matchmaking:join { userId, gameType:'quiz', grade, displayName }`: tìm trận
- `matchmaking:leave { userId, gameType }`: rời queue
- `quiz-arena:join-session { sessionId }`: vào room sau khi matched
- `quiz-arena:answer { sessionId, selectedIndex }`: gửi đáp án (0-3 hoặc null)

#### Socket (server → client)

- `matchmaking:matched { status, gameType, sessionId, role }`: kết quả matchmaking
- `matchmaking:timeout { sessionId, isAI }`: matched với bot
- `quiz-arena:question`: câu hỏi mới (không có `correctIndex`)
- `quiz-arena:opponent-answered { questionIndex }`: đối thủ đã trả lời
- `quiz-arena:question-result { correctIndex, playerA, playerB }`: kết quả câu hỏi
- `quiz-arena:state { playerA, playerB }`: state tổng thể
- `quiz-arena:end`: QuizArenaResult (winner, loser, summary cả 2)
- `quiz-arena:opponent-disconnected { userId }`: đối thủ mất kết nối

### Persistence Rules

- Config Quiz Arena lưu trong Mongo collection `GameConfig` với `gameType: 'quiz_arena'`
- `Question` collection: lưu nội dung, `difficultyBucket` (tự động), `totalAttempts`, `totalCorrect`, `correctRate`
- `difficultyBucket` được recompute qua admin endpoint hoặc tự động sau mỗi câu trả lời
- Redis cache config: `game:config:quiz_arena` TTL 5 phút
- Redis session: `quiz-arena:session:<sessionId>` TTL 30 phút
- Redis user ability cache: `quiz-arena:user-ability:<userId>` TTL 10 phút
- Redis recent matches: `quiz-arena:user-recent-matches:<userId>` TTL 90 ngày (cap N=`recentMatchesForAbility`)
- Redis recent questions: `quiz-arena:user-recent-questions:<userId>` TTL 30 ngày (cap 50 câu)
- Redis UniClass sync retry queue: `quiz-arena:uniclass-sync:retry` (list, persistent)
- `UserScore.quiz_arena` track điểm nội bộ (thắng/thua/played) — tách biệt với UniPoints

### Non-Obvious Rules

- Server tự tính `responseTimeMs` từ `currentQuestionStartedAt` — client KHÔNG gửi thời gian (chống cheat)
- `correctIndex` không bao giờ gửi cho client cho đến khi câu hỏi kết thúc
- Bot session không cập nhật `QuestionStats` (chỉ human user mới count vào `totalAttempts`)
- `partitionKey = "${grade}:${abilityBucket}"` đảm bảo chỉ ghép đúng khối + nhóm năng lực
- `pendingContext` lưu vào Redis TTL 60s để factory lấy khi tạo session; bị xóa sau khi dùng
- UniClass sync là stub: chỉ log + LPUSH vào retry queue; HTTP call chưa implement
- AFK forfeit: đối thủ nhận `maxPointsPerQuestion * (số câu còn lại)` bonus

### Current Limitations

- UniClass sync chưa implement HTTP call thật (stub log + Redis queue)
- CRUD câu hỏi trong CMS chưa có (phase sau)
- Cron/BullMQ tự động recompute difficulty chưa có (thủ công qua admin endpoint)
- `grade` lấy từ JWT payload (field `grade?: number`) — UniClass phải cấp khi sinh token

## Environment Variables

| Biến | Mô tả | Default |
|---|---|---|
| `PORT` | Cổng server | `3000` |
| `NODE_ENV` | Môi trường | `development` |
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017/uniclub` |
| `REDIS_MODE` | `standalone` hoặc `cluster` | `standalone` |
| `REDIS_HOST` | Redis host (standalone) | `localhost` |
| `REDIS_PORT` | Redis port (standalone) | `6379` |
| `REDIS_PASSWORD` | Redis password | (rỗng) |
| `REDIS_CLUSTER_NODES` | Danh sách node cluster: `host:port,host:port` | (rỗng) |
| `JWT_SECRET` | Secret key cho JWT | `change-me-in-production` |
| `JWT_EXPIRES_IN` | JWT expiration | `7d` |

## Tech stack

| Thành phần | Lựa chọn |
|---|---|
| Runtime | Node.js 20 |
| Language | TypeScript (CommonJS output) |
| Framework | Express |
| WebSocket | Socket.IO + @socket.io/redis-adapter |
| Database | MongoDB (mongoose) |
| Cache/PubSub | Redis (ioredis) |
| Auth | JWT (jsonwebtoken) |
| Dev runner | tsx watch |
| Container | Docker (Alpine) |
