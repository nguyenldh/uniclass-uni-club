# Hướng dẫn Cấu hình & Vận hành Sự kiện Tuần (Weekly Event) trên CMS

Tài liệu này hướng dẫn đội ngũ vận hành cách thiết lập cấu hình chung, tạo và quản lý phiên sự kiện tuần, gán đề thi theo khối, và giám sát phòng thi trực tiếp trên cổng CMS của UniClub.

---

## 1. Cấu hình Chung (General Settings)

Các cấu hình hệ thống mang tính chất mặc định, áp dụng tự động cho toàn bộ các số phát sóng tuần trừ khi có thiết lập ghi đè riêng biệt.

* **Đường dẫn**: Vào menu **Cấu hình game** ➔ Chọn **Sự kiện tuần**.
* **Các tham số cấu hình**:
  * **Thời gian chờ mặc định (Default Waiting Duration)**: Số phút cổng phòng chờ mở để học sinh tập hợp trước khi phát đề (Mặc định: `5` phút - từ 10h00 đến 10h05).
  * **Thời gian làm bài mặc định (Default Exam Duration)**: Số phút học sinh làm bài thi (Mặc định: `20` phút - từ 10h05 đến 10h25).
  * **Thời gian vinh danh mặc định (Default Show Leaderboard Duration)**: Số phút hiển thị bảng vinh danh Top 10 và kết quả cá nhân trước khi đóng hoàn toàn sự kiện (Mặc định: `5` phút - từ 10h27 đến 10h30).
  * **Số lượng học sinh vinh danh (Leaderboard Limit)**: Thứ hạng tối đa hiển thị trên bảng vinh danh (Mặc định: `10`).
  * **Danh sách khối lớp áp dụng mặc định (Default Active Grades)**: Các khối lớp mặc định sẽ được tự động mở phòng thi. Nhập các số phân tách bằng dấu phẩy (Ví dụ: `1,2,3,4,5,6,7,8,9,10,11,12`).
  * **Lịch lặp tuần tự động (Weekly Cron Expression)**: Cấu hình biểu thức thời gian để hệ thống tự động sinh sự kiện và hẹn giờ chạy hàng tuần. Mặc định: `0 10 * * 6` (Tương ứng 10h00 sáng thứ Bảy hàng tuần).

---

## 2. Quản lý Sự kiện Tuần (Event Management)

### A. Cơ chế tự động sinh sự kiện (Auto-generation)
Hệ thống tích hợp một Worker chạy ngầm tự động quét lịch vào **00h00 Chủ Nhật hàng tuần**. Nếu không tìm thấy sự kiện nào được thiết lập cho tuần tới, hệ thống sẽ tự động tạo một phiên sự kiện mới ở trạng thái **Draft** (Nháp) với các thông số mặc định lấy từ cấu hình chung.

### B. Tạo sự kiện thủ công (Manual Creation)
Nếu cần tạo sự kiện cho một khung giờ đặc biệt hoặc tạo trước nhiều tuần:
1. Vào menu **Sự kiện tuần** ➔ Chọn **Tạo sự kiện mới**.
2. **Tiêu đề**: Nhập tiêu đề sự kiện (Ví dụ: *Sự kiện tuần Số 10: Thử Thách Toán Học*).
3. **Thời gian bắt đầu**: Chọn ngày và giờ cổng sự kiện bắt đầu mở (phù hợp với Cron đã cài đặt).
4. **Khối lớp hoạt động**: Hệ thống sẽ **tự động điền trước (prefill)** các khối lớp từ cấu hình mặc định. Bạn có thể thêm/bớt khối lớp tùy ý cho phiên thi này.
5. Nhấn **Xác nhận** để lưu sự kiện ở trạng thái `Scheduled` (Đã lên lịch).

### C. Gán đề thi cho các khối lớp (Bắt buộc)
> [!IMPORTANT]
> Học sinh của một khối lớp chỉ có thể tham gia thi nếu khối lớp đó đã được gán đề thi cụ thể trong hệ thống. Vui lòng hoàn tất việc gán đề thi trước giờ mở cổng 10h00 thứ Bảy.
1. Tại danh sách sự kiện tuần, chọn sự kiện cần cấu hình ➔ Nhấn **Chi tiết**.
2. Trong phần **Cấu hình Đề thi**, chọn từng khối lớp và liên kết với mã đề thi tương ứng từ **Ngân hàng đề thi** đã được tải lên trước đó.
3. Hệ thống sẽ lưu liên kết gán đề dưới cấu trúc JSON Mapping `{ "grade": "examId" }`.

---

## 3. Giám sát Phòng thi Trực tiếp (Room Monitoring)

Trong suốt thời gian sự kiện diễn ra (10h00 - 10h30 thứ Bảy), admin có thể giám sát tiến trình làm bài của học sinh theo thời gian thực tại màn hình **Chi tiết sự kiện**:

### A. Chỉ số Giám sát Tổng quan (Real-time Indicators)
* **Trạng thái phòng**: Hiển thị trạng thái hiện tại (`Scheduled`, `Waiting` - Đang chờ, `InProgress` - Đang thi, `Grading` - Đang chấm, `Showing` - Đang vinh danh, `Closed` - Đã đóng).
* **Số lượng Online**: Số lượng học sinh thực tế đang kết nối socket trong phòng thi.
* **Số lượng Đã nộp**: Số lượng học sinh đã hoàn thành và gửi bài (bao gồm cả nộp thủ công và tự động khóa bài khi hết giờ).

### B. Tab "Danh sách học sinh làm bài"
Hiển thị chi tiết bảng danh sách của toàn bộ học sinh tham gia phòng thi:
* **Họ và tên học sinh & Khối lớp**.
* **Số câu đúng / Tổng số câu**.
* **Thời gian làm bài**: Tính từ lúc phát đề đến lúc chọn đáp án cuối cùng.
* **Điểm số đạt được**.
* **Loại nộp bài**: `manual` (học sinh chủ động nộp) hoặc `auto` (hệ thống tự khóa bài khi hết giờ).

### C. Tab "Bảng xếp hạng (Top 50)"
Hiển thị danh sách xếp hạng vinh danh nội bộ của phòng thi khối lớp đó dựa trên thuật toán:
1. **Số câu đúng nhiều nhất**.
2. **Tổng thời gian phản hồi ngắn nhất**.
3. **Thời điểm chọn đáp án đúng cuối cùng sớm nhất** (tiêu chí phân định khi trùng các chỉ số trên).

---

## 4. Các tình huống xử lý Vận hành Đặc biệt

### A. Huỷ sự kiện khẩn cấp (Emergency Cancel)
* **Kịch bản**: Phát hiện đề thi có lỗi nghiêm trọng hoặc lỗi hệ thống mạng diện rộng khi phòng thi đang ở trạng thái `Waiting` hoặc `InProgress`.
* **Thao tác**: Nhấn nút **Huỷ sự kiện** trên CMS Dashboard.
* **Kết quả**: Hệ thống sẽ lập tức đổi trạng thái sang `Cancelled`. Client của toàn bộ học sinh đang kết nối sẽ nhận được socket event `room:cancelled` kèm lý do huỷ, tự động điều hướng sang màn hình đóng sự kiện và hiển thị thông báo hoãn/huỷ từ ban tổ chức.

### B. Xem bảng xếp hạng tuần cũ
* **Kịch bản**: Học sinh muốn xem lại bảng vinh danh và kết quả cá nhân của tuần vừa diễn ra sau khi phòng thi đã đóng (`Closed`).
* **Hoạt động**: Màn hình sự kiện đóng (`EventClosedScreen`) tự động hiển thị nút **Xem bảng xếp hạng**. Khi click, client gọi REST API truy xuất dữ liệu từ snapshot lưu trong `WeeklyEventLeaderboardSnapshotModel` để dựng lại danh sách Top 10 của khối mà không cần mở kết nối Socket.
