**Docx tích hợp event game result**

**Kafka Events**

**Topic: club-game-result**

Kết quả từ các game So Tài, Đấu Trí, Cờ Caro, Lật mảnh ghép, Săn Boss.

**Payload (ClubGameResultDto):**

{

  "profile\_id": "12345",

  "game\_type": "SO\_TAI",

  "point": 50,

  "play\_time": 600,

  "session\_completed": true,

  "is\_win": true,

  "correct\_count": 8,

  "total\_questions": 10,

  "duration\_seconds": 55,

  "consecutive\_pairs": 3

}

| Field | Ý nghĩa |
| :---- | :---- |
| gameType | SO\_TAI| CARO | LAT\_MANH\_GHEP | SAN\_BOSS |
| point | Số UniPoint được cộng trực tiếp từ kết quả game |
| playTime | Thời gian chơi tính bằng giây |
| sessionCompleted | Đã hoàn thành phiên chơi (không thoát giữa chừng) |
| isWin | Có thắng không (dùng cho task thắng liên tiếp) |
| correctCount | Số câu đúng (dùng cho task So Tài) |
| durationSeconds | Thời gian hoàn thành (dùng cho task Lật mảnh ghép 60s) |
| consecutivePairs | Số cặp ghép liên tiếp đúng (dùng cho task 10\) |

**Xử lý:**

1. Cộng point vào weekly ranking và lifetime stat

2. Cập nhật tiến độ nhiệm vụ ngày

3. Cập nhật streak (và shield nếu cần) \+ ghi lịch sử ngày hoạt động

---

**Topic: club-weekly-event**

Kết quả Săn Boss trong Weekly Event.

**Payload (ClubWeeklyEventDto):**

{

  "id\_profile": "12345",

  "type": "WEEKLY\_EVENT",

  "data": {

    "quiz": {

      "week": 21,

      "year": 2026,

      "point": 150,

      "correct\_count": 8,

      "total\_questions": 10,

      "session\_completed": true,

      "play\_time": 300,

      "start\_time": 1748217600000,

      "end\_time": 1748304000000

    }

  }

}

