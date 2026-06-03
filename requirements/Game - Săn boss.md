# Săn boss

**Mô tả:** Bộ đề khó 50 câu/khối, học sinh đấu solo, top 90 (mỗi khối 10 bạn) được vinh danh trong BXH.

**Cơ chế:** Mỗi tuần một bộ đề mới, học sinh chơi solo bất kỳ lúc nào trong tuần. BXH reset đầu tuần.

**Tại sao:** Tạo thử thách đỉnh cao cho học sinh giỏi và sự kiện định kỳ tạo thói quen.

**Acceptance:** Bộ đề tự động kích hoạt 0h thứ 2 hàng tuần; BXH cập nhật real-time; vinh danh top 100 hiển thị nổi bật.

# BB \- Kịch bản

## **I. TỔNG QUAN TÍNH NĂNG (OVERVIEW)**

Săn boss là chế độ thử thách định kỳ cao cấp trong hệ thống, nơi học sinh không chỉ đấu với kiến thức mà còn đấu với giới hạn của bản thân và thời gian. Mỗi tuần, một "Quái thú tri thức" (Boss) với tổng lượng máu/điểm số xác định sẽ xuất hiện. Học sinh sẽ cùng nhau chinh phục Boss thông qua việc hoàn thành các câu hỏi thử thách mỗi ngày để tích lũy điểm số, đưa tiến độ hoàn thành từ 0% lên 100%.

### **Mục tiêu cốt lõi:**

* **Tạo lập thói quen (Daily Habit):** Thúc đẩy học sinh đăng nhập và làm bài đều đặn mỗi ngày với số lượng câu hỏi ngắn gọn nhưng chất lượng.  
* **Thử thách đỉnh cao và Cạnh tranh:** Tạo ra áp lực thời gian thực tế, khuyến khích tư duy nhanh và chính xác.  
* **Hệ thống vinh danh mới:** Bảng xếp hạng riêng biệt đề cao cả hai yếu tố: Trí tuệ (số câu đúng) và Tốc độ (thời gian phản hồi).

## **II. KỊCH BẢN & LUỒNG TRẢI NGHIỆM NGƯỜI DÙNG (USER FLOW)**

### **1\. Tiếp cận thử thách (Entry)**

* Học sinh truy cập vào tab Săn Boss.  
* Tại màn hình sảnh, học sinh sẽ nhìn thấy:  
  * Hình ảnh Boss tuần này: Hình ảnh này sẽ tự động thay đổi trạng thái (ví dụ: từ trạng thái khỏe mạnh sang bị thương, kiệt sức hoặc nổi giận) tương ứng với mốc phần trăm máu (%) còn lại của Boss.  
  * Thanh tiến độ (Progress Bar) là % tiến độ  
  * Số lượng câu hỏi của ngày hôm nay (mặc định 5 câu).  
  * Đồng hồ đếm ngược đến thời điểm reset tuần tiếp theo (vào lúc 00h00 sáng ngày Thứ Hai).

### **2\. Tham gia chiến đấu (Gameplay)**

* Mỗi ngày, hệ thống mở khóa tối đa 5 câu hỏi. Học sinh không thể làm trước câu hỏi của các ngày tiếp theo.  
* Học sinh chọn "Chiến đấu" để bắt đầu trả lời. Hệ thống sẽ kích hoạt đồng hồ bấm giờ tính bằng giây cho từng câu hỏi để làm cơ sở tính điểm tốc độ.

### **3\. Hoàn thành và Cộng dồn tiến độ (Result & Progress)**

* Sau khi hoàn thành lượt trả lời của ngày, hệ thống hiển thị kết quả ngay lập tức: Số câu đúng, tổng thời gian trả lời, và số điểm đóng góp tích lũy được.  
* Điểm số cá nhân này sẽ được cộng trực tiếp vào tiến trình chung của Boss. Thanh tiến trình sẽ chạy hiệu ứng Fill up tăng dần hướng tới mốc 100%. Ngoại hình của Boss trên giao diện sẽ tự động cập nhật sang hình ảnh mới nếu lượng máu giảm xuống dưới các mốc cấu hình.

### **4\. Theo dõi Bảng xếp hạng (Leaderboard)**

* Học sinh có thể truy cập BXH riêng của Boss Battle để theo dõi vị trí của mình so với các học sinh khác dựa trên tổng số câu đúng và tốc độ xử lý câu hỏi.

## **III. CƠ CHẾ CỐT LÕI (CORE MECHANICS)**

### **1\. Chu kỳ và Reset đề**

* **Số lượng câu hỏi:** Hệ thống cung cấp đúng 5 câu hỏi mỗi ngày. Tổng cộng cả tuần (7 ngày) học sinh sẽ giải quyết tối đa 35 câu hỏi.  
* **Thời gian Reset:** Hệ thống tự động làm mới bộ đề 5 câu mới vào lúc 00h00 mỗi ngày. Toàn bộ tiến trình Boss và BXH tuần sẽ được reset hoàn toàn vào 00h00 sáng ngày Thứ Hai đầu tuần tiếp theo để bắt đầu một chu kỳ Boss mới.

### **2\. Tiến trình Boss (Boss Progress)**

* **Tổng điểm của Boss (HP tối đa):** Là một giá trị có thể cấu hình được (Configurable) tùy thuộc vào độ khó của từng tuần hoặc từng khối lớp.  
* **Thanh tiến độ (Progress Bar):**  
  * Công thức tính:  
  * Tiến độ (%) \= (Tổng điểm đạt được / HP tối đa) \* 100%  
  * Thanh tiến độ sẽ tăng dần (Fill up) từ 0% đến 100% tương ứng với lượng điểm học sinh tích lũy được sau mỗi câu trả lời đúng.

### **3\. Cơ chế tính điểm (Scoring Mechanics)**

Điểm số nhận được cho mỗi câu hỏi được quyết định bởi tính chính xác và tốc độ phản hồi:

* **Điểm cơ bản:** Mỗi câu trả lời đúng được cộng \+x điểm (Giá trị x cấu hình được trong hệ thống). Trả lời sai nhận 0 điểm.  
* **Điểm thưởng tốc độ (Speed Bonus):**  
  * Trả lời càng nhanh thì điểm thưởng nhận được càng tiệm cận mức tối đa.  
  * Công thức tính điểm cho một câu trả lời đúng thứ i với thời gian phản hồi t (giây) và thời gian giới hạn tối đa cho phép của câu hỏi đó là T\_max:  
  * Điểm nhận được \= x \+ Điểm tốc độ tối đa \* Max(0, 1 \- t / T\_max)  
  * *(Trong đó: x là điểm cơ bản, Điểm tốc độ tối đa là điểm thưởng tốc độ lớn nhất được cấu hình, t là thời gian trả lời thực tế, T\_max là thời gian làm bài tối đa cho phép, hàm Max đảm bảo điểm thưởng không bị âm nếu làm quá thời gian).*

### **4\. Bảng xếp hạng riêng biệt (Dedicated Leaderboard)**

BXH được làm mới liên tục (Real-time) và phân loại học sinh dựa trên các tiêu chí ưu tiên theo thứ tự sau:

1. **Tổng số câu trả lời đúng tích lũy:** Ưu tiên hàng đầu (Tối đa 35 câu/tuần).  
2. **Tổng tốc độ trả lời (Thời gian tích lũy):** Nếu có cùng số câu đúng, học sinh có tổng thời gian trả lời (bằng tổng thời gian làm các câu đúng) nhỏ hơn (nhanh hơn) sẽ được xếp hạng cao hơn.  
3. **Thời điểm đạt thành tích:** Nếu cả số câu đúng và tổng thời gian bằng nhau, ai đạt được mức điểm đó sớm hơn trong tuần sẽ xếp trên.

## **IV. HỆ THỐNG VINH DANH & GIAO DIỆN XẾP HẠNG (REWARDS & UI RANKING)**

Để kích thích tinh thần cạnh tranh lành mạnh và ghi nhận nỗ lực của từng cá nhân, hệ thống vinh danh và giao diện xếp hạng được phân tách rõ ràng thành hai khu vực trực quan:

### **1\. Vinh danh Top 10 học sinh xuất sắc nhất (Top 10 Leaders)**

Áp dụng cho 10 học sinh đứng đầu bảng xếp hạng của mỗi khối lớp vào cuối tuần:

* **Bục vinh danh 3D (Podium):** Top 1, Top 2, và Top 3 được hiển thị trang trọng với hình ảnh Avatar lớn, đi kèm hiệu ứng vương miện (Vàng, Bạc, Đồng) và hào quang chuyển động lấp lánh tại sảnh sự kiện Boss Battle.  
* **Banner vinh danh Trang chủ:** Hiển thị danh sách Top 10 kèm tên lớp/trường luân phiên trên thanh trượt Banner chính của ứng dụng suốt 1 tuần tiếp theo.  
* **Khung Avatar độc quyền (Weekly Frame):** Tự động mở khóa khung Avatar phiên bản giới hạn "Dũng sĩ diệt Boss" cho Top 10, có hiệu lực sử dụng trong vòng 7 ngày tiếp theo để học sinh tự hào thể hiện trong các khu vực khác của hệ thống.

### **2\. Hiển thị vị trí của người dùng đang chơi (My Rank Card)**

Để học sinh luôn định vị được bản thân và không nản lòng khi nằm ngoài nhóm dẫn đầu, một thẻ cá nhân sẽ được thiết kế riêng biệt trong giao diện BXH:

* **Vị trí hiển thị:** Ghim cố định (Sticky Card) ở cạnh dưới cùng của màn hình bảng xếp hạng. Khi học sinh cuộn (scroll) danh sách BXH, thẻ cá nhân này vẫn đứng yên để dễ dàng đối chiếu trực tiếp.  
* **Thông tin hiển thị cá nhân:**  
  * **Thứ hạng hiện tại:** Hiển thị số thứ hạng thực tế của học sinh (Ví dụ: \#152, \#1402). Nếu học sinh chưa làm câu hỏi nào trong tuần, vị trí hiển thị mặc định là "-" hoặc "Chưa xếp hạng".  
  * **Chỉ số tích lũy cá nhân:** Hiển thị trực quan Số câu trả lời đúng tích lũy (Ví dụ: "15/35 câu") và Tổng thời gian phản hồi (Ví dụ: "102 giây").

## **V. CẤU HÌNH HỆ THỐNG (CMS CONFIGURATION)**

Dưới đây là danh sách các tham số của tính năng Boss Battle Tuần có thể thiết lập trực tiếp từ trang quản trị (CMS):

* **Tổng lượng máu của Boss (HP tối đa):** Tổng số điểm tích lũy cần đạt để hoàn thành 100% tiến trình Boss của tuần. Loại dữ liệu (số). Giá trị mặc định: 50000  
* **Số câu hỏi mỗi ngày:** Số lượng câu hỏi hệ thống tự động mở khóa cho học sinh giải quyết trong ngày. Loại dữ liệu (số). Giá trị mặc định: 5  
* **Điểm cơ bản cho mỗi câu đúng (x):** Điểm số cố định học sinh nhận được khi trả lời đúng một câu hỏi. Loại dữ liệu (số). Giá trị mặc định: 10  
* **Điểm thưởng tốc độ tối đa:** Điểm cộng thêm nhiều nhất nếu học sinh trả lời đúng và có thời gian phản hồi tiệm cận 0 giây. Loại dữ liệu (số). Giá trị mặc định: 5  
* **Thời gian làm bài tối đa của câu hỏi (T\_max):** Giới hạn thời gian (tính bằng giây) cho phép đối với mỗi câu hỏi để làm căn cứ tính điểm tốc độ. Loại dữ liệu (số). Giá trị mặc định: 60  
* **Tên hiển thị của Boss:** Tên của "Quái thú tri thức" xuất hiện trong tuần để hiển thị ở giao diện sảnh chờ. Loại dữ liệu (text). Giá trị mặc định: "Hắc Long Tri Thức"  
* **Bộ hình ảnh trạng thái Boss:** Danh sách các đường dẫn ảnh hoặc mã định danh đồ họa của Boss tương ứng với các mốc phần trăm máu còn lại (giúp thay đổi ngoại hình Boss khi HP giảm dần). Loại dữ liệu (text \- cấu hình theo định dạng danh sách mốc và ảnh). Giá trị mặc định: "100%-71%: boss\_dragon\_normal.png, 70%-41%: boss\_dragon\_injured.png, 40%-0%: boss\_dragon\_rage.png"  
* Bộ câu hỏi theo từng ngày, theo từng khối lớp

- Tổng số lượng points của boss (config)  
- Kịch bản:  
  - Mỗi ngày 5 câu (7 ngày) và reset vào 00h sáng ngày đầu tuần tiếp theo  
- Tiến độ hoàn thành sẽ Fill up từ 0% \-\> 100%  
- Mỗi câu trả lời đúng sẽ được \+ x points (config)  
  - Trả lời càng nhanh thì được càng max điểm  
- BXH riêng (Dựa vào số câu đúng và tốc độ trả lời)

# BB \- Giao diện
