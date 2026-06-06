# Tài liệu Giải pháp — Sự kiện tuần (Weekly Event)

> **Tài liệu nguồn:** WE — Kịch bản nghiệp vụ
> **Phạm vi:** Giải pháp kỹ thuật cho 9 phòng thi đồng thời theo khối, 10h00–10h30 thứ Bảy hàng tuần.
> **Quy ước mã định danh:**
> - `UI-S-XXX` — Màn hình (Screen)
> - `UI-C-XXX` — Component dùng chung
> - `DATA-M-XXX` — Collection MongoDB
> - `DATA-R-XXX` — Cấu trúc dữ liệu Redis
> - `SOCK-EVT-SXX` — Socket event server → client
> - `SOCK-EVT-CXX` — Socket event client → server
> - `SOCK-EVT-AXX` — Socket event cho admin namespace
> - `FLOW-XXX` — Luồng nghiệp vụ
>
> Mỗi component có **dependencies** (các component nó dùng) để dễ truy vết tích hợp.
>
> **Lưu ý quan trọng:** Hệ thống dùng **WebSocket (socket.io + Redis adapter)** làm kênh truyền tải chính cho realtime — không dùng HTTP polling cho hot path. HTTP REST chỉ dùng cho CMS, lịch sử kết quả, và endpoint khởi tạo session.

---

## Phần 1. UI Components

### 1.1. Màn hình phía học sinh (Student-facing Screens)

#### `UI-S-001` — Event Entry Screen (Cổng vào sự kiện)
- **Mục đích:** Điểm chạm đầu tiên — banner sự kiện, nút "Tham gia".
- **Trạng thái hiển thị:**
  - `before-open`: hiển thị countdown đến 10h00 + teaser chủ đề tuần.
  - `open`: nút "Tham gia ngay" active.
  - `in-progress`: hiển thị "Sự kiện đang diễn ra — không thể tham gia muộn" (nếu vào sau 10h05) HOẶC route thẳng vào `UI-S-003` nếu học sinh đã join trước đó.
  - `closed`: hiển thị "Hẹn tuần sau" + countdown đến thứ Bảy kế tiếp.
- **Dependencies:** `DATA-M-002`, `DATA-R-006`, `FLOW-003`.

#### `UI-S-002` — Waiting Room (Phòng chờ)
- **Mục đích:** Tập hợp học sinh từ 10h00 đến 10h05, tạo hiệu ứng đám đông.
- **Thành phần:**
  - `UI-C-008` — badge khối lớp (Phòng Khối 5).
  - `UI-C-002` — counter "Đang có **N** học sinh trong phòng" (cập nhật realtime).
  - `UI-C-001` — countdown lớn đến giờ phát đề (T+5).
  - Tiêu đề chủ đề tuần (lấy từ `weeklyEventTitle` của `DATA-M-002`).
- **Realtime channel:** sau khi vào màn hình, FE join socket room `room:{eventId}:{grade}`, lắng nghe `SOCK-EVT-S01` (state), `SOCK-EVT-S02` (online count), `SOCK-EVT-S03` (exam start).
- **Dependencies:** `DATA-R-003`, `DATA-R-006`, `FLOW-004`.

#### `UI-S-003` — Exam Screen (Màn hình làm bài)
- **Mục đích:** Giao diện trả lời 25 câu, tối ưu tập trung.
- **Thành phần:**
  - `UI-C-001` — countdown 20 phút (đồng hồ server-time, đồng bộ qua socket time-sync).
  - `UI-C-004` — progress bar (đã trả lời X/25).
  - `UI-C-003` — question card (1 câu tại 1 thời điểm hoặc dạng cuộn — chọn pattern 1 câu/màn để dễ kiểm soát tải).
  - `UI-C-005` — connection indicator (xanh/cam/đỏ) gắn trực tiếp với trạng thái socket.
  - Nút "Câu trước / Câu sau / Nộp bài sớm".
- **Realtime channel:** kế thừa socket connection từ `UI-S-002`; lắng nghe `SOCK-EVT-S05` (ack), `SOCK-EVT-S04` (resume), `SOCK-EVT-S09` (time sync). Emit `SOCK-EVT-C02` mỗi khi chọn đáp án.
- **Quy tắc UX:**
  - Khi socket disconnect → hiển thị `UI-C-010` mà KHÔNG khóa input; đáp án buffer ở FE và replay khi reconnect.
  - Khi reconnect và server gửi `SOCK-EVT-S04` → hiển thị `UI-C-009` thông báo "Đã khôi phục bài làm".
- **Dependencies:** `DATA-R-005`, `DATA-R-010`, `FLOW-005`, `FLOW-006`, `FLOW-007`.

#### `UI-S-004` — Submission Loading (Chờ xử lý kết quả)
- **Mục đích:** Buffer giữa lúc nộp bài (T+20) và lúc công bố leaderboard (T+22).
- **Thành phần:** Skeleton loader + thông báo "Đang chấm bài… kết quả sẽ công bố lúc 10h27".
- **Dependencies:** `FLOW-008`, `FLOW-009`.

#### `UI-S-005` — Leaderboard Screen (Vinh danh)
- **Mục đích:** Hiển thị Top N (mặc định 10) của khối từ 10h27 đến 10h30.
- **Thành phần:**
  - Bảng Top 10 — mỗi dòng là `UI-C-006`.
  - Highlight dòng của học sinh hiện tại nếu nằm trong Top.
  - Card kết quả cá nhân `UI-C-007` cố định phía dưới (đúng/sai, điểm, hạng).
- **Dependencies:** `DATA-M-007`, `DATA-M-006`, `FLOW-010`.

#### `UI-S-006` — Personal Result Screen (Kết quả cá nhân)
- **Mục đích:** Dành cho học sinh không lọt Top 10 hoặc muốn xem chi tiết.
- **Thành phần:** `UI-C-007` chi tiết + nút "Xem lại đáp án" (nếu enable trong config).
- **Dependencies:** `DATA-M-006`.

#### `UI-S-007` — Event Closed Screen
- **Mục đích:** Trạng thái sau 10h30 — countdown đến tuần sau.
- **Dependencies:** `DATA-M-002`.

---

### 1.2. Component dùng chung (Reusable Components)

| ID | Tên | Mô tả ngắn | Dùng tại |
|---|---|---|---|
| `UI-C-001` | Countdown Timer | Hiển thị đếm ngược; **đồng bộ với server time qua `SOCK-EVT-S09` mỗi 10 giây**, không tin client clock. | `UI-S-001`, `UI-S-002`, `UI-S-003` |
| `UI-C-002` | Online Counter Badge | Số học sinh trong phòng, **cập nhật qua `SOCK-EVT-S02` push**. | `UI-S-002` |
| `UI-C-003` | Question Card | Hiển thị câu hỏi + 4 phương án; phương án **đã được trộn từ server**, không trộn ở client. | `UI-S-003` |
| `UI-C-004` | Progress Bar | Đã trả lời / Tổng số câu; tăng khi nhận `SOCK-EVT-S05` ack. | `UI-S-003` |
| `UI-C-005` | Connection Status Indicator | Bind trực tiếp với socket state: `connected` (xanh), `reconnecting` (cam), `disconnected >5s` (đỏ). | `UI-S-003` |
| `UI-C-006` | Leaderboard Row | Avatar, tên, số câu đúng, thời gian, hạng. | `UI-S-005` |
| `UI-C-007` | Personal Stats Card | Đúng/Sai/Bỏ qua, điểm, hạng, thời gian hoàn thành. | `UI-S-005`, `UI-S-006` |
| `UI-C-008` | Grade Room Badge | Nhãn "Phòng Khối X". | `UI-S-002`, `UI-S-005` |
| `UI-C-009` | Auto-resume Notification | Toast "Đã khôi phục bài làm — bạn còn Y phút" — trigger khi nhận `SOCK-EVT-S04`. | `UI-S-003` |
| `UI-C-010` | Disconnect Warning Modal | Modal không chặn, vẫn cho làm bài offline, replay đáp án buffer khi socket reconnect. | `UI-S-003` |

---

### 1.3. Màn hình CMS (Operator-facing)

#### `UI-S-008` — Weekly Event List
- Danh sách các tuần thi (filter theo trạng thái: Draft / Scheduled / Live / Closed / Cancelled).
- Cột: số tuần, tiêu đề, ngày chạy, trạng thái, số khối đã gán đề, hành động.
- **Dependencies:** `DATA-M-002`.

#### `UI-S-009` — Weekly Event Detail / Edit
- Form cấu hình riêng cho 1 tuần: tiêu đề, ngày giờ ghi đè, gán đề theo 9 khối, ghi đè số câu, đổi trạng thái.
- Cảnh báo: không cho phép sửa khi trạng thái = `Live`.
- **Dependencies:** `DATA-M-002`, `DATA-M-004`, `FLOW-012`, `FLOW-014`.

#### `UI-S-010` — General Settings
- Form chỉnh `DATA-M-001`: waiting/exam/leaderboard duration, leaderboard limit, active grades, cron expression.
- **Cảnh báo:** thay đổi cron không ảnh hưởng tuần đã `Scheduled`, chỉ áp dụng cho tuần tạo mới.
- **Dependencies:** `DATA-M-001`, `FLOW-001`.

#### `UI-S-011` — Exam Bank & Assignment
- Quản lý ngân hàng đề, gán đề cụ thể cho từng khối của 1 tuần.
- **Dependencies:** `DATA-M-004`, `FLOW-014`.

#### `UI-S-012` — Real-time Monitoring Dashboard
- Trong lúc sự kiện đang chạy: số online / phòng, số bài đã nộp, latency trung bình, lỗi.
- Refresh 5s; có nút "Hủy phòng khẩn cấp" (chỉ super admin).
- **Dependencies:** `DATA-R-003`, `DATA-R-006`, `FLOW-013`, `FLOW-015`.

---

## Phần 2. Data Components

### 2.1. MongoDB Collections

#### `DATA-M-001` — `weeklyEventGeneralConfig`
Singleton document chứa cấu hình mặc định toàn hệ thống (mục IV.1 nghiệp vụ).

```json
{
  "_id": "singleton",
  "defaultWaitingDuration": 5,
  "defaultExamDuration": 20,
  "defaultLeaderboardDuration": 5,
  "leaderboardLimit": 10,
  "defaultActiveGrades": [1,2,3,4,5,6,7,8,9],
  "weeklyCronExpression": "0 10 * * 6",
  "timezone": "Asia/Ho_Chi_Minh",
  "updatedAt": "ISODate",
  "updatedBy": "userId"
}
```

#### `DATA-M-002` — `weeklyEvents`
Mỗi tuần là 1 document. Sinh tự động bởi `FLOW-001`.

```json
{
  "_id": "ObjectId",
  "weekNumber": 47,
  "year": 2026,
  "title": "Đấu Trường Số 47: Thử Thách Hình Học",
  "scheduledStartAt": "2026-06-13T03:00:00Z",
  "actualStartAt": null,
  "actualEndAt": null,
  "waitingDuration": 5,
  "examDuration": 20,
  "leaderboardDuration": 5,
  "questionCountOverride": 25,
  "activeGrades": [1,2,3,4,5,6,7,8,9],
  "status": "Scheduled",
  "examAssignments": {
    "1": "examId_grade1",
    "2": "examId_grade2",
    "...": "..."
  },
  "createdAt": "ISODate",
  "createdBy": "system|userId"
}
```

**Index:** `(status, scheduledStartAt)`, `(weekNumber, year)` unique.

#### `DATA-M-003` — `weeklyEventRooms`
Mỗi tuần × mỗi khối = 1 room document. Phân tách khỏi `weeklyEvents` để giảm contention khi cập nhật trạng thái song song.

```json
{
  "_id": "ObjectId",
  "eventId": "weeklyEventId",
  "grade": 5,
  "examId": "examId_grade5",
  "status": "Waiting | InProgress | Grading | Showing | Closed",
  "stateTransitions": [
    { "to": "Waiting", "at": "ISODate" },
    { "to": "InProgress", "at": "ISODate" }
  ],
  "participantCount": 0,
  "submittedCount": 0
}
```

**Index:** `(eventId, grade)` unique, `(status, eventId)`.

#### `DATA-M-004` — `examBank`
Ngân hàng đề. Mỗi đề là một document chứa metadata; câu hỏi có thể tách collection con nếu lớn.

```json
{
  "_id": "examId",
  "grade": 5,
  "title": "Hình học cơ bản — Đề 12",
  "subject": "Toán",
  "totalQuestions": 25,
  "questions": [
    {
      "questionId": "q_001",
      "stem": "...",
      "options": [{"key":"A","text":"..."}, ...],
      "correctKey": "B",
      "shuffleable": true
    }
  ],
  "createdAt": "ISODate"
}
```

#### `DATA-M-005` — `weeklyEventParticipations`
Một bản ghi cho mỗi học sinh × mỗi tuần. Sinh khi học sinh join phòng chờ.

```json
{
  "_id": "ObjectId",
  "eventId": "weeklyEventId",
  "roomId": "roomId",
  "studentId": "studentId",
  "grade": 5,
  "joinedAt": "ISODate",
  "examStartedAt": null,
  "submittedAt": null,
  "submissionType": "manual | auto_timeout | auto_disconnect",
  "disconnectCount": 0,
  "shuffleSeed": "random_seed_per_student"
}
```

**Index:** `(eventId, studentId)` unique, `(roomId, submittedAt)`.

#### `DATA-M-006` — `weeklyEventResults`
Kết quả cuối cùng — chỉ ghi 1 lần sau khi `FLOW-008` hoàn tất.

```json
{
  "_id": "ObjectId",
  "participationId": "ref to DATA-M-005",
  "eventId": "weeklyEventId",
  "roomId": "roomId",
  "studentId": "studentId",
  "correctCount": 23,
  "totalAnswered": 25,
  "totalTimeMs": 845000,
  "lastCorrectAnswerAt": "ISODate",
  "rank": 7,
  "score": 230,
  "answers": [
    { "questionId": "q_001", "selectedKey": "B", "isCorrect": true, "answeredAt": "ISODate" }
  ]
}
```

**Index:** `(eventId, roomId, rank)`, `(studentId, eventId)`.

#### `DATA-M-007` — `weeklyEventLeaderboardSnapshot`
Snapshot Top N của mỗi phòng — denormalized để truy vấn nhanh ở `UI-S-005`. Ghi 1 lần ở T+22.

```json
{
  "_id": "ObjectId",
  "eventId": "weeklyEventId",
  "roomId": "roomId",
  "grade": 5,
  "topN": [
    {
      "rank": 1,
      "studentId": "...",
      "displayName": "...",
      "avatarUrl": "...",
      "correctCount": 25,
      "totalTimeMs": 612000
    }
  ],
  "computedAt": "ISODate"
}
```

---

### 2.2. Redis Structures

> Tất cả key đều prefix `we:{eventId}:` để dễ scan / cleanup.
> TTL mặc định = end of event + 1 giờ để debug, sau đó tự xóa.

#### `DATA-R-001` — Active Session Cache
- **Key pattern:** `we:{eventId}:session:{studentId}`
- **Type:** Hash
- **Fields:** `roomId`, `examId`, `joinedAt`, `shuffleSeed`, `lastHeartbeatAt`
- **Mục đích:** Truy cập nhanh thông tin session khi học sinh reconnect; tránh roundtrip MongoDB.
- **TTL:** event end + 1h.

#### `DATA-R-002` — Real-time Leaderboard
- **Key pattern:** `we:{eventId}:lb:{grade}`
- **Type:** Sorted Set
- **Member:** `studentId`
- **Score:** số phức hợp `correctCount * 1e10 - totalTimeMs * 1e3 - lastCorrectTimestamp/1000`
  → cao hơn = hạng tốt hơn theo cả 3 tiêu chí (mục III.4 nghiệp vụ).
- **Mục đích:** `ZREVRANGE` lấy Top 10 trong O(log N + N).
- **TTL:** event end + 1h.

#### `DATA-R-003` — Online Participants
- **Key pattern:** `we:{eventId}:online:{grade}`
- **Type:** Set
- **Member:** `studentId`
- **Mục đích:** Đếm số online cho `UI-C-002`; phục vụ Monitoring Dashboard.
- **Cập nhật:** SADD khi join, SREM khi heartbeat timeout >30s hoặc submit xong.

#### `DATA-R-004` — Socket Connection State *(DEPRECATED — gộp vào `DATA-R-010`)*
- Trước đây dùng heartbeat key TTL để phát hiện disconnect. **Đã loại bỏ** vì socket `disconnect` event cho tín hiệu tức thời (sub-second) thay vì chờ TTL 30s. Mã định danh giữ lại để tránh nhầm lẫn ở các tài liệu cũ.

#### `DATA-R-005` — Answer Staging Buffer
- **Key pattern:** `we:{eventId}:answers:{studentId}`
- **Type:** Hash
- **Fields:** `q_001` → `{"key":"B","at":1718287654321}`, …
- **Mục đích:** Lưu tạm đáp án realtime; cho phép resume khi mất kết nối; chốt vào `DATA-M-006` ở `FLOW-008`.
- **TTL:** event end + 1h.

#### `DATA-R-006` — Room State Machine
- **Key pattern:** `we:{eventId}:roomstate:{grade}`
- **Type:** Hash
- **Fields:** `status`, `transitionedAt`, `nextTransitionAt`
- **Mục đích:** Truy cập trạng thái phòng cực nhanh cho mọi request; được scheduler `FLOW-002` cập nhật.
- **Đồng bộ:** sau mỗi transition, persist xuống `DATA-M-003`.

#### `DATA-R-007` — Distributed Lock (State Transition)
- **Key pattern:** `we:{eventId}:lock:transition:{grade}`
- **Type:** String + `SET NX EX 30`
- **Mục đích:** Đảm bảo chỉ 1 scheduler worker chuyển trạng thái phòng tại 1 thời điểm (idempotency khi chạy nhiều instance).

#### `DATA-R-008` — Submit Rate Limiter
- **Key pattern:** `we:{eventId}:rl:submit:{studentId}`
- **Type:** String (counter) hoặc dùng `INCR` + `EXPIRE`
- **Limit:** ≤ 5 submit/giây/học sinh để chống spam.

#### `DATA-R-009` — Auto-submit Worker Queue
- **Key pattern:** `we:{eventId}:autosubmit:queue`
- **Type:** Stream hoặc List
- **Mục đích:** Tại T+20, scheduler đẩy toàn bộ `studentId` chưa submit vào queue; worker pool tiêu thụ song song để chốt kết quả — tránh dồn ép DB tại 1 thời điểm.

#### `DATA-R-010` — Socket Session Mapping
- **Key pattern:** `we:{eventId}:socket:{studentId}` (hash) và `we:{eventId}:socket-reverse:{socketId}` (string).
- **Type:** Hash + String
- **Fields (hash):** `socketId`, `beInstanceId`, `connectedAt`, `lastActivityAt`, `disconnectedAt` (nullable).
- **Mục đích:**
  - Tra nhanh socket nào thuộc học sinh nào → để emit có chủ đích (`io.to(socketId)`).
  - Phát hiện multi-tab / multi-device: khi cùng `studentId` mở socket mới, BE disconnect socket cũ.
  - Phục vụ resume logic `FLOW-007`: khi reconnect, biết student trước đó ở đâu.
- **TTL:** event end + 1h; key string reverse có TTL 24h để debug.

---

### 2.3. Socket Events Contract

> **Stack đề xuất:** socket.io v4+ với Redis adapter (cho horizontal scale BE) hoặc native WebSocket + custom router. Tài liệu này dùng terminology socket.io.
>
> **Namespace:** `/we` cho học sinh, `/we-admin` cho CMS monitoring.
>
> **Rooms:**
> - `room:{eventId}:{grade}` — mỗi khối là 1 room (9 room/tuần).
> - `student:{studentId}` — room riêng cho từng học sinh để emit có chủ đích (multi-tab safe).
> - `admin:{eventId}` — room cho operator đang xem `UI-S-012`.
>
> **Authentication:** JWT trong handshake (`socket.handshake.auth.token`); BE verify → đính `studentId`, `grade` vào `socket.data`.

#### 2.3.1. Server → Client Events

| ID | Event name | Payload | Phát ở Flow | Mục đích |
|---|---|---|---|---|
| `SOCK-EVT-S01` | `room:state` | `{grade, status, transitionedAt, nextTransitionAt}` | `FLOW-002` | Broadcast state machine transition tới cả room. FE auto-route màn hình. |
| `SOCK-EVT-S02` | `room:online-count` | `{grade, count}` | `FLOW-003`, `FLOW-007` | Push khi có học sinh join/leave. Throttle 500ms để tránh storm. |
| `SOCK-EVT-S03` | `exam:start` | `{questions: [...], examStartedAt, examEndAt}` | `FLOW-005` | Broadcast tới cả room đúng tại T+5; thay vì FE phải gọi REST API. |
| `SOCK-EVT-S04` | `session:resume` | `{answers: {...}, currentQuestionIdx, remainingMs, status}` | `FLOW-007` | Emit riêng tới `student:{id}` khi reconnect. |
| `SOCK-EVT-S05` | `answer:ack` | `{questionId, savedAt, answeredCount}` | `FLOW-006` | Ack cho mỗi `SOCK-EVT-C02`. FE dùng để xác nhận đáp án đã lưu. |
| `SOCK-EVT-S06` | `room:leaderboard` | `{topN: [...], computedAt}` | `FLOW-010` | Broadcast tới cả room khi snapshot xong. |
| `SOCK-EVT-S07` | `personal:result` | `{correctCount, totalAnswered, rank, score, totalTimeMs}` | `FLOW-010` | Emit riêng tới `student:{id}` cùng lúc với `S06`. |
| `SOCK-EVT-S08` | `room:cancelled` | `{reason, cancelledAt}` | `FLOW-015` | Broadcast khi operator hủy sự kiện đột xuất. |
| `SOCK-EVT-S09` | `server:time` | `{serverTime, clientSentAt}` | mọi flow | Response cho `SOCK-EVT-C04`; FE tính clock skew = `serverTime - (clientSentAt + RTT/2)`. |
| `SOCK-EVT-S10` | `system:error` | `{code, message, retryable}` | mọi flow | Error chuẩn hóa: `EVENT_LATE`, `RATE_LIMITED`, `ALREADY_SUBMITTED`, `INVALID_STATE`. |
| `SOCK-EVT-S11` | `session:terminated` | `{reason: "new_login" \| "kicked"}` | `FLOW-007` | Khi học sinh mở tab thứ 2 ở thiết bị khác — disconnect socket cũ. |

#### 2.3.2. Client → Server Events

| ID | Event name | Payload | Xử lý ở Flow | Mục đích |
|---|---|---|---|---|
| `SOCK-EVT-C01` | `room:join` | `{}` (grade đọc từ `socket.data`) | `FLOW-003` | Sau khi handshake xong, FE emit để chính thức gia nhập room. |
| `SOCK-EVT-C02` | `answer:submit` | `{questionId, key}` | `FLOW-006` | Submit 1 đáp án. BE phản hồi `SOCK-EVT-S05`. |
| `SOCK-EVT-C03` | `session:request-resume` | `{}` | `FLOW-007` | FE chủ động yêu cầu state khi reconnect. |
| `SOCK-EVT-C04` | `time:sync` | `{clientTime}` | n/a | Time sync request; BE trả `SOCK-EVT-S09`. FE auto-gọi mỗi 10s. |
| `SOCK-EVT-C05` | `exam:submit-final` | `{}` | `FLOW-006` | Học sinh nhấn "Nộp bài sớm" → BE đóng buffer của student đó và bypass queue tại T+20. |

#### 2.3.3. Admin Namespace Events

| ID | Direction | Event name | Payload | Flow |
|---|---|---|---|---|
| `SOCK-EVT-A01` | S→C | `monitor:metrics` | `{grade, online, submitted, errorRate}` (mỗi grade) | `FLOW-013` |
| `SOCK-EVT-A02` | S→C | `monitor:alert` | `{level: "warn"\|"critical", code, message}` | `FLOW-013` |
| `SOCK-EVT-A03` | C→S | `monitor:subscribe` | `{eventId}` | `FLOW-013` |
| `SOCK-EVT-A04` | C→S | `event:cancel` | `{eventId, reason}` | `FLOW-015` |

#### 2.3.4. Connection Lifecycle & Edge Cases

- **`connection`:** BE verify JWT, lưu `DATA-R-010` mapping, join `student:{id}` room. Nếu phát hiện socket cũ của cùng `studentId` còn sống → emit `SOCK-EVT-S11` rồi disconnect socket cũ.
- **`disconnect`:** BE `SREM` khỏi `DATA-R-003`, cập nhật `DATA-R-010.disconnectedAt`, broadcast `SOCK-EVT-S02`. **Không** xóa `DATA-R-005` (cần giữ để resume).
- **Reconnect tự động:** socket.io client mặc định reconnect với exponential backoff; FE chỉ cần emit `SOCK-EVT-C03` sau khi connect lại.
- **Buffer đáp án ở FE:** khi socket offline, FE queue các `SOCK-EVT-C02` ở local; khi reconnect, replay theo thứ tự (server idempotent vì key là `questionId`).
- **Time sync:** RTT bù trừ theo NTP-style — FE lưu `clockSkew`, mọi countdown tính `serverNow = Date.now() + clockSkew`.

---

## Phần 3. Flow Components

### 3.1. Luồng tự động (Automation Flows)

#### `FLOW-001` — Weekly Event Auto-generation
- **Trigger:** Cron riêng chạy mỗi đêm Chủ nhật 00:00.
- **Logic:**
  1. Đọc `DATA-M-001` (cron expression, defaults).
  2. Tính ra thứ Bảy tiếp theo từ cron expression.
  3. Nếu chưa có document tương ứng trong `DATA-M-002` → tạo mới với `status="Draft"`.
  4. Tạo 9 document `DATA-M-003` tương ứng, để trống `examId` (chờ vận hành gán).
- **Output:** UI vận hành thấy tuần mới ở `UI-S-008` với cảnh báo "Chưa gán đề".

#### `FLOW-002` — Event State Machine Lifecycle
Đây là **trái tim** của hệ thống — driver thời gian server-side.

```
[Draft]
  └─ (Operator publish) ───────┐
                               ▼
[Scheduled] ──(T-0: 10h00)──► [Waiting] ──(T+5)──► [InProgress] ──(T+25 OR all submitted)──► [Grading] ──(T+27)──► [Showing] ──(T+30)──► [Closed]
                                                                                                                       ▲
                                                                                              (Operator cancel) ───────┘
                                                                                                              [Cancelled]
```

- **Implementation:** Quartz-like scheduler hoặc agenda + Redis lock (`DATA-R-007`).
- **Mỗi transition:**
  1. Acquire `DATA-R-007` lock.
  2. Cập nhật `DATA-R-006` (state Redis — ưu tiên đọc).
  3. Persist xuống `DATA-M-003`.
  4. Emit `SOCK-EVT-S01` tới room `room:{eventId}:{grade}` qua Redis adapter (broadcast tới mọi BE instance).
  5. Nếu state mới là `InProgress` → trigger `FLOW-005` để đẩy đề (`SOCK-EVT-S03`).
  6. Release lock.
- **Idempotency:** Mỗi transition có `idempotencyKey = {eventId}:{grade}:{toState}`; nếu đã chạy → bỏ qua.

#### `FLOW-008` — Auto Final Submission at T+25
- **Trigger:** scheduler tại đúng T+25 mỗi phòng.
- **Logic:**
  1. Phòng chuyển sang `Grading`.
  2. Đọc toàn bộ key `we:{eventId}:answers:*` của phòng.
  3. Push vào `DATA-R-009` queue.
  4. Worker pool (5–10 worker) tiêu thụ song song:
     - Đối chiếu với `DATA-M-004` để chấm điểm.
     - Ghi 1 document vào `DATA-M-006`.
     - Cập nhật `DATA-R-002` (sorted set) với score phức hợp.
  5. Khi queue empty → trigger `FLOW-009`.
- **Critical:** không gọi DB cho từng câu — batch theo student, dùng `bulkWrite`.

#### `FLOW-009` — Leaderboard Calculation & Snapshot
- **Trigger:** sau khi `FLOW-008` hoàn tất hoặc tại T+27 (whichever earlier).
- **Logic:**
  1. `ZREVRANGE we:{eventId}:lb:{grade} 0 N-1 WITHSCORES` lấy top N.
  2. JOIN với `DATA-M-005` lấy displayName, avatar.
  3. Ghi 1 document `DATA-M-007` (snapshot bất biến).
  4. Cập nhật `rank` ngược lại vào `DATA-M-006` cho TẤT CẢ học sinh (không chỉ top).

---

### 3.2. Luồng học sinh (Student Flows)

#### `FLOW-003` — Join Room
- **Trigger:** Học sinh nhấn "Tham gia" trên `UI-S-001`.
- **Logic (2 pha):**

  **Pha 1 — REST handshake** (`POST /we/{eventId}/join`):
  1. BE check `DATA-R-006` state phòng tương ứng grade của học sinh.
  2. Nếu state ∈ `{Waiting, InProgress}` (cho phép join muộn đến T+5):
     - Upsert `DATA-M-005` theo `(eventId, studentId)`.
     - Sinh `shuffleSeed` (nếu chưa có).
     - Cấp socket token (JWT short-lived 60s) chứa `studentId`, `eventId`, `grade`.
  3. Trả về `{roomId, status, nextTransitionAt, socketToken, socketUrl}`.

  **Pha 2 — Socket connect:**
  1. FE connect tới `socketUrl` với `auth.token = socketToken`.
  2. BE verify token, tạo `DATA-R-010` mapping, `SADD` vào `DATA-R-003`.
  3. Socket auto-join `room:{eventId}:{grade}` và `student:{studentId}`.
  4. BE broadcast `SOCK-EVT-S02` (online count updated) tới room.
  5. Nếu state đã là `InProgress` → emit `SOCK-EVT-S03` tới socket vừa kết nối (catch-up).

- **Edge:** join sau T+5 → Pha 1 trả lỗi `EVENT_LATE`, không cấp socket token.

#### `FLOW-004` — Waiting Room Realtime Updates
- **Kênh duy nhất:** WebSocket trong socket room `room:{eventId}:{grade}`. Không có HTTP polling fallback (đã loại bỏ vì thêm complexity và không cần thiết với socket.io reconnect).
- **Push events trong giai đoạn Waiting:**
  - `SOCK-EVT-S02` — mỗi khi có học sinh join/leave, throttle 500ms.
  - `SOCK-EVT-S09` — mỗi 10s tự động đẩy server time để FE sync countdown.
  - `SOCK-EVT-S01` — khi state chuyển sang `InProgress`, FE chuyển sang `UI-S-003`.
- **Nếu socket.io reconnect không thành công sau N lần:** FE hiển thị fullscreen error + nút "Tải lại trang"; không có cơ chế HTTP fallback vì không thể đảm bảo realtime acceptable.

#### `FLOW-005` — Question Delivery
- **Trigger:** `FLOW-002` chuyển state phòng sang `InProgress`.
- **Logic:**
  1. BE đọc `DATA-M-004` theo `examId` của phòng (đã cache in-memory vì 9 đề cố định mỗi tuần).
  2. Với mỗi student trong room (lấy từ `DATA-R-003`):
     - Áp shuffle dùng `shuffleSeed` cá nhân từ `DATA-R-001`/`DATA-M-005`.
     - Loại bỏ `correctKey` khỏi payload.
  3. Emit `SOCK-EVT-S03` **per student** (vì payload khác nhau do shuffle riêng) tới `student:{studentId}` room.
- **Tối ưu hóa khi room đông (>5k students):**
  - Pre-compute toàn bộ shuffled payload ngay khi state transition, lưu tạm Redis (`we:{eventId}:shuffled:{studentId}` TTL 30 phút).
  - Worker pool emit song song, không block scheduler.
- **Edge:** học sinh reconnect sau khi đã emit `S03` → server gửi lại qua `SOCK-EVT-S04` (resume).

#### `FLOW-006` — Answer Submission (Per Question)
- **Trigger:** học sinh chọn đáp án trên `UI-S-003`, FE emit `SOCK-EVT-C02 {questionId, key}`.
- **Logic ở BE handler:**
  1. Validate state: phòng phải `InProgress`, student phải thuộc room đúng — nếu không, emit `SOCK-EVT-S10 {code: INVALID_STATE}`.
  2. Rate limit qua `DATA-R-008` — nếu vượt, emit `SOCK-EVT-S10 {code: RATE_LIMITED}`.
  3. `HSET we:{eventId}:answers:{studentId} {questionId} {key, ts}` vào `DATA-R-005`.
  4. **KHÔNG chấm điểm tại đây** — chỉ lưu raw. Tránh lộ đáp án qua timing attack.
  5. Emit `SOCK-EVT-S05 {questionId, savedAt, answeredCount}` về `student:{studentId}` để FE cập nhật progress bar.
- **Latency target:** < 30ms (socket in-process + Redis HSET, không qua HTTP layer).
- **Idempotency:** key trong hash là `questionId` → submit lại cùng câu sẽ ghi đè, không tạo duplicate.
- **Submit-final flow:** học sinh nhấn "Nộp bài sớm" → FE emit `SOCK-EVT-C05`. BE:
  1. Đẩy `studentId` vào `DATA-R-009` queue ngay lập tức (bypass T+25).
  2. Đánh dấu `submissionType="manual"` ở `DATA-M-005`.
  3. Emit `SOCK-EVT-S07` ngay sau khi worker chấm xong (không chờ leaderboard chung).

#### `FLOW-007` — Disconnect Detection & Auto-resume
- **Detect (tức thời, không TTL):**
  - Socket.io fire event `disconnect` trên server ngay khi TCP/WS đóng (thường < 1s).
  - BE handler:
    1. Cập nhật `DATA-R-010.disconnectedAt = now`.
    2. `SREM` khỏi `DATA-R-003`.
    3. Tăng `disconnectCount` ở `DATA-M-005`.
    4. Broadcast `SOCK-EVT-S02` (online count -1) tới room.
  - **Không** xóa `DATA-R-005` (đáp án) hay `DATA-R-001` (session) — cần giữ để resume.
- **Resume:**
  - Socket.io client tự reconnect với exponential backoff. Khi reconnect:
    1. FE emit `SOCK-EVT-C03 (session:request-resume)`.
    2. BE đọc `DATA-R-006` (room state) + `DATA-R-005` (answers buffer) + shuffled questions cache.
    3. Tùy state:
       - `Waiting` → emit `SOCK-EVT-S01` để FE route về `UI-S-002`.
       - `InProgress` → emit `SOCK-EVT-S04 {questions, answers, remainingMs, status}`. FE hiển thị `UI-C-009`, route `UI-S-003`.
       - `Grading` → emit `SOCK-EVT-S10 {code: PENDING_RESULTS}`, FE route `UI-S-004`.
       - `Showing` → emit `SOCK-EVT-S06` + `SOCK-EVT-S07`, FE route `UI-S-005`.
       - `Closed` → emit `SOCK-EVT-S07` + close socket.
  - Đồng bộ thời gian: `remainingMs` luôn tính theo server time, FE không tự đếm thời gian disconnect.
- **Multi-tab / cướp session:**
  - Khi cùng `studentId` mở socket mới ở thiết bị khác:
    1. BE phát hiện qua `DATA-R-010` (socket cũ vẫn `connected`).
    2. Emit `SOCK-EVT-S11 {reason: "new_login"}` tới socket cũ rồi disconnect.
    3. Cập nhật `DATA-R-010` với socketId mới.

#### `FLOW-010` — Leaderboard Display
- **Trigger:** `FLOW-009` hoàn tất tạo snapshot ở T+27.
- **Logic:**
  1. BE emit `SOCK-EVT-S06 {topN}` broadcast tới `room:{eventId}:{grade}` → FE update `UI-S-005`.
  2. BE emit `SOCK-EVT-S07 {correctCount, rank, score, ...}` **riêng tới từng `student:{studentId}`** dựa trên `DATA-M-006` → FE update `UI-C-007`.
  3. FE không cần REST call để lấy kết quả cá nhân — đã push qua socket.
- **Học sinh reconnect ở giai đoạn này:**
  - Trong `FLOW-007` đã xử lý → khi state = `Showing`, emit lại cả `S06` và `S07`.
- **Sau T+30 (state = `Closed`):** BE đóng socket toàn room, FE chuyển sang `UI-S-007`.
- **Truy cập lại sau sự kiện:** không qua socket nữa, dùng REST `GET /we/history/{studentId}` để xem kết quả các tuần đã qua.

---

### 3.3. Luồng vận hành CMS (Operator Flows)

#### `FLOW-012` — Weekly Event Configuration & Publishing
1. Operator mở `UI-S-009` của tuần `Draft`.
2. Gán đề cho 9 khối (qua `UI-S-011`), điều chỉnh tiêu đề, ngày giờ ghi đè nếu trùng lễ.
3. Validate: tất cả `activeGrades` phải có `examId` → mới cho phép chuyển `Scheduled`.
4. Chuyển `Scheduled` → trigger validation lần 2, lock các trường đề thi.

#### `FLOW-013` — Real-time Monitoring
- **Kênh:** Admin socket namespace `/we-admin`, operator emit `SOCK-EVT-A03 (monitor:subscribe)` để join room `admin:{eventId}`.
- **Server push (interval 2s, không 5s như HTTP polling):**
  - BE worker đọc `SCARD we:{eventId}:online:{grade}` cho 9 grade, `submittedCount` từ `DATA-M-003`, P50/P95 từ in-memory metric collector.
  - Emit `SOCK-EVT-A01 {grade, online, submitted, errorRate}` cho từng grade tới room `admin:{eventId}`.
- **Alert push (event-driven, không poll):**
  - Khi anomaly detector trigger (`participantCount` ở `Waiting` vs `submittedCount` ở `InProgress` chênh >10%, hoặc error rate spike) → emit `SOCK-EVT-A02 {level, code, message}` ngay.
- **Lợi ích so với HTTP polling 5s:**
  - Latency thấy alert: từ 5s xuống <100ms.
  - Tải BE giảm: 1 worker tính metric duy nhất rồi broadcast, thay vì mỗi operator gọi 1 request.

#### `FLOW-014` — Exam Assignment
- Trên `UI-S-011`, operator chọn đề từ `DATA-M-004` cho từng khối.
- Validation: `examBank.grade` phải khớp `room.grade`.
- Lưu vào `DATA-M-002.examAssignments` đồng thời `DATA-M-003.examId`.

#### `FLOW-015` — Manual Cancel / Reschedule
- Chỉ super admin, chỉ áp dụng khi state ∈ `{Scheduled, Waiting, InProgress}`.
- Operator trên `UI-S-012` emit `SOCK-EVT-A04 (event:cancel) {eventId, reason}`.
- BE:
  1. Verify quyền super admin.
  2. Set `DATA-M-002.status = Cancelled`.
  3. Set tất cả `DATA-M-003.status = Cancelled`.
  4. Cập nhật `DATA-R-006` state 9 phòng → `Cancelled`.
  5. Broadcast `SOCK-EVT-S08 {reason, cancelledAt}` tới TẤT CẢ 9 socket room `room:{eventId}:*` → FE chuyển sang `UI-S-007` với thông báo hủy.
  6. Disconnect toàn bộ socket trong các room sau 2s grace để FE kịp render thông báo.
  7. Schedule cleanup job xóa toàn bộ Redis keys của event sau 1h (để debug nếu cần).

---

## Phần 4. Ma trận liên kết Component (Cross-reference)

### 4.1. UI ↔ Data

| UI | Đọc từ | Ghi vào |
|---|---|---|
| `UI-S-001` | `DATA-R-006`, `DATA-M-002` | — |
| `UI-S-002` | `DATA-R-003`, `DATA-R-006`, `DATA-M-002` | `DATA-R-001`, `DATA-M-005` (qua join) |
| `UI-S-003` | `DATA-M-004` (qua API), `DATA-R-005` | `DATA-R-005`, `DATA-R-004` |
| `UI-S-005` | `DATA-M-007`, `DATA-M-006` | — |
| `UI-S-006` | `DATA-M-006` | — |
| `UI-S-008` | `DATA-M-002` | — |
| `UI-S-009` | `DATA-M-002`, `DATA-M-004` | `DATA-M-002`, `DATA-M-003` |
| `UI-S-010` | `DATA-M-001` | `DATA-M-001` |
| `UI-S-011` | `DATA-M-004`, `DATA-M-002` | `DATA-M-002`, `DATA-M-003` |
| `UI-S-012` | `DATA-R-003`, `DATA-R-006`, `DATA-M-003` | — |

### 4.2. Flow ↔ Data

| Flow | Đọc | Ghi |
|---|---|---|
| `FLOW-001` | `DATA-M-001` | `DATA-M-002`, `DATA-M-003` |
| `FLOW-002` | `DATA-M-002`, `DATA-M-003`, `DATA-R-007` | `DATA-R-006`, `DATA-M-003` |
| `FLOW-003` | `DATA-R-006`, `DATA-M-002` | `DATA-M-005`, `DATA-R-003`, `DATA-R-010` |
| `FLOW-005` | `DATA-M-004`, `DATA-R-001`/`DATA-M-005` | `we:{eventId}:shuffled:*` (cache) |
| `FLOW-006` | `DATA-R-008`, `DATA-R-006` | `DATA-R-005` |
| `FLOW-007` | `DATA-R-010`, `DATA-R-005`, `DATA-R-006` | `DATA-R-003`, `DATA-R-010`, `DATA-M-005` |
| `FLOW-008` | `DATA-R-005`, `DATA-M-004` | `DATA-M-006`, `DATA-R-002`, `DATA-R-009` |
| `FLOW-009` | `DATA-R-002`, `DATA-M-005`, `DATA-M-006` | `DATA-M-007`, `DATA-M-006` |
| `FLOW-015` | `DATA-M-002`, `DATA-M-003` | `DATA-M-002`, `DATA-M-003`, Redis cleanup |

### 4.3. Flow ↔ Socket Events

| Flow | Phát (S→C) | Nhận (C→S) |
|---|---|---|
| `FLOW-002` | `SOCK-EVT-S01`, `SOCK-EVT-S03` | — |
| `FLOW-003` | `SOCK-EVT-S02` | `SOCK-EVT-C01` |
| `FLOW-004` | `SOCK-EVT-S01`, `SOCK-EVT-S02`, `SOCK-EVT-S09` | `SOCK-EVT-C04` |
| `FLOW-005` | `SOCK-EVT-S03` | — |
| `FLOW-006` | `SOCK-EVT-S05`, `SOCK-EVT-S10` | `SOCK-EVT-C02`, `SOCK-EVT-C05` |
| `FLOW-007` | `SOCK-EVT-S04`, `SOCK-EVT-S02`, `SOCK-EVT-S11` | `SOCK-EVT-C03` |
| `FLOW-010` | `SOCK-EVT-S06`, `SOCK-EVT-S07` | — |
| `FLOW-013` | `SOCK-EVT-A01`, `SOCK-EVT-A02` | `SOCK-EVT-A03` |
| `FLOW-015` | `SOCK-EVT-S08` | `SOCK-EVT-A04` |

### 4.4. UI ↔ Socket Events

| UI | Lắng nghe | Phát |
|---|---|---|
| `UI-S-002` | `SOCK-EVT-S01`, `SOCK-EVT-S02`, `SOCK-EVT-S03`, `SOCK-EVT-S09` | `SOCK-EVT-C01`, `SOCK-EVT-C04` |
| `UI-S-003` | `SOCK-EVT-S04`, `SOCK-EVT-S05`, `SOCK-EVT-S09`, `SOCK-EVT-S10`, `SOCK-EVT-S11` | `SOCK-EVT-C02`, `SOCK-EVT-C03`, `SOCK-EVT-C04`, `SOCK-EVT-C05` |
| `UI-S-004` | `SOCK-EVT-S06`, `SOCK-EVT-S07` | — |
| `UI-S-005` | `SOCK-EVT-S06`, `SOCK-EVT-S07` | — |
| `UI-S-007` | `SOCK-EVT-S08` (nguồn route) | — |
| `UI-S-012` | `SOCK-EVT-A01`, `SOCK-EVT-A02` | `SOCK-EVT-A03`, `SOCK-EVT-A04` |

---

## Phần 5. Lưu ý kỹ thuật quan trọng

### 5.1. Chống gian lận (Anti-cheat)
- **Server time qua socket time-sync:** FE emit `SOCK-EVT-C04 {clientTime}` mỗi 10s, BE phản hồi `SOCK-EVT-S09 {serverTime, clientSentAt}`. FE tính `clockSkew = serverTime - (clientSentAt + RTT/2)`. Mọi countdown render dùng `Date.now() + clockSkew`. Client clock thuần túy KHÔNG được tin.
- **Không trả `correctKey`:** đáp án đúng chỉ ở BE; chấm điểm tập trung ở `FLOW-008`.
- **Shuffle per-student:** mỗi học sinh có `shuffleSeed` riêng → không thể chia sẻ vị trí đáp án.
- **Single active socket per student:** `DATA-R-010` + `SOCK-EVT-S11` đảm bảo 1 student chỉ có 1 connection sống → không thể mở nhiều tab cùng làm bài.
- **Socket auth:** JWT short-lived 60s ở handshake; sau khi connect thì dùng `socket.data` (không tin client gửi lại studentId qua mỗi event).

### 5.2. Scale & Resilience
- **Stateless BE:** tất cả state ở Redis + MongoDB, BE node có thể horizontal scale.
- **Socket.io Redis adapter:** mọi `io.to(room).emit(...)` được fan-out qua Redis Pub/Sub tới tất cả BE instance — học sinh trong cùng room có thể connect tới các instance khác nhau.
- **Sticky session ở Load Balancer:** WebSocket cần sticky session (theo `connection.id` hoặc cookie) — KHÔNG round-robin. Cấu hình ALB/Nginx `ip_hash` hoặc dùng `polling+upgrade` của socket.io.
- **Hot path không chạm Mongo:** `FLOW-006` (submit) hoàn toàn trong socket handler + Redis — endpoint chịu tải cao nhất.
- **Bulk write tại `FLOW-008`:** dùng `bulkWrite` MongoDB batch theo grade (1k–5k bản ghi/batch).
- **Worker pool tách riêng:** worker chấm điểm và worker tính metrics chạy ở process khác main socket server, tránh block event loop khi 10k+ học sinh nộp đồng thời.
- **Connection cap:** mỗi BE instance giới hạn ~10k concurrent socket; tính trước số instance dựa trên peak load (vd. 50k học sinh × 9 grade chia 5 instance).

### 5.3. Quan sát (Observability)
- Log mỗi state transition của `FLOW-002` với `eventId`, `grade`, `from`, `to`, `durationMs`.
- Log socket lifecycle: `connect`, `disconnect`, `reconnect` với `studentId`, `socketId`, `beInstanceId`, `reason`.
- Metric: số socket connection / BE instance, số học sinh / phòng / state, latency emit P95, số `SOCK-EVT-S05` ack/giây, số disconnect/resume, số auto-submit.
- Alert: nếu `participantCount` ở `Waiting` mà `submittedCount` ở `InProgress` chênh > 10% → có thể có sự cố mạng diện rộng → đẩy qua `SOCK-EVT-A02`.

### 5.4. Ràng buộc cần làm rõ thêm (Open Questions)
- Học sinh được vào phòng muộn nhất là khi nào? Tài liệu nghiệp vụ không nói rõ — đề xuất khóa join tại T+5 (lúc phát đề). Cần confirm.
- Có cho phép "xem lại đáp án" sau khi kết thúc không? Hiện đang giả định KHÔNG, để tránh phát tán đề.
- Trường hợp số học sinh trong 1 khối quá lớn (vd. >50k), có cần sharding socket room theo region không? Hiện thiết kế gộp toàn quốc 1 room/grade — cần benchmark.
- Có cần fallback HTTP long-polling cho học sinh ở mạng chặn WebSocket (firewall trường học)? socket.io đã hỗ trợ sẵn `transports: ['polling', 'websocket']` với upgrade tự động — đề xuất giữ mặc định.

---

**Tài liệu này đặt nền cho:** API contract, ERD chi tiết, deployment topology, và bộ test case end-to-end. Sẽ làm tiếp ở giai đoạn 2.
