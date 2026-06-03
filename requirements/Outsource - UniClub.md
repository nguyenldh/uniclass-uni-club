# Tổng quan dự án

## **1\. GIỚI THIỆU CHUNG**

* **Tên dự án:** Uni Club (Câu lạc bộ UniClass)  
* **Mục tiêu:** Phát triển một phân hệ trò chơi học tập tương tác, tích hợp trực tiếp vào hệ sinh thái giáo dục UniClass hiện có nhằm tăng độ gắn kết (retention rate) của học sinh thông qua các cơ chế game hóa (gamification).  
* **Hình thức tích hợp:** Nhúng WebView vào ứng dụng UniClass hiện tại.

## **2\. PHẠM VI TRÒ CHƠI (GAME MODES)**

*Dưới đây là sơ lược các phân hệ trò chơi. Chi tiết kịch bản và luật chơi cụ thể sẽ được đính kèm qua các tài liệu chuyên sâu.*

### **2.1. So Tài**

* **Mô tả ngắn:** Chế độ đấu trắc nghiệm 1-1 giữa học sinh với nhau hoặc đấu với máy (Bot).  
* **Cơ chế cốt lõi:** Hệ thống tự động ghép cặp (matchmaking) dựa trên điểm rank và khối lớp của học sinh để đảm bảo trận đấu cân sức.  
* **Chi tiết kịch bản:** [Outsource - UniClub](https://docs.google.com/document/d/1qDk7T-Cb46S4QytKpBu_rztdtH5XcUx5ZdxoTIjHyeA/edit?hl=vi&tab=t.0) 

### **2.2. Đấu Trí**

* **Mô tả ngắn:** Game trí tuệ mang tính chiến thuật cao, cho phép học sinh thi đấu trực tiếp với người chơi khác hoặc luyện tập với máy.  
* **Chi tiết kịch bản:** [Outsource - UniClub](https://docs.google.com/document/d/1qDk7T-Cb46S4QytKpBu_rztdtH5XcUx5ZdxoTIjHyeA/edit?hl=vi&tab=t.rmiynpsfuvd5) 

### **2.3. Săn Boss**

* **Mô tả ngắn:** Chế độ thử thách định kỳ (theo tuần) mang tính cộng đồng. Toàn bộ học sinh cùng tham gia trả lời câu hỏi hàng ngày để trừ HP/điểm số của "Quái thú tri thức" (Boss), đưa tiến độ hoàn thành từ $0\\%$ lên $100\\%$.  
* **Chi tiết kịch bản:** [Outsource - UniClub](https://docs.google.com/document/d/1qDk7T-Cb46S4QytKpBu_rztdtH5XcUx5ZdxoTIjHyeA/edit?hl=vi&tab=t.r6lhpbryt1ch) 

### **2.4. Sự kiện tuần**

* **Mô tả ngắn:** Giải đấu định kỳ diễn ra cố định vào lúc **10h00 đến 10h30 sáng thứ Bảy hàng tuần**. Tạo điểm neo tâm lý (psychological anchor) biến việc học và thi đấu thành thói quen không thể bỏ lỡ.  
* **Chi tiết kịch bản:** [Outsource - UniClub](https://docs.google.com/document/d/1qDk7T-Cb46S4QytKpBu_rztdtH5XcUx5ZdxoTIjHyeA/edit?hl=vi&tab=t.tq8rjavbesoa) 

## **3\. YÊU CẦU KỸ THUẬT CỐT LÕI (TECHNICAL REQUIREMENTS)**

Để đảm bảo khả năng tích hợp mượt mà và vận hành ổn định, đơn vị outsource cần tuân thủ nghiêm ngặt các tiêu chuẩn kỹ thuật sau:

### **3.1. Giao diện & Trải nghiệm Người dùng (UI/UX & Responsiveness)**

* **Tỷ lệ thiết kế gốc:** Toàn bộ giao diện trò chơi được thiết kế tối ưu trên tỷ lệ khung hình **16:9** (ưu tiên hiển thị dọc/ngang tùy theo định hướng mỹ thuật của game).  
* **Khả năng co giãn (Responsive):**  
  * Ứng dụng phải tự động co giãn, scale-to-fit (giữ nguyên tỷ lệ 16:9 bằng kỹ thuật letterbox/pillarbox hoặc responsive linh hoạt) trên mọi kích thước màn hình điện thoại, máy tính bảng hiện nay mà không bị vỡ khung hình hoặc mất nội dung.

### **3.2. Phương thức tích hợp (Integration)**

* **Hình thức nhúng:** Nhúng dạng **WebView** vào các nền tảng ứng dụng native của UniClass (iOS & Android).  
* **Bảo mật và Xác thực:** Sử dụng cơ chế token (ví dụ: JWT URL Parameters khi gọi WebView) để xác thực định danh học sinh từ hệ thống UniClass.

### **3.3. Hệ thống API & Luồng Dữ liệu (API & Integration Flow)**

**Cấu trúc dữ liệu phản hồi (Callback/Webhook gửi kết quả về UniClass sau mỗi trận đấu):**

* Ngay khi học sinh hoàn thành bất kỳ phần chơi nào (So tài, Đấu trí, Săn Boss, Sự kiện tuần), hệ thống Uni Club phải trả về một payload dữ liệu chuẩn hóa cho UniClass để ghi nhận tiến trình.

## **4\. HỆ THỐNG QUẢN TRỊ (CMS RIÊNG BIỆT)**

Đơn vị phát triển phải cung cấp một trang quản trị (Admin Dashboard/CMS) riêng biệt dành cho vận hành để cấu hình các thông số trò chơi mà không cần can thiệp vào code:

* **Cấu hình So tài / Đấu trí:** Thiết lập thuật toán ghép cặp (sai lệch điểm rank tối đa cho phép để tìm thấy đối thủ).  
* **Cấu hình Săn Boss:**  
  * Tạo mới Boss theo tuần (Hình ảnh, Tên Boss, HP/Điểm tổng, Thời gian diễn ra).  
  * Điều chỉnh độ khó của câu hỏi theo từng ngày trong tuần.  
  * Điều chỉnh threshold số lượng học sinh tham gia để xác định được là hạ được boss theo từng ngày  
  * Thiết lập lịch áp dụng cho các bộ câu hỏi theo từng ngày để săn boss  
* **Cấu hình Đấu Trường Cuối Tuần:** Thiết lập lịch mở phòng, thời gian đếm ngược, cơ cấu giải thưởng và bảng xếp hạng (Leaderboard) thời gian thực.  
* **Quản lý Ngân hàng câu hỏi (nếu có):** Import/Export câu hỏi trắc nghiệm dưới dạng Excel, phân loại theo khối lớp, môn học và độ khó.

## **5\. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)**

1. Ứng dụng chạy mượt mà trên WebView của cả thiết bị Android và iOS, không bị lỗi hiển thị (vỡ khung, mất nút bấm)  
2. CMS hoạt động ổn định, mọi cấu hình (ví dụ thay đổi lượng máu Boss) có hiệu lực theo thời gian được cấu hình  
3. Tool CMS được import question bank bằng file excel và export các câu hỏi đã import dưới dạng file excel  
4. Gửi đủ các thông tin Uniclass yêu cầu  
5. Game match được theo cả người và máy. Thời gian match người vs người tối đa theo đúng config   
6. Đáp ứng stress test với lưu lượng truy cập trung bình của Uniclass  
7. Design đáp ứng art style của Uniclass  
8. Không lộ dữ liệu học sinh: User A không thể truy cập: profile, lịch sử, trận đấu của User B bằng cách sửa URL/token  
9. Xử lý được các edge case: mất kết nối internet, học sinh out ra giữa chừng

Các thông số cần cập nhật real-time:  BXH Boss Battle, điểm tích lũy của 2 người chơi trong trận, v.v… 

# Kế hoạch

| Mốc bàn giao | Ngày hoàn thành | Nội dung bàn giao chính |
| :---- | :---- | :---- |
| **Mốc 1 (M1):** Core System, CMS & Phân hệ Game Core | **26/05/2026** *(Thứ Ba)* | \- **Hạ tầng & Xác thực:** Base DB, Socket Server, JWT Auth, API callback sync điểm. \- **Hệ thống CMS Admin:** Quản lý ngân hàng câu hỏi, form cấu hình So Tài, Đấu Trí. \- **Phân hệ Game 1 (So Tài):** Trận đấu trắc nghiệm PvP 1-1, Bot Client-side, Real-time score, Tie-breaker, AFK handle. \- **Phân hệ Game 2 (Đấu Trí):** Game Lật mảnh ghép (Basic/Advanced), Game Cờ Caro (PvP & Bot Client). *Sản phẩm bàn giao hoàn thiện, sẵn sàng chạy UAT.* |
| **Mốc 2 (M2):** Săn boss và Sự kiện tuần | **29/05/2026** *(Thứ Sáu)* | \- **Cấu hình trên CMS:** Quản lý HP Boss, thời gian, hình ảnh trạng thái Boss, lịch scheduler tự động cho Đấu Trường. \- **Săn Boss:** UI sảnh tĩnh, logic Daily Quiz 5 câu/ngày, Leaderboard tuần, Sticky Card hiển thị thứ hạng cá nhân. \- **Đấu trường:** Bộ đặt lịch tự động (Scheduler), thuật toán xử lý concurrency cao khi nộp bài đồng loạt, cơ chế phục hồi session (Auto-resume). |
| **Mốc 3 (M3):** Bàn giao nghiệm thu | **01/06/2026** *(Thứ Hai)* | \- Thực hiện Load/Stress testing phần Đấu Trường. \- Viết tài liệu đặc tả kỹ thuật hệ thống. \- Đóng gói, chuyển giao toàn bộ mã nguồn và ký nghiệm thu hoàn tất. |