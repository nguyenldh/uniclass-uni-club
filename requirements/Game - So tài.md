# So Tài

**Mô tả:** Đấu trắc nghiệm 1-1 giữa các học sinh và máy

**Cơ chế:** Ghép cặp theo điểm rank cùng khối để đảm bảo trận đấu cân sức.

**Tại sao:** Đây là tính năng cốt lõi tạo lý do quay lại hàng ngày \- trận đấu ngắn, ngẫu nhiên, dễ chơi.

**Acceptance:** Học sinh tìm được đối thủ trong \< 30s; trận đấu hoàn tất trong \< 5 phút; điểm và rank cập nhật ngay sau trận.

# QA \- Kịch bản

## **I. TỔNG QUAN TÍNH NĂNG (OVERVIEW)**

* **Tên tính năng:** So Tài  
* **Thể loại:** PvP (Player vs Player) / PvE (Player vs Bot) thời gian thực.  
* **Mục tiêu:** Tạo thói quen học tập và đăng nhập hàng ngày thông qua các trận đấu nhanh, kịch tính, tăng tính gắn kết của học sinh với hệ thống và đồng bộ điểm số trực tiếp về hệ thống học tập UniClass.

## **II. LUỒNG TRẢI NGHIỆM NGƯỜI DÙNG (USER FLOW)**

1. **Sảnh chờ (Lobby):**  
   * Học sinh vào mục So tài. Hệ thống tự động nhận diện khối lớp của học sinh.  
   * Học sinh không cần chọn độ khó. Hệ thống sẽ tự động xác định nhóm năng lực đấu hiện tại của học sinh (Dễ, Trung bình, hoặc Khó) dựa trên lịch sử đấu.  
   * Học sinh chỉ cần bấm duy nhất nút "Tìm Đối Thủ".  
2. **Ghép trận (Matchmaking):**  
   * Màn hình hiển thị radar tìm kiếm hoặc hoạt hình đếm giây.  
   * Hệ thống ghép cặp các học sinh trong cùng Khối lớp và thuộc cùng Nhóm năng lực đấu một cách tự động.  
3. **Vào trận (Versus Screen):**  
   * Hiển thị màn hình VS trong 3 giây để tăng tính đối kháng.  
   * Thông tin hiển thị: Avatar, Tên (Nickname) và Khối lớp của 2 bên. (Không hiển thị Rank, không hiển thị độ khó trận đấu để tránh áp lực tâm lý).  
4. **Thi đấu (Gameplay):**  
   * Lần lượt 10 câu hỏi hiện ra với thời lượng đếm ngược riêng biệt cho từng câu.  
   * Cả hai người chơi cùng trả lời đồng thời.  
   * Điểm số tích lũy (giảm dần theo thời gian trả lời của từng câu) của cả hai bên được hiển thị trực quan và cập nhật thời gian thực (real-time).  
5. **Kết thúc & Nhận thưởng (Result):**  
   * Hiển thị kết quả Thắng / Thua (Tuyệt đối không có kết quả Hòa).  
   * Hiển thị thông số chi tiết: Số câu trả lời đúng, Tổng điểm tích lũy trong trận, và Tổng thời gian trả lời đúng của cả hai để làm rõ lý do thắng thua và minh chứng cho việc ai phản xạ nhanh hơn.  
   * Hệ thống thực hiện cuộc gọi API đồng bộ điểm số học tập (UniPoint) về tài khoản UniClass của học sinh ngay lập tức.  
   * Trở về sảnh chờ.

## **III. LUẬT THI ĐẤU & CƠ CHẾ TÍNH ĐIỂM (GAMEPLAY MECHANICS)**

### **1\. Quy tắc Trận đấu**

* **Số lượng câu hỏi:** Cố định đúng 10 câu hỏi trắc nghiệm (mỗi câu gồm 4 đáp án A, B, C, D) cho mỗi trận đấu.  
* **Tính độc nhất của câu hỏi:** Hệ thống cấu hình bộ câu hỏi đấu trường sao cho các câu hỏi không được trùng nhau trong cùng một trận đấu, đồng thời hạn chế tối đa việc lặp lại câu hỏi đã từng làm của học sinh trong các trận gần nhất (sử dụng danh sách loại trừ ID câu hỏi).  
* **Thời gian mỗi câu:** Có thể khác nhau tùy thuộc vào cấu hình của từng câu hỏi (ví dụ: câu lý thuyết ngắn là 15 giây, câu tính toán toán học là 30 giây).  
* **Chuyển câu mới:** Hệ thống chuyển sang câu hỏi tiếp theo sau 3 giây kể từ khi cả hai người chơi đã hoàn thành việc bấm chọn đáp án, hoặc khi thời gian đếm ngược của câu đó kết thúc.

### **2\. Công thức Tính điểm Tích lũy trong Trận (In-match Score)**

Để thể hiện yếu tố tốc độ phản xạ, điểm số nhận được cho mỗi câu trả lời đúng sẽ giảm dần theo thời gian. Trả lời càng nhanh, điểm nhận được càng gần mức tối đa.

**Các thông số tính toán:**

* **Điểm tối đa của câu hỏi:** Điểm số tối đa thiết lập cho mỗi câu (ví dụ mặc định: 1000 điểm).  
* **Thời gian tối đa của câu hỏi:** Thời gian trả lời tối đa của câu hỏi (tính bằng giây).  
* **Thời gian phản xạ thực tế:** Thời gian người chơi bấm chọn đáp án (tính bằng giây).  
* **Hệ số bảo toàn điểm tối thiểu:** Mặc định là 0.5 (nghĩa là trả lời đúng ở giây cuối cùng vẫn nhận được tối thiểu 50% số điểm tối đa của câu đó).

**Công thức tính điểm cho từng câu hỏi:**

* Nếu trả lời SAI hoặc KHÔNG trả lời:  
  * Điểm nhận được \= 0 điểm.  
* Nếu trả lời ĐÚNG:  
  * Điểm nhận được \= Điểm tối đa của câu \* \[ 1 \- ( 0.5 \* ( Thời gian phản xạ thực tế / Thời gian tối đa của câu ) ) \]

*Ví dụ minh họa: Câu hỏi có điểm tối đa là 1000 điểm, thời gian tối đa là 20 giây. Học sinh trả lời đúng ở giây thứ 5 (thời gian phản xạ thực tế là 5 giây):*

* *Điểm nhận được \= 1000 \* \[ 1 \- ( 0.5 \* ( 5 / 20 ) ) \] \= 1000 \* \[ 1 \- 0.125 \] \= 875 điểm.*

**Tổng điểm trận đấu (Match Score):**

Là tổng điểm tích lũy của người chơi sau 10 câu hỏi. Người chơi có tổng điểm trận đấu cao hơn sẽ giành chiến thắng chung cuộc.

### **3\. Cơ chế Phân định Thắng \- Thua khi Bằng điểm (Tie-Breaker)**

Mặc dù điểm tích lũy được tính chi tiết dưới dạng số thập phân và cực kỳ khó trùng nhau, hệ thống vẫn quy định quy trình phân định thắng thua phụ chặt chẽ dưới đây để đảm bảo **tuyệt đối không có kết quả Hòa**:

* **Trường hợp 1: Khác biệt về số câu đúng**  
  * Nếu hai người chơi có cùng số câu đúng (ví dụ: cả hai cùng đúng 7/10 câu), người chơi nào trả lời nhanh hơn (đạt tổng điểm trận đấu cao hơn nhờ điểm bị giảm thiểu ít hơn) sẽ Thắng.  
* **Trường hợp 2: Bằng điểm tích lũy tuyệt đối (Tổng điểm người chơi 1 \= Tổng điểm người chơi 2\)**  
  * Hệ thống sẽ so sánh **Tổng thời gian trả lời đúng**: Là tổng thời gian phản xạ của tất cả các câu hỏi mà người chơi đó trả lời đúng.  
    * Tổng thời gian trả lời đúng \= Thời gian câu 1 (nếu đúng) \+ Thời gian câu 2 (nếu đúng) \+ ... \+ Thời gian câu 10 (nếu đúng).  
    * Người chơi có Tổng thời gian trả lời đúng nhỏ hơn (tức là phản xạ nhanh hơn trong các câu trả lời đúng) sẽ Thắng.  
  * Nếu Tổng thời gian trả lời đúng của hai bên vẫn bằng nhau tuyệt đối (đến phần nghìn giây):  
    * Hệ thống so sánh nhãn thời gian thực tế (timestamp) khi gửi câu trả lời cuối cùng lên hệ thống. Người chơi nào hoàn thành trận đấu sớm hơn về mặt thời gian thực tế sẽ Thắng.

### **4\. Cơ chế Tính Điểm thưởng Đồng bộ UniClass (Earned UniPoints)**

Khác với điểm số kịch tính dùng để phân định thắng thua trong trận, điểm số thực tế đồng bộ về tài khoản học tập UniClass của học sinh được tính dựa trên số câu trả lời đúng để đảm bảo tính công bằng trong học tập:

* Điểm đồng bộ về UniClass \= Tổng số câu trả lời đúng trong trận \* Điểm UniPoint cấu hình cho một câu đúng.  
* Trong đó:  
  * Tổng số câu trả lời đúng trong trận: Giá trị từ 0 đến 10\.  
  * Điểm UniPoint cấu hình cho một câu đúng: Ví dụ mặc định là 10 điểm UniPoint / câu.

*Ví dụ: Cả hai người chơi đều trả lời đúng 8 câu. Người chơi A nhanh hơn nên thắng trận đấu. Tuy nhiên, khi đồng bộ về UniClass, cả hai người chơi đều nhận được điểm số học tập bằng nhau là: 8 \* 10 \= 80 UniPoints.*

### **5\. Thiết kế Giao diện Hiển thị Điểm và Thời gian (UI/UX)**

* **Hiệu ứng điểm giảm dần (Decaying Progress Bar):** Trên màn hình thi đấu, bên cạnh đồng hồ đếm ngược, hiển thị thanh điểm số tiềm năng của câu hỏi đó (ví dụ: đang chạy lùi từ 1000 điểm dần về 500 điểm). Học sinh bấm chọn đáp án càng nhanh thì thanh điểm dừng lại ở mốc càng cao.  
* **Hiển thị sau mỗi câu:** Khi câu hỏi kết thúc, hệ thống hiển thị số điểm cộng thêm của mỗi người dựa trên tốc độ phản xạ của họ (ví dụ: cộng 850 điểm cho người nhanh và cộng 610 điểm cho người chậm hơn).  
* **Màn hình kết quả (Result Screen):** Hiển thị rõ các thông số:  
  * Số câu đúng (Ví dụ: 7/10).  
  * Tổng điểm trận đấu (Match Score).  
  * Tổng thời gian của các câu trả lời đúng để làm minh chứng rõ ràng cho chiến thắng nhờ tốc độ phản xạ nhanh hơn (nhất là trong trường hợp bằng điểm nhau).

## **IV. HỆ THỐNG GHÉP TRẬN (MATCHMAKING) & TỰ ĐỘNG PHÂN ĐỘ KHÓ**

Hệ thống loại bỏ hoàn toàn cơ chế ghép trận theo Rank hoặc cho phép tự chọn độ khó. Thay vào đó, hệ thống tự động phân loại học sinh vào nhóm năng lực và ghép trận tương ứng.

### **1\. Phân loại Mức độ Khó của Câu hỏi**

Độ khó của một câu hỏi được tính toán hoàn toàn tự động dựa trên chỉ số dữ liệu làm bài thực tế của toàn hệ thống:

* **Tỷ lệ trả lời đúng trung bình của câu hỏi:** Được tính bằng (Tổng số lượt trả lời đúng / Tổng số lượt làm bài của câu hỏi đó trên toàn hệ thống từ trước đến nay) \* 100%.  
* **Cấu hình mốc điểm (Threshold Configuration):** Quản trị viên (Admin) có thể cấu hình các mốc tỷ lệ trả lời đúng để phân loại câu hỏi vào các giỏ độ khó khác nhau:  
  * **Giỏ Dễ:** Các câu hỏi có tỷ lệ đúng \>= Mốc Dễ (Ví dụ: Tỷ lệ đúng \>= 75%).  
  * **Giỏ Trung bình:** Các câu hỏi có mốc nằm giữa Mốc Khó và Mốc Dễ (Ví dụ: Tỷ lệ đúng nằm trong khoảng từ 40% đến 75%).  
  * **Giỏ Khó:** Các câu hỏi có tỷ lệ đúng \<= Mốc Khó (Ví dụ: Tỷ lệ đúng \<= 40%).

### **2\. Thuật toán Tự động Xác định Nhóm Năng lực Học sinh**

Khi học sinh bấm "Tìm Đối Thủ", hệ thống sẽ chạy thuật toán xác định nhóm năng lực hiện tại của học sinh dựa trên tỷ lệ làm đúng trung bình của học sinh trong tất cả các lượt chơi thực tế (hoặc tính trong 10 trận đấu gần nhất để cập nhật phong độ nhanh hơn):

* Nếu học sinh mới chơi (chưa có dữ liệu): Mặc định xếp vào nhóm **Trung bình**.  
* **Cách tính tỷ lệ đúng của học sinh:**  
  * Tỷ lệ đúng của học sinh \= (Tổng số câu học sinh trả lời đúng từ trước tới nay / Tổng số câu học sinh đã làm) \* 100%.  
* **Phân nhóm tự động theo mốc cấu hình:**  
  * Tỷ lệ đúng của học sinh \< Mốc năng lực Dễ (Ví dụ: dưới 45%): Xếp vào nhóm năng lực Dễ (Hệ thống tự chọn đề thi đấu từ Giỏ Dễ).  
  * Tỷ lệ đúng nằm giữa Mốc năng lực Dễ và Mốc năng lực Khó (Ví dụ: từ 45% đến dưới 75%): Xếp vào nhóm năng lực Trung bình (Hệ thống tự chọn đề thi đấu từ Giỏ Trung bình).  
  * Tỷ lệ đúng của học sinh \>= Mốc năng lực Khó (Ví dụ: từ 75% trở lên): Xếp vào nhóm năng lực Khó (Hệ thống tự chọn đề thi đấu từ Giỏ Khó).

### **3\. Thuật toán Ghép trận theo Thời gian**

Thời gian tìm trận tối đa là 30 giây:

* **0 \- 15 giây đầu:** Hệ thống tìm kiếm một người chơi thật khác (Real Player) đang online, cùng Khối lớp và thuộc cùng Nhóm năng lực (Dễ/Trung bình/Khó) tự động được tính ở trên.  
* **Từ giây thứ 16 đến 30:** Nếu không tìm thấy người chơi thật phù hợp, hệ thống sẽ tự động tạo một Bot (AI) thuộc nhóm năng lực tương ứng để đấu cùng người chơi.  
  * **Bot Avatar / Tên:** Lấy ngẫu nhiên từ thư viện hệ thống.  
  * **Cấu hình Bot (Bot Skill):** Tương thích hoàn toàn với nhóm năng lực trận đấu để tạo thế trận kịch tính:  
    * *Trận Dễ:* Bot có tỷ lệ trả lời đúng ngẫu nhiên trong khoảng từ 30% đến 50%, tốc độ phản xạ trung bình chậm.  
    * *Trận Trung bình:* Bot có tỷ lệ đúng trong khoảng từ 55% đến 75%, tốc độ phản xạ vừa phải.  
    * *Trận Khó:* Bot có tỷ lệ đúng trong khoảng từ 80% đến 95%, tốc độ phản xạ rất nhanh.

## **V. ĐỒNG BỘ ĐIỂM SỐ VỀ UNICLASS (INTEGRATION)**

Hệ thống Quiz Arena đóng vai trò như một hoạt động học tập tương tác bổ trợ. Điểm số học tập tích lũy sau mỗi trận đấu sẽ được cập nhật trực tiếp vào hệ thống cơ sở dữ liệu học tập UniClass.

* **Thời điểm đồng bộ:** Ngay sau khi trận đấu kết thúc (màn hình kết quả hiển thị và người chơi ấn xác nhận hoặc sau khi hết thời gian chờ ở màn hình kết quả).  
* **Dữ liệu đồng bộ gửi lên API UniClass:** *Sẽ cập nhật sau*  
* **Bảo mật:** API đồng bộ điểm phải được mã hóa mã chữ ký (Signature MD5/SHA256 kèm Secret Key) để tránh việc người chơi can thiệp Client-side gửi gói tin giả lập điểm số lên hệ thống UniClass.

## **VI. CƠ CHẾ XỬ LÝ NGOẠI LỆ (EDGE CASES)**

1. **Mất mạng / Thoát ứng dụng (Disconnect):**  
   * Nếu một người chơi bị mất kết nối hoặc thoát ứng dụng giữa chừng, hệ thống sẽ hiển thị trạng thái "Mất kết nối" ở avatar của họ. Trận đấu vẫn tiếp diễn bình thường đối với người còn lại.  
   * Người ở lại vẫn tiếp tục trả lời các câu hỏi tiếp theo và tích lũy điểm dựa trên tốc độ trả lời của riêng mình.  
   * Người bị disconnect sẽ nhận 0 điểm cho toàn bộ các câu hỏi còn lại kể từ thời điểm thoát. Điểm số học tập thực tế nhận được (tương ứng số câu đúng trước khi thoát) vẫn được đồng bộ bình thường về UniClass. Người này chắc chắn sẽ nhận kết quả Thua nếu đối thủ có tổng điểm tích lũy cao hơn.  
2. **Treo máy (AFK):**  
   * Nếu người chơi không đưa ra bất kỳ lựa chọn đáp án nào trong 3 câu hỏi liên tiếp, hệ thống sẽ tự động xử lý thua cuộc do AFK.  
   * Đối thủ còn lại sẽ nhận kết quả thắng ngay lập tức. Điểm số tích lũy (Match Score) của đối thủ được tính bằng số điểm thực tế tại thời điểm đó cộng với điểm số tối đa của các câu còn lại (để tránh thiệt thòi điểm số đồng bộ UniClass).

## **VII. CẤU HÌNH HỆ THỐNG TRÊN TRANG QUẢN TRỊ (CMS CONFIGURATIONS)**

Để đảm bảo tính linh hoạt trong quá trình vận hành trò chơi mà không cần can thiệp vào mã nguồn của ứng dụng, trang quản trị (CMS) phải cung cấp giao diện cho phép cấu hình các thông số cốt lõi sau:

### **1\. Cấu hình Luật chơi & Tính điểm**

* **Số câu hỏi mỗi vòng:** Số lượng câu hỏi xuất hiện trong một trận đấu (Mặc định: 10 câu, cho phép cấu hình thay đổi linh hoạt từ 5 đến 15 câu).  
* **Số điểm tối đa trên một câu hỏi:** Mốc điểm tích lũy trong trận để tính tốc độ phản xạ (Mặc định: 1000 điểm/câu).  
* **Tỷ lệ trượt điểm (Hệ số bảo toàn điểm tối thiểu):** Tỷ lệ phần trăm điểm số tối thiểu mà học sinh chắc chắn nhận được khi trả lời đúng ở giây cuối cùng (Mặc định: 0.5 \- tương đương bảo toàn tối thiểu 50% số điểm tối đa của câu).  
* **Điểm UniPoint của 1 câu đúng:** Số điểm học tập thực tế đồng bộ về UniClass khi trả lời đúng một câu hỏi (Mặc định: 10 UniPoint/câu).

### **2\. Cấu hình Ghép trận & Thời gian tìm trận**

* **Thời gian tìm trận tối đa:** Tổng thời lượng tối đa cho phép hệ thống tìm kiếm đối thủ (Mặc định: 30 giây).  
* **Thời gian tìm người chơi thật:** Khoảng thời gian hệ thống ưu tiên quét tìm đối thủ thực tế thuộc cùng nhóm năng lực trực tuyến (Mặc định: 15 giây đầu tiên).  
* **Thời gian kích hoạt xếp Bot:** Thời điểm hệ thống ngừng tìm người thật và tự động ghép cặp với Bot giả lập (Mặc định: Từ giây thứ 16 của quá trình tìm trận).

### **3\. Cấu hình Phân loại độ khó câu hỏi & Nhóm năng lực học sinh**

* **Mốc phân loại độ khó câu hỏi:**  
  * Tỷ lệ đúng tối thiểu của Giỏ Dễ (Mặc định: \>= 75% số lượt làm bài hệ thống đúng).  
  * Tỷ lệ đúng tối đa của Giỏ Khó (Mặc định: \<= 40% số lượt làm bài hệ thống đúng).  
* **Mốc phân nhóm năng lực học sinh:**  
  * Tỷ lệ đúng tích lũy tối đa để xếp vào nhóm Dễ (Mặc định: \< 45% tổng số câu học sinh làm đúng).  
  * Tỷ lệ đúng tích lũy tối thiểu để xếp vào nhóm Khó (Mặc định: \>= 75% tổng số câu học sinh làm đúng).  
  * Số lượng trận đấu gần nhất dùng để tính toán phong độ năng lực của học sinh (Mặc định: Tính theo 5 trận gần nhất, cho phép đổi cấu hình).

- Một trận sẽ có 10 câu (mỗi câu sẽ có thời lượng khác nhau)  
- Số điểm \= Số câu đúng \* UniPoint của 1 câu đúng  
  - Nếu 2 người bằng điểm nhau \=\> Dựa vào Tổng thời gian trả lời đúng \=\> ngắn hơn thì thắng  
  - Phải thể hiện được thông tin thời gian trả lời nhanh hơn để xác định người thắng trong trường hợp \= điểm nhau  
- Điểm sẽ được đồng bộ về UniClass khi chơi xong game  
- Tìm trận theo 3 mức độ: Khó, Dễ, Trung (Tính toán theo số câu trả lời đúng trung bình trong tất cả lượt chơi) \-\> có config cho mốc điểm  
- Bỏ hệ thống Rank  
- Đảm bảo các câu hỏi không được trùng nhau

# QA \- Giao diện
