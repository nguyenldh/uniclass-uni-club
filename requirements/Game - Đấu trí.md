# Đấu trí

**Mô tả:** Game trí tuệ \- đấu với người hoặc với máy.

**Tại sao:** Đa dạng hoá trải nghiệm, phục vụ học sinh thích tư duy logic ngoài kiến thức trường lớp; chế độ "đấu với máy" để học sinh chơi được kể cả khi không có đối thủ online.

**Acceptance:** Các game có chế độ vs máy với 3 mức độ khó; chế độ vs người có matchmaking \< 30s.

# MG \- Kịch bản tổng quát

## **I. Danh sách Trò chơi Cốt lõi (Các Game Chốt)**

Hệ thống tập trung tối ưu hóa trải nghiệm vào hai trò chơi chính dưới đây:

### **A. Trò chơi: Lật mảnh ghép (Memory Match)**

Thể loại rèn luyện trí nhớ ngắn hạn thông qua việc tìm các cặp hình giống nhau.

* **Chế độ chơi:** Người dùng được chủ động lựa chọn một trong hai chế độ trước khi bắt đầu:  
  1. **Chế độ Cơ bản (Basic Mode):**  
     * Thời gian chơi được cố định sẵn (mặc định theo cấu hình hệ thống).  
     * Người chơi cần hoàn thành việc lật tất cả các cặp mảnh ghép trước khi hết giờ.  
  2. **Chế độ Nâng cao (Advanced Mode):**  
     * Người chơi bắt đầu với một lượng thời gian cơ bản.  
     * **Cơ chế thưởng thời gian (Time Bonus):** Mỗi khi người chơi chọn đúng một cặp mảnh ghép, hệ thống sẽ cộng thêm một lượng thời gian nhất định vào quỹ thời gian hiện tại.  
     * *Lưu ý kỹ thuật:* Lượng thời gian cộng thêm này phải được thiết lập thông qua hệ thống cấu hình (Config) để dễ dàng tùy chỉnh sau này mà không cần can thiệp vào mã nguồn.  
* **Cơ chế tính điểm:**  
  1. Số điểm sẽ bằng số lần lật đúng, số điểm sẽ được config

### **B. Trò chơi: Cờ Caro (Gomoku)**

Trò chơi đòi hỏi tư duy logic và chiến thuật cao trên bàn cờ mở rộng.

* **Cơ chế ghép trận (Matchmaking):**  
  * Khi người chơi chọn chơi Cờ Caro, hệ thống sẽ tự động tìm kiếm và kết nối với những người chơi khác đang online.  
  * **Xử lý thời gian chờ:** Hệ thống sẽ đếm ngược thời gian ghép trận. Nếu sau 30 giây vẫn không tìm thấy đối thủ là người chơi thực tế, hệ thống sẽ tự động chuyển hướng người chơi sang chế độ **Đấu với Máy (AI)**.  
  * **Mức độ AI:** Máy được thiết lập ở mức độ **Trung bình (Medium)** để đảm bảo tính thử thách vừa phải, không quá dễ nhưng cũng không quá khó gây nản lòng cho người chơi.  
* **Cơ chế tính điểm:**  
  * Thắng được điểm theo config

## **II. Cơ chế Tính điểm & Phần thưởng**

Hệ thống điểm số được đơn giản hóa tối đa để tăng tính tập trung vào trải nghiệm giải trí lành mạnh:

* **Công thức tính điểm:**  
  * **Thắng trận:** Người chơi được cộng thêm điểm số tích lũy. Lượng điểm cộng này có thể tùy chỉnh linh hoạt thông qua hệ thống cấu hình (Config).  
  * **Thua trận:** Người chơi không được cộng điểm (0 điểm).  
* **Thay đổi hệ thống:**  
  * Loại bỏ hoàn toàn chế độ phân bậc xếp hạng (Ranking) và hệ thống điểm Elo để giảm áp lực cạnh tranh không cần thiết cho người dùng.

## **III. Luồng trải nghiệm người dùng cập nhật (User Flow)**

Luồng đi của người dùng được thiết kế lại tối giản và trực diện hơn:

1. **Màn hình chính:** Người dùng lựa chọn một trong hai trò chơi: **Lật mảnh ghép** hoặc **Cờ Caro**.  
2. **Luồng trò chơi "Lật mảnh ghép":**  
   * Người dùng chọn chế độ chơi: **Basic (Cố định giờ)** hoặc **Advanced (Cộng giờ khi chọn đúng)**.  
   * Hệ thống tải màn chơi \-\> Người chơi thực hiện lật hình.  
   * Kết thúc màn chơi \-\> Hiển thị màn hình kết quả:  
3. **Luồng trò chơi "Cờ Caro":**  
   * Người dùng nhấn nút bắt đầu \-\> Hệ thống hiển thị màn hình chờ ghép trận với đồng hồ đếm ngược 30 giây.  
   * **Kịch bản 1 (Tìm thấy đối thủ \< 30 giây):** Vào trận đấu PvP trực tiếp với người chơi khác.  
   * **Kịch bản 2 (Quá 30 giây không tìm thấy đối thủ):** Hệ thống tự động chuyển vào trận đấu với Máy (Medium AI).  
   * Kết thúc trận đấu \-\> Hiển thị màn hình kết quả:  
     * Nếu Thắng: Cộng điểm tích lũy (lấy từ Config).  
     * Nếu Thua: Không được cộng điểm (0 điểm).

## **IV. Các chỉ số cấu hình trên hệ thống quản trị (CMS Config)**

Để phục vụ công tác vận hành linh hoạt mà không cần can thiệp vào mã nguồn, các chỉ số sau đây cần được thiết lập và quản lý tập trung trên trang quản trị (CMS):

### **A. Cấu hình Trò chơi "Lật mảnh ghép" (Memory Match)**

* **Thời gian chơi Chế độ Cơ bản:** Tổng thời gian chơi cố định của chế độ Cơ bản (Mặc định: 60 giây).  
* **Thời gian xuất phát Chế độ Nâng cao:** Thời gian xuất phát ban đầu của chế độ Nâng cao (Mặc định: 45 giây).  
* **Thời gian cộng thêm khi ghép đúng:** Lượng thời gian cộng thêm khi người chơi ghép đúng một cặp hình (Mặc định: 3 giây).  
* **Điểm thưởng khi thắng:** Điểm số cộng cho người chơi khi thắng cuộc (Mặc định: 50 điểm).

### **B. Cấu hình Trò chơi "Cờ Caro" (Gomoku)**

* **Thời gian tối đa ghép trận PvP:** Thời gian tối đa để chờ ghép trận PvP trước khi tự động chuyển sang đánh với máy AI (Mặc định: 30 giây).  
* **Điểm thưởng khi thắng:** Điểm số cộng cho người chơi khi thắng trận, áp dụng cho cả khi thắng người chơi khác hoặc thắng AI (Mặc định: 100 điểm).

Các Game chốt:

- Lật mảnh ghép  
  - Người dùng được chọn chế độ chơi  
    - Basic: fix cứng giờ  
    - Advanced: Thời gian được bonus thêm bởi việc chọn đúng (Thời gian cộng thêm cần được đưa vào config)  
- Cờ Caro  
  - Cơ chế ghép trận  
    - Sau 30 giây không tìm được người chơi \=\> chơi với máy (Medium)

Công thức tính điểm

- Thắng: Được cộng điểm (Có config)  
- Thua: Không được cộng điểm

Bỏ chế độ chơi  
Bỏ ranking

# MG \- Giao diện