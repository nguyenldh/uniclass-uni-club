# TÀI LIỆU GIẢI PHÁP — TÍNH NĂNG "SĂN BOSS" (BOSS BATTLE TUẦN)

> Tài liệu mô tả giải pháp triển khai dành cho đội phát triển. Gồm 3 nhóm thành phần: **UI Components**, **Data Components**, **Flow Components**. Các thành phần được liên kết với nhau bằng **mã định danh (ID)**.

---

## 0. QUY ƯỚC MÃ ĐỊNH DANH (ID CONVENTION)

| Tiền tố | Loại thành phần | Ví dụ |
|---|---|---|
| `SCR-xx` | Màn hình (Screen) | `SCR-01` Sảnh Săn Boss |
| `UI-xxx` | Thành phần giao diện (UI Component) | `UI-101` Boss Display |
| `DM-xx` | Mô hình dữ liệu (Data Model) | `DM-03` StudentBossProgress |
| `CFG-xx` | Tham số cấu hình CMS | `CFG-01` Boss HP |
| `FLW-xx` | Luồng xử lý (Flow) | `FLW-05` Tính điểm câu trả lời |

Cách đọc liên kết: mỗi UI Component ghi rõ nó **đọc/ghi** Data Model nào; mỗi Flow ghi rõ nó **kích hoạt từ** màn hình/sự kiện nào, **đọc/ghi** Data Model nào.

---

## 1. BẢN ĐỒ TỔNG QUAN (COMPONENT MAP)

```
SCR-01 Sảnh ──Chiến đấu──▶ SCR-02 Battle ──Nộp──▶ SCR-03 Result
   │                                                   │
   └──Xem BXH──▶ SCR-04 Leaderboard                    └──Cộng dồn──▶ cập nhật DM-02 BossInstance
                      │
                      └── SCR-05 Vinh danh (cuối tuần)

Cron 00h hằng ngày ──▶ FLW-02 Mở khóa câu hỏi ngày
Cron 00h Thứ Hai  ──▶ FLW-01 Khởi tạo Boss tuần + FLW-08 Chốt vinh danh tuần trước
```

---

## 2. UI COMPONENTS

### SCR-01 — Màn hình Sảnh Săn Boss (Boss Lobby)
Màn hình đích khi học sinh (HS) mở tab Săn Boss. Hiển thị trạng thái Boss tuần hiện tại của khối lớp HS.

| ID | Thành phần | Mô tả | Dữ liệu liên kết |
|---|---|---|---|
| `UI-101` | Boss Display | Ảnh Boss thay đổi theo mốc % HP còn lại (normal / injured / rage). Đọc bộ ảnh từ `CFG-08`. | `DM-02` (currentHp, hpMaxConfig), `DM-01.bossStates` |
| `UI-102` | Progress Bar | Thanh tiến độ % = `totalPointsEarned / hpMax * 100`. Có hiệu ứng fill-up. | `DM-02.progressPercent` |
| `UI-103` | Daily Quota Badge | Nhãn "Câu hỏi hôm nay: x/5" (mặc định 5 từ `CFG-02`). | `DM-04` (số câu còn lại trong ngày) |
| `UI-104` | Weekly Reset Countdown | Đồng hồ đếm ngược tới 00h00 Thứ Hai kế tiếp. | tính từ server time |
| `UI-105` | Battle CTA Button | Nút "Chiến đấu". Vô hiệu hóa nếu HS đã làm hết câu của ngày. | `DM-04.status` |
| `UI-106` | Boss Name Label | Tên Boss tuần. | `DM-01.bossName` (`CFG-07`) |

> Trạng thái nút `UI-105`: nếu `DM-04` của ngày hôm nay đã `COMPLETED` → "Đã hoàn thành hôm nay" (disabled). Nếu Boss đã bị hạ (`DM-02.status=DEFEATED`) → "Boss đã bị hạ gục — chờ đợt tuần sau" (disabled, **khóa toàn bộ lượt làm còn lại của tuần**).

### SCR-02 — Màn hình Chiến đấu (Battle / Question)
Hiển thị lần lượt từng câu hỏi của lượt ngày, có đồng hồ bấm giờ phục vụ tính điểm tốc độ.

| ID | Thành phần | Mô tả | Dữ liệu liên kết |
|---|---|---|---|
| `UI-201` | Question Card | Nội dung câu hỏi + hình ảnh (nếu có). | `DM-06.content` |
| `UI-202` | Answer Options | Danh sách lựa chọn (trắc nghiệm). | `DM-06.options` |
| `UI-203` | Per-question Timer | Đồng hồ tính bằng giây, bắt đầu khi câu hiện ra, dừng khi HS chọn đáp án. Trần đếm = `CFG-05` (T_max). | ghi `DM-07.responseTimeSec` |
| `UI-204` | Question Index | Chỉ số "Câu i/5". | `DM-04` |

### SCR-03 — Màn hình Kết quả (Result)
Hiển thị ngay sau khi hoàn thành lượt ngày.

| ID | Thành phần | Mô tả | Dữ liệu liên kết |
|---|---|---|---|
| `UI-301` | Correct Count | Số câu đúng trong lượt. | `DM-04.correctCount` |
| `UI-302` | Total Time | Tổng thời gian trả lời lượt. | `DM-04.totalResponseTime` |
| `UI-303` | Points Contributed | Điểm đóng góp tích lũy lượt này (đã gồm speed bonus). | `DM-04.pointsEarned` |
| `UI-304` | Progress Animation | Hiệu ứng Boss bị trừ máu + progress bar nhích lên. | `DM-02` |
| `UI-305` | View Leaderboard CTA | Điều hướng sang `SCR-04`. | — |

### SCR-04 — Màn hình Bảng xếp hạng (Leaderboard)
BXH riêng của Boss Battle, phân theo **khối lớp**, cập nhật real-time.

| ID | Thành phần | Mô tả | Dữ liệu liên kết |
|---|---|---|---|
| `UI-401` | Podium Top 3 | Bục 3D Top 1/2/3, avatar lớn, vương miện Vàng/Bạc/Đồng, hào quang. | `DM-08` (rank 1–3) |
| `UI-402` | Rank List | Danh sách xếp hạng cuộn được (rank 4 trở đi). | `DM-08` |
| `UI-403` | My Rank Card (Sticky) | Thẻ cá nhân ghim cạnh dưới, không cuộn theo. Hiển thị `#hạng`, "x/`questionsPerWeek` câu", "t giây" (`totalCorrectTimeSec`). Nếu chưa làm → "Chưa xếp hạng" / "-". | `DM-03`, `DM-08.myEntry` |
| `UI-404` | Grade Filter | Bộ lọc/khóa theo khối lớp của HS (mặc định khối của HS). | `DM-01.gradeLevel` |

### SCR-05 — Vinh danh & Phần thưởng (Honor — cuối tuần)
Áp dụng Top 10 mỗi khối sau khi `FLW-08` chạy.

| ID | Thành phần | Mô tả | Dữ liệu liên kết |
|---|---|---|---|
| `UI-501` | Home Banner Carousel | Banner trang chủ luân phiên Top 10 (tên + lớp/trường), hiển thị suốt tuần kế tiếp. | `DM-09` |
| `UI-502` | Weekly Avatar Frame | Khung avatar giới hạn "Dũng sĩ diệt Boss", hiệu lực 7 ngày. | `DM-09.frameExpiry` |
| `UI-503` | Honor Hall Podium | Bục vinh danh tại sảnh sự kiện cho Top 3 tuần trước. | `DM-09` |

---

## 3. DATA COMPONENTS

> Quy ước: `PK` = khóa chính, `FK` = khóa ngoại. Trường thời gian dùng UTC, có cấu hình timezone hệ thống cho mốc 00h00.

### DM-01 — `BossConfig` (Cấu hình Boss theo tuần × khối)
Bản ghi cấu hình do CMS tạo, áp cho một chu kỳ tuần và một khối lớp.

| Trường | Kiểu | Mô tả | Tham số CMS |
|---|---|---|---|
| `id` | UUID | PK | — |
| `weekKey` | string | Định danh tuần (vd `2026-W23`). | — |
| `gradeLevel` | int/string | Khối lớp áp dụng. | — |
| `hpMax` | number | Tổng HP Boss. Mặc định 50000. | `CFG-01` |
| `questionsPerDay` | int | Số câu/ngày. Mặc định 5. | `CFG-02` |
| `questionsPerWeek` | int | Tổng số câu cả tuần (config được). Mặc định 35. Quan hệ tham chiếu: `questionsPerDay × số ngày mở`. Dùng làm mẫu số cho "x/35 câu". | `CFG-02b` |
| `basePoint` | number | Điểm cơ bản x mỗi câu đúng. Mặc định 10. | `CFG-03` |
| `maxSpeedBonus` | number | Điểm thưởng tốc độ tối đa. Mặc định 5. | `CFG-04` |
| `tMaxSec` | int | Thời gian tối đa/câu (giây). Mặc định 60. | `CFG-05` |
| `bossName` | string | Tên Boss. Mặc định "Hắc Long Tri Thức". | `CFG-07` |
| `bossStates` | json | Danh sách mốc %HP → ảnh. Vd `[{"min":71,"max":100,"img":"boss_dragon_normal.png"}, ...]`. | `CFG-08` |

### DM-02 — `BossInstance` (Phiên Boss đang chạy)
Một bản ghi cho mỗi (tuần × khối). Theo dõi tiến trình tổng.

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | UUID | PK |
| `bossConfigId` | FK → `DM-01` | Cấu hình áp dụng |
| `weekKey` | string | Tuần |
| `gradeLevel` | int/string | Khối |
| `totalPointsEarned` | number | Tổng điểm mọi HS đã đóng góp |
| `progressPercent` | number | `min(100, totalPointsEarned/hpMax*100)` (cache) |
| `currentBossStateImg` | string | Ảnh trạng thái hiện tại (cache, suy ra từ %HP) |
| `status` | enum | `ACTIVE` / `DEFEATED` / `CLOSED` |

### DM-03 — `StudentBossProgress` (Tiến độ cá nhân/tuần)
Một bản ghi cho mỗi (HS × tuần). Là nguồn dữ liệu xếp hạng.

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | UUID | PK |
| `studentId` | FK → User | HS |
| `bossInstanceId` | FK → `DM-02` | Phiên Boss |
| `weekKey` | string | Tuần |
| `correctCountWeek` | int | Tổng câu đúng tuần (tối đa = `questionsPerWeek`). **Tiêu chí xếp hạng #1** |
| `totalCorrectTimeSec` | number | Tổng thời gian các câu **đúng** (giây). **Tiêu chí #2** (nhỏ hơn = trên) |
| `lastAchievedAt` | datetime | Thời điểm đạt mốc thành tích hiện tại. **Tiêu chí #3** (sớm hơn = trên) |
| `pointsContributedWeek` | number | Tổng điểm cá nhân góp vào Boss |

### DM-04 — `DailyAttempt` (Lượt làm bài theo ngày)
Một bản ghi cho mỗi (HS × ngày).

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | UUID | PK |
| `studentId` | FK → User | HS |
| `bossInstanceId` | FK → `DM-02` | Phiên Boss |
| `dateKey` | date | Ngày (theo timezone hệ thống) |
| `questionSetId` | FK → `DM-05` | Bộ câu hỏi của ngày |
| `status` | enum | `LOCKED` / `IN_PROGRESS` / `COMPLETED` |
| `correctCount` | int | Câu đúng trong lượt |
| `totalResponseTime` | number | Tổng thời gian lượt (giây) |
| `pointsEarned` | number | Điểm lượt (gồm speed bonus) |
| `completedAt` | datetime | Thời điểm hoàn thành |

### DM-05 — `QuestionSet` (Bộ câu hỏi theo ngày × khối)
| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | UUID | PK |
| `weekKey` | string | Tuần |
| `gradeLevel` | int/string | Khối |
| `dayIndex` | int | Ngày trong tuần (1–7) |
| `questionIds` | array FK → `DM-06` | Danh sách câu hỏi (đúng `questionsPerDay` câu) |

### DM-06 — `Question`
| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | UUID | PK |
| `content` | text/json | Đề bài (+ ảnh nếu có) |
| `options` | json | Các lựa chọn |
| `correctAnswer` | string/json | Đáp án đúng (chỉ trả về backend, không lộ ra client) |

### DM-07 — `AnswerRecord` (Từng câu trả lời)
| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | UUID | PK |
| `dailyAttemptId` | FK → `DM-04` | Lượt ngày |
| `questionId` | FK → `DM-06` | Câu hỏi |
| `selectedAnswer` | string/json | Đáp án HS chọn |
| `isCorrect` | bool | Đúng/sai |
| `responseTimeSec` | number | Thời gian phản hồi (từ `UI-203`) |
| `pointsAwarded` | number | Điểm câu này |

### DM-08 — `LeaderboardEntry` (View/cache xếp hạng)
Thường là **materialized view / cache** dựng từ `DM-03`, không phải bảng nguồn.

| Trường | Kiểu | Mô tả |
|---|---|---|
| `weekKey` | string | Tuần |
| `gradeLevel` | int/string | Khối (phân vùng BXH) |
| `studentId` | FK → User | HS |
| `rank` | int | Hạng |
| `correctCount` | int | (từ `DM-03`) |
| `totalCorrectTimeSec` | number | (từ `DM-03`) |
| `lastAchievedAt` | datetime | (từ `DM-03`) |

### DM-09 — `WeeklyHonor` (Vinh danh & phần thưởng)
| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | UUID | PK |
| `weekKey` | string | Tuần được vinh danh |
| `gradeLevel` | int/string | Khối |
| `studentId` | FK → User | HS Top 10 |
| `rank` | int | Hạng cuối tuần (1–10) |
| `frameGranted` | bool | Đã cấp khung avatar |
| `frameExpiry` | datetime | Hết hạn khung (cấp + 7 ngày) |
| `bannerActive` | bool | Đang hiển thị banner trang chủ |

---

## 4. FLOW COMPONENTS

### FLW-01 — Khởi tạo Boss tuần (Cron 00h00 Thứ Hai)
Kích hoạt: scheduler đầu tuần.
1. Với mỗi khối lớp: lấy `DM-01` (`BossConfig`) ứng với `weekKey` mới (CMS chuẩn bị trước).
2. Tạo `DM-02` (`BossInstance`) mới: `totalPointsEarned=0`, `progressPercent=0`, `status=ACTIVE`, ảnh = trạng thái 100%.
3. Reset BXH: dữ liệu xếp hạng tuần mới bắt đầu từ rỗng (BXH phân theo `weekKey`, nên không xóa lịch sử cũ).
4. Gọi `FLW-08` để chốt vinh danh **tuần trước** (nếu chưa chốt).
> Ghi: `DM-02`. Đọc: `DM-01`.

### FLW-02 — Mở khóa câu hỏi ngày (Cron 00h00 hằng ngày)
1. Với mỗi (khối, ngày) lấy `DM-05` (`QuestionSet`) tương ứng `dayIndex` hôm nay.
2. Khi HS vào sảnh, tạo/đảm bảo `DM-04` (`DailyAttempt`) của ngày với `status=LOCKED→IN_PROGRESS` khi bắt đầu.
3. Chặn truy cập câu của ngày tương lai (kiểm tra `dayIndex <= ngày hiện tại`).
4. Nếu `DM-02.status=DEFEATED` → không mở lượt mới, sảnh hiển thị trạng thái đã thắng (xem `FLW-04`).
> Quy tắc: HS không thể làm trước câu hỏi của ngày sau.

### FLW-03 — Tải sảnh (SCR-01)
1. Lấy `DM-02` của (tuần, khối) HS → render `UI-101`, `UI-102`, `UI-106`.
2. Suy ảnh Boss: đối chiếu `progressPercent` còn lại với `DM-01.bossStates` → `UI-101`.
3. Lấy `DM-04` hôm nay → tính số câu còn lại → `UI-103`, trạng thái `UI-105`.
4. Tính countdown tới 00h Thứ Hai → `UI-104`.

### FLW-04 — Bắt đầu chiến đấu (SCR-01 → SCR-02)
1. Kiểm tra `DM-02.status`. Nếu `DEFEATED` → chặn, hiển thị "Boss đã bị hạ gục — chờ đợt tuần sau".
2. Kiểm tra `DM-04` hôm nay chưa `COMPLETED`. Nếu rồi → chặn.
3. Đặt `DM-04.status=IN_PROGRESS`. Nạp câu hỏi từ `DM-05`.
4. Hiển thị lần lượt từng câu (`SCR-02`), khởi động `UI-203` mỗi câu.

### FLW-05 — Tính điểm câu trả lời
Kích hoạt: HS chọn đáp án ở `SCR-02`.
1. Backend chấm `isCorrect` (so với `DM-06.correctAnswer` — **không chấm ở client**).
2. Lấy `t = responseTimeSec` (clamp `0 ≤ t ≤ tMaxSec`).
3. Nếu sai → `pointsAwarded = 0`.
4. Nếu đúng:
   `pointsAwarded = basePoint + maxSpeedBonus * max(0, 1 - t / tMaxSec)`
   (`basePoint`=`CFG-03`, `maxSpeedBonus`=`CFG-04`, `tMaxSec`=`CFG-05`).
5. Ghi `DM-07` (`AnswerRecord`).
> Đọc: `DM-01`, `DM-06`. Ghi: `DM-07`.

### FLW-06 — Hoàn thành lượt ngày & cộng dồn tiến độ (→ SCR-03)
Kích hoạt: HS trả lời xong câu cuối của lượt.
1. Tổng hợp lượt: `correctCount`, `totalResponseTime`, `pointsEarned` (tổng `DM-07`).
2. Cập nhật `DM-04`: ghi các tổng trên, `status=COMPLETED`, `completedAt=now`.
3. Cập nhật `DM-03` (cá nhân/tuần): cộng `correctCountWeek`, cộng `totalCorrectTimeSec` (chỉ tính thời gian **câu đúng**), cộng `pointsContributedWeek`, set `lastAchievedAt=now`.
4. Cập nhật `DM-02` (Boss chung): `totalPointsEarned += pointsEarned`; tính lại `progressPercent`. Nếu vượt mốc trạng thái → đổi `currentBossStateImg`. Nếu ≥ 100% → `status=DEFEATED`.
5. Trả kết quả render `SCR-03` (`UI-301..304`).
> Ghi chú: khi Boss `DEFEATED` (HP về 0%), **khóa toàn bộ lượt làm còn lại của tuần** cho mọi HS trong khối — coi như đã thắng, chờ đợt Boss tuần kế tiếp (`FLW-01`). BXH tuần đó vẫn giữ nguyên kết quả tại thời điểm chốt để `FLW-08` vinh danh.

### FLW-07 — Cập nhật BXH real-time
Kích hoạt: ngay sau `FLW-06` cập nhật `DM-03`.
1. Tính lại `rank` trong phân vùng (tuần, khối) theo thứ tự ưu tiên:
   - (1) `correctCountWeek` giảm dần;
   - (2) `totalCorrectTimeSec` tăng dần (nhanh hơn lên trên);
   - (3) `lastAchievedAt` tăng dần (đạt sớm hơn lên trên).
2. Cập nhật `DM-08` (cache/view) và đẩy realtime tới `SCR-04` (`UI-401..403`).
3. `UI-403` (My Rank Card): nếu HS chưa có `DM-03` → hiển thị "Chưa xếp hạng".

### FLW-08 — Chốt vinh danh cuối tuần & phát thưởng
Kích hoạt: 00h00 Thứ Hai (trước/đồng thời `FLW-01`).
1. Khóa BXH tuần kết thúc, lấy Top 10 mỗi khối từ `DM-08`.
2. Tạo `DM-09` (`WeeklyHonor`) cho từng HS Top 10.
3. Cấp khung avatar "Dũng sĩ diệt Boss": `frameGranted=true`, `frameExpiry=now+7 ngày` → `UI-502`.
4. Kích hoạt banner trang chủ Top 10: `bannerActive=true` trong 7 ngày → `UI-501`.
5. Dựng podium Top 3 ở sảnh → `UI-503`.
> Job dọn dẹp: khi `frameExpiry`/banner hết hạn → tự gỡ.

---

## 5. PHỤ LỤC — QUYẾT ĐỊNH ĐÃ CHỐT

1. **Số câu/tuần:** Dùng **35**, **config được** qua `questionsPerWeek` (`CFG-02b`). Mẫu số "x/N câu" trên `UI-403` lấy động theo cấu hình.
2. **Quy mô vinh danh:** **Top 10 mỗi khối** (`FLW-08`, `DM-09`).
3. **Phân vùng BXH:** **Chỉ theo khối lớp**, không có BXH toàn trường.
4. **Khi Boss bị hạ (HP=0%) giữa tuần:** **Khóa toàn bộ lượt làm còn lại** của khối đó — coi như đã thắng, chờ đợt tuần kế tiếp. Không tăng HP, không sinh Boss thứ hai. (Đã phản ánh ở `UI-105`, `FLW-04`, `FLW-06`.)
5. **Reset đề ngày vs tiến trình tuần:** 00h hằng ngày chỉ **mở khóa bộ câu mới** (`FLW-02`); tiến trình Boss + BXH chỉ reset 00h Thứ Hai (`FLW-01`).
6. **"Tổng thời gian" trên My Rank Card:** Dùng `totalCorrectTimeSec` (tổng thời gian các câu **đúng**), đồng nhất với tiêu chí xếp hạng #2.
