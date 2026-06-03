# Sự kiện tuần

**Mô tả:** Sự kiện đồng thời 9 phòng theo khối, thứ 7 hàng tuần 10h00-10h30, 25 câu trong 20 phút.

**Tại sao:** Cuộc hẹn hàng tuần \- tạo điểm neo trong lịch của học sinh.

**Acceptance:** 9 phòng riêng biệt theo khối; tự động mở/đóng đúng giờ; hệ thống chịu được toàn bộ học sinh active vào cùng lúc; có cơ chế xử lý disconnect.

*Số 9: Số khối lớp hiện tại đang dạy (Từ lớp 1 \- 9\) Có thể mở rộng*

# WE \- Kịch bản

## **I. TỔNG QUAN TÍNH NĂNG (OVERVIEW)**

* **Tên sự kiện:** Sự kiện tuần (Weekly Event).  
* **Mục tiêu chiến lược:** Tạo điểm neo tâm lý (psychological anchor) vào 10h00 đến 10h30 theo config sáng thứ Bảy hàng tuần, biến việc học tập/thi đấu thành một "cuộc hẹn" không thể bỏ lỡ trong lịch trình của học sinh.  
* **Cấu trúc vận hành:**  
  * 9 phòng thi riêng biệt chạy đồng thời, tương ứng với các khối lớp từ 1 đến 9\.  
  * Hệ thống có khả năng mở rộng linh hoạt thêm các khối lớp mới (10, 11, 12\) mà không làm thay đổi kiến trúc cốt lõi.  
  * Thời gian nghiêm ngặt: Tổng thời lượng 30 phút (10h00 \- 10h30), trong đó thời gian làm bài thực tế là 20 phút cho 25 câu hỏi.

  ## **II. LUỒNG TRẢI NGHIỆM NGƯỜI DÙNG (USER FLOW)**

  ### **Giai đoạn 1: Tiếp cận và Tập hợp (10h00 \- 10h05)**

* **10h00:** Cổng sự kiện tự động mở. Học sinh nhấn "Tham gia", hệ thống dựa vào Profile để tự động điều hướng vào đúng phòng khối lớp.  
* **Phòng chờ (Waiting Room):** Hiển thị số lượng học sinh đang online trong khối và đồng hồ đếm ngược đến giờ phát đề. Mục tiêu là tạo hiệu ứng đám đông và sự kịch tính.

  ### **Giai đoạn 2: Thực thi thử thách (10h05 \- 10h25)**

* **10h05:** Hệ thống tự động đẩy đề thi (25 câu).  
* **Quá trình làm bài:** Học sinh trả lời các câu hỏi trắc nghiệm. Giao diện tập trung tối đa, hiển thị thanh tiến trình (progress bar) và thời gian đếm ngược. Các phương án gây nhiễu được trộn ngẫu nhiên.  
* **Tự động nộp bài:** Đúng 10h25, hệ thống tự động khóa bài thi và gửi dữ liệu về máy chủ, bất kể học sinh đã nhấn nộp bài hay chưa.

  ### **Giai đoạn 3: Vinh danh và Kết thúc (10h25 \- 10h30)**

* **Tính toán kết quả:** Hệ thống xử lý bảng xếp hạng (Leaderboard) theo thời gian thực.  
* **10h27:** Hiển thị bảng vinh danh Top 10 của khối lớp đó và kết quả cá nhân (số câu đúng, điểm số, thứ hạng).  
* **10h30:** Đóng hoàn toàn sự kiện, chuyển trạng thái sang "Chờ tuần kế tiếp".

  ## **III. CƠ CHẾ CỐT LÕI (CORE MECHANICS)**

  ### **1\. Cơ chế vận hành tự động (Automation)**

Sử dụng Event Scheduler để kích hoạt các trạng thái phòng (Mở cổng \-\> Phát đề \-\> Đóng bài \-\> Vinh danh) chính xác theo giây trên Server. Việc kiểm soát thời gian phải độc lập hoàn toàn với đồng hồ trên thiết bị người dùng để chống gian lận.

### **2\. Quản lý tải cao (High Concurrency)**

Hệ thống được thiết kế theo mô hình Stateless hoặc sử dụng Redis Caching để lưu trữ tạm thời các lượt trả lời. Toàn bộ học sinh active truy cập cùng lúc tại thời điểm 10h00 sẽ được phân phối qua bộ cân bằng tải (Load Balancer), đảm bảo không xảy ra tình trạng nghẽn (bottleneck) khi đồng loạt gửi kết quả ở phút thứ 20\.

### **3\. Xử lý mất kết nối (Disconnect Handling)**

* **Cơ chế Heartbeat:** Liên tục kiểm tra trạng thái kết nối giữa Client và Server.  
* **Auto-resume:** Nếu học sinh bị rớt mạng hoặc thoát ứng dụng đột ngột, khi truy cập lại trong khoảng thời gian 10h05 \- 10h25, hệ thống sẽ khôi phục nguyên trạng bài thi (các câu đã trả lời) để học sinh tiếp tục mà không bị mất dữ liệu. Thời gian làm bài vẫn tính theo thời gian thực của Server.

  ### **4\. Thuật toán xếp hạng (Ranking Logic)**

Bảng xếp hạng được ưu tiên theo các tiêu chí:

1. Số câu trả lời đúng (Cao nhất).  
2. Tổng thời gian hoàn thành (Ngắn nhất).  
3. Thời điểm ghi nhận câu đúng cuối cùng (Sớm nhất \- dùng để phân định khi trùng cả 2 tiêu chí trên).

   ## **IV. CẤU HÌNH HỆ THỐNG QUA CMS (CMS CONFIGURATIONS)**

   ### **1\. Phần cài đặt chung (General Settings)**

Các cấu hình hệ thống mang tính chất mặc định và ít thay đổi, áp dụng tự động cho toàn bộ các tuần thi trừ khi có thiết lập ghi đè:

* **Thời gian chờ mặc định (Default Waiting Duration):** Khoảng thời gian học sinh ở phòng chờ để tập hợp lực lượng trước khi phát đề (tính bằng phút). Loại dữ liệu (số). Giá trị mặc định: `5`  
* **Thời gian làm bài mặc định (Default Exam Duration):** Tổng thời lượng học sinh thực hiện trả lời các câu hỏi trong đề thi (tính bằng phút). Loại dữ liệu (số). Giá trị mặc định: `20`  
* **Thời gian vinh danh mặc định (Default Show Leaderboard Duration):** Khoảng thời gian hiển thị bảng xếp hạng vinh danh và kết quả cá nhân trước khi đóng hoàn toàn sự kiện (tính bằng phút). Loại dữ liệu (số). Giá trị mặc định: `5`  
* **Số lượng học sinh vinh danh (Leaderboard Limit):** Số lượng học sinh tối đa có thành tích cao nhất được vinh danh công khai trên bảng xếp hạng của mỗi khối. Loại dữ liệu (số). Giá trị mặc định: `10`  
* **Danh sách khối lớp áp dụng mặc định (Default Active Grades):** Các khối lớp mặc định sẽ được mở phòng thi trong sự kiện tuần. Loại dữ liệu (text \- danh sách phân tách bằng dấu phẩy). Giá trị mặc định: `1,2,3,4,5,6,7,8,9`  
* **Lịch lặp tuần tự động (Weekly Cron Expression):** Cấu hình biểu thức thời gian để hệ thống tự động sinh sự kiện và hẹn giờ chạy hàng tuần. Loại dữ liệu (text). Giá trị mặc định: `0 10 * * 6` (tương ứng 10h00 sáng thứ Bảy hàng tuần)

  ### **2\. Phần cài đặt riêng cho từng tuần (Weekly-specific Settings)**

Các tham số cho phép đội ngũ vận hành tùy biến linh hoạt cho từng số phát sóng (phiên thi) cụ thể mà không làm ảnh hưởng đến khung chạy mặc định của hệ thống:

* **Tên chủ đề tuần (Weekly Event Title):** Tên tiêu đề hiển thị trên banner và phòng chờ của tuần thi đó (ví dụ: "Đấu Trường Số 05: Thử Thách Hình Học"). Loại dữ liệu (text). Giá trị mặc định: `Đấu Trường Tuần {Số_Tuần}`  
* **Ngày giờ chạy thực tế của tuần (Specific Run Datetime):** Cho phép thay đổi thời gian chạy cụ thể của tuần đó nếu trùng ngày nghỉ lễ hoặc có sự kiện đặc biệt khác. Loại dữ liệu (text \- định dạng YYYY-MM-DD HH:mm). Giá trị mặc định: `Tự động tính theo Lịch lặp tuần tự động`  
* **Danh sách đề thi theo khối (Weekly Exam Assignment):** Liên kết đề thi cụ thể từ ngân hàng đề cho từng khối lớp của tuần này. Loại dữ liệu (JSON/Mapping giữa Grade ID và Exam ID). Không có giá trị mặc định (Bắt buộc cấu hình trước khi sự kiện diễn ra)  
* **Số lượng câu hỏi tuần (Weekly Question Count Override):** Cho phép ghi đè số lượng câu hỏi thi riêng cho tuần này (nếu khác với cấu hình của đề thi gốc). Loại dữ liệu (số). Giá trị mặc định: `25`  
* **Trạng thái kích hoạt của tuần (Weekly Session Status):** Trạng thái hoạt động của sự kiện tuần hiện tại (nhằm hỗ trợ việc hoãn hoặc hủy sự kiện đột xuất). Loại dữ liệu (text \- các trạng thái: Draft, Scheduled, Cancelled). Giá trị mặc định: `Scheduled`

# WE \- Giao diện

