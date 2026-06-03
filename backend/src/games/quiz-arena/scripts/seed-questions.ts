// ============================================================
// Seed Questions Script — Quiz Arena (So Tài)
// Dùng để khởi tạo dữ liệu câu hỏi mẫu cho local dev
//
// Chạy: npx tsx src/games/quiz-arena/scripts/seed-questions.ts
// ============================================================

import mongoose from 'mongoose';
import { QuestionModel } from '../../../models/index';

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/uniclub';

// 44 câu mẫu: grade 6-12, phân bổ độ khó theo bucket
// Grade 6-8: easy | Grade 9-10: medium | Grade 11-12: hard
const seedQuestions = [
  // --- Grade 6 (easy) ---
  {
    grade: 6,
    content: 'Kết quả của phép tính 12 × 15 là?',
    options: ['170', '180', '175', '165'],
    correctIndex: 1,
    timeLimitSeconds: 20,
    difficultyBucket: 'easy',
  },
  {
    grade: 6,
    content: 'Hành tinh lớn nhất trong Hệ Mặt Trời là?',
    options: ['Sao Thổ', 'Sao Hỏa', 'Sao Mộc', 'Sao Thiên Vương'],
    correctIndex: 2,
    timeLimitSeconds: 15,
    difficultyBucket: 'easy',
  },
  {
    grade: 6,
    content: 'Số nào là số nguyên tố?',
    options: ['9', '15', '21', '17'],
    correctIndex: 3,
    timeLimitSeconds: 20,
    difficultyBucket: 'easy',
  },
  {
    grade: 6,
    content: 'Diện tích hình vuông cạnh 8 cm là?',
    options: ['56 cm²', '32 cm²', '64 cm²', '48 cm²'],
    correctIndex: 2,
    timeLimitSeconds: 25,
    difficultyBucket: 'easy',
  },
  {
    grade: 6,
    content: 'Đại dương nào lớn nhất thế giới?',
    options: ['Đại Tây Dương', 'Thái Bình Dương', 'Ấn Độ Dương', 'Bắc Băng Dương'],
    correctIndex: 1,
    timeLimitSeconds: 15,
    difficultyBucket: 'easy',
  },
  {
    grade: 6,
    content: '1/4 + 1/2 bằng bao nhiêu?',
    options: ['2/6', '3/4', '1/6', '2/4'],
    correctIndex: 1,
    timeLimitSeconds: 20,
    difficultyBucket: 'easy',
  },
  {
    grade: 6,
    content: 'Chất nào chiếm nhiều nhất trong không khí?',
    options: ['Oxy', 'CO2', 'Nitơ', 'Hydro'],
    correctIndex: 2,
    timeLimitSeconds: 15,
    difficultyBucket: 'easy',
  },
  {
    grade: 6,
    content: 'Thủ đô của Việt Nam là?',
    options: ['Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Hà Nội'],
    correctIndex: 3,
    timeLimitSeconds: 10,
    difficultyBucket: 'easy',
  },
  // --- Grade 7 (easy) ---
  {
    grade: 7,
    content: 'Công thức tính vận tốc là?',
    options: ['v = s + t', 'v = s × t', 'v = s / t', 'v = t / s'],
    correctIndex: 2,
    timeLimitSeconds: 20,
    difficultyBucket: 'easy',
  },
  {
    grade: 7,
    content: 'Quá trình quang hợp ở thực vật giải phóng chất gì?',
    options: ['CO2', 'Nitơ', 'Oxy', 'Hydro'],
    correctIndex: 2,
    timeLimitSeconds: 15,
    difficultyBucket: 'easy',
  },
  {
    grade: 7,
    content: 'Tỉ lệ 3:4 = ?:12',
    options: ['6', '8', '9', '10'],
    correctIndex: 2,
    timeLimitSeconds: 20,
    difficultyBucket: 'easy',
  },
  {
    grade: 7,
    content: 'Ai là tác giả của "Truyện Kiều"?',
    options: ['Nguyễn Du', 'Hồ Xuân Hương', 'Nguyễn Trãi', 'Nam Quốc Sơn Hà'],
    correctIndex: 0,
    timeLimitSeconds: 15,
    difficultyBucket: 'easy',
  },
  {
    grade: 7,
    content: 'Tế bào là đơn vị cơ bản của?',
    options: ['Hóa học', 'Vật lý', 'Sinh học', 'Toán học'],
    correctIndex: 2,
    timeLimitSeconds: 15,
    difficultyBucket: 'easy',
  },
  {
    grade: 7,
    content: '(-3) × (-4) = ?',
    options: ['-12', '12', '-7', '7'],
    correctIndex: 1,
    timeLimitSeconds: 15,
    difficultyBucket: 'easy',
  },
  {
    grade: 7,
    content: 'Nguyên tố hóa học nào có ký hiệu Au?',
    options: ['Bạc', 'Đồng', 'Sắt', 'Vàng'],
    correctIndex: 3,
    timeLimitSeconds: 15,
    difficultyBucket: 'easy',
  },
  // --- Grade 8 (easy) ---
  {
    grade: 8,
    content: 'Công thức hóa học của nước là?',
    options: ['H2O2', 'HO', 'H2O', 'H3O'],
    correctIndex: 2,
    timeLimitSeconds: 10,
    difficultyBucket: 'easy',
  },
  {
    grade: 8,
    content: 'Nghiệm của phương trình 2x - 6 = 0 là?',
    options: ['x = 2', 'x = 3', 'x = -3', 'x = 6'],
    correctIndex: 1,
    timeLimitSeconds: 20,
    difficultyBucket: 'easy',
  },
  {
    grade: 8,
    content: 'Ánh sáng truyền trong môi trường nào nhanh nhất?',
    options: ['Nước', 'Thủy tinh', 'Chân không', 'Không khí'],
    correctIndex: 2,
    timeLimitSeconds: 15,
    difficultyBucket: 'easy',
  },
  {
    grade: 8,
    content: 'Phương trình hóa học: Fe + 2HCl → FeCl2 + ? là?',
    options: ['O2', 'H2O', 'H2', 'Cl2'],
    correctIndex: 2,
    timeLimitSeconds: 25,
    difficultyBucket: 'easy',
  },
  {
    grade: 8,
    content: 'Tam giác có ba góc đều bằng 60° gọi là?',
    options: ['Tam giác vuông', 'Tam giác cân', 'Tam giác đều', 'Tam giác tù'],
    correctIndex: 2,
    timeLimitSeconds: 15,
    difficultyBucket: 'easy',
  },
  {
    grade: 8,
    content: 'Đơn vị đo điện áp là?',
    options: ['Ampe', 'Watt', 'Ohm', 'Volt'],
    correctIndex: 3,
    timeLimitSeconds: 15,
    difficultyBucket: 'easy',
  },
  // --- Grade 9 (medium) ---
  {
    grade: 9,
    content: 'Định luật Ohm: I = ?',
    options: ['U × R', 'U / R', 'R / U', 'U + R'],
    correctIndex: 1,
    timeLimitSeconds: 20,
    difficultyBucket: 'medium',
  },
  {
    grade: 9,
    content: 'DNA là viết tắt của?',
    options: [
      'Deoxyribonucleic Acid',
      'Deoxyribose Nucleic Acid',
      'Double Nucleus Acid',
      'Deoxyribosome Nucleic Acid',
    ],
    correctIndex: 0,
    timeLimitSeconds: 20,
    difficultyBucket: 'medium',
  },
  {
    grade: 9,
    content: 'Giải phương trình: x² - 9 = 0, x = ?',
    options: ['x = 3', 'x = ±3', 'x = -3', 'x = 9'],
    correctIndex: 1,
    timeLimitSeconds: 25,
    difficultyBucket: 'medium',
  },
  {
    grade: 9,
    content: 'Nhà Trần được thành lập vào năm nào?',
    options: ['1010', '1225', '1428', '1527'],
    correctIndex: 1,
    timeLimitSeconds: 20,
    difficultyBucket: 'medium',
  },
  {
    grade: 9,
    content: 'Châu lục nào có diện tích lớn nhất?',
    options: ['Châu Mỹ', 'Châu Phi', 'Châu Á', 'Châu Âu'],
    correctIndex: 2,
    timeLimitSeconds: 15,
    difficultyBucket: 'medium',
  },
  {
    grade: 9,
    content: 'Kim loại nào dẫn điện tốt nhất?',
    options: ['Vàng', 'Nhôm', 'Bạc', 'Đồng'],
    correctIndex: 2,
    timeLimitSeconds: 20,
    difficultyBucket: 'medium',
  },
  // --- Grade 10 (medium) ---
  {
    grade: 10,
    content: 'Sin(30°) = ?',
    options: ['√3/2', '1/2', '√2/2', '1'],
    correctIndex: 1,
    timeLimitSeconds: 20,
    difficultyBucket: 'medium',
  },
  {
    grade: 10,
    content: 'Phương trình bậc hai ax² + bx + c = 0 có nghiệm kép khi?',
    options: ['Δ > 0', 'Δ < 0', 'Δ = 0', 'a = 0'],
    correctIndex: 2,
    timeLimitSeconds: 25,
    difficultyBucket: 'medium',
  },
  {
    grade: 10,
    content: 'Nguyên lý bảo toàn năng lượng phát biểu gì?',
    options: [
      'Năng lượng có thể tự sinh ra',
      'Năng lượng không tự sinh ra cũng không tự mất đi',
      'Năng lượng luôn tăng theo thời gian',
      'Năng lượng bằng khối lượng nhân vận tốc',
    ],
    correctIndex: 1,
    timeLimitSeconds: 25,
    difficultyBucket: 'medium',
  },
  {
    grade: 10,
    content: 'Công thức tính động năng là?',
    options: ['Ek = mv', 'Ek = ½mv²', 'Ek = mv²', 'Ek = mgh'],
    correctIndex: 1,
    timeLimitSeconds: 20,
    difficultyBucket: 'medium',
  },
  {
    grade: 10,
    content: 'Tế bào nhân thực (eukaryote) có đặc điểm gì?',
    options: [
      'Không có màng nhân',
      'Không có ti thể',
      'Có màng nhân hoàn chỉnh',
      'Chỉ tồn tại ở vi khuẩn',
    ],
    correctIndex: 2,
    timeLimitSeconds: 20,
    difficultyBucket: 'medium',
  },
  // --- Grade 11 (hard) ---
  {
    grade: 11,
    content: 'Giới hạn lim(x→0) (sin x / x) = ?',
    options: ['0', '∞', '1', 'x'],
    correctIndex: 2,
    timeLimitSeconds: 25,
    difficultyBucket: 'hard',
  },
  {
    grade: 11,
    content: 'Nguyên tố nào có số hiệu nguyên tử là 6?',
    options: ['Nitơ', 'Oxy', 'Carbon', 'Hydro'],
    correctIndex: 2,
    timeLimitSeconds: 20,
    difficultyBucket: 'hard',
  },
  {
    grade: 11,
    content: 'Điện trường đều là điện trường có?',
    options: [
      'Véc-tơ cường độ biến đổi theo điểm',
      'Véc-tơ cường độ như nhau tại mọi điểm',
      'Chỉ tồn tại giữa hai bản tụ điện',
      'Cường độ bằng 0',
    ],
    correctIndex: 1,
    timeLimitSeconds: 25,
    difficultyBucket: 'hard',
  },
  {
    grade: 11,
    content: 'Chuỗi Fibonacci bắt đầu với 0, 1, 1, 2, 3, 5, ... Số tiếp theo là?',
    options: ['7', '8', '9', '10'],
    correctIndex: 1,
    timeLimitSeconds: 20,
    difficultyBucket: 'hard',
  },
  {
    grade: 11,
    content: 'Ai phát hiện ra cấu trúc xoắn kép của DNA?',
    options: ['Einstein', 'Watson và Crick', 'Darwin', 'Mendel'],
    correctIndex: 1,
    timeLimitSeconds: 20,
    difficultyBucket: 'hard',
  },
  // --- Grade 12 (hard) ---
  {
    grade: 12,
    content: 'Tích phân ∫(2x)dx = ?',
    options: ['x + C', 'x² + C', '2 + C', '2x² + C'],
    correctIndex: 1,
    timeLimitSeconds: 30,
    difficultyBucket: 'hard',
  },
  {
    grade: 12,
    content: 'Phương trình Schrödinger mô tả gì?',
    options: [
      'Trạng thái của electron trong nguyên tử',
      'Chuyển động của hành tinh',
      'Tốc độ ánh sáng',
      'Lực hấp dẫn',
    ],
    correctIndex: 0,
    timeLimitSeconds: 25,
    difficultyBucket: 'hard',
  },
  {
    grade: 12,
    content: 'Hệ số góc của tiếp tuyến với đồ thị y = x³ tại x = 2 là?',
    options: ['6', '8', '12', '4'],
    correctIndex: 2,
    timeLimitSeconds: 30,
    difficultyBucket: 'hard',
  },
  {
    grade: 12,
    content: 'Chiến thắng Điện Biên Phủ xảy ra vào năm nào?',
    options: ['1950', '1954', '1975', '1945'],
    correctIndex: 1,
    timeLimitSeconds: 15,
    difficultyBucket: 'hard',
  },
  {
    grade: 12,
    content: 'Entropy trong nhiệt động lực học đo lường gì?',
    options: ['Nhiệt độ', 'Áp suất', 'Độ hỗn loạn hệ thống', 'Thể tích'],
    correctIndex: 2,
    timeLimitSeconds: 25,
    difficultyBucket: 'hard',
  },
  {
    grade: 12,
    content: 'Số e (hằng số Euler) xấp xỉ bằng?',
    options: ['2.618', '3.141', '2.718', '1.618'],
    correctIndex: 2,
    timeLimitSeconds: 20,
    difficultyBucket: 'hard',
  },
  {
    grade: 12,
    content: 'Phương trình nào là phương trình sóng điện từ?',
    options: [
      '∇²E = μεd²E/dt²',
      'F = ma',
      'E = mc²',
      'ΔE·Δt ≥ ℏ/2',
    ],
    correctIndex: 0,
    timeLimitSeconds: 30,
    difficultyBucket: 'hard',
  }
];

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('[Seed] Connected to MongoDB');

  const count = await QuestionModel.countDocuments();
  if (count > 0) {
    console.log(`[Seed] ${count} questions already exist. Skipping seed (use --force to override).`);
    if (!process.argv.includes('--force')) {
      await mongoose.disconnect();
      return;
    }
    console.log('[Seed] --force detected. Clearing existing questions...');
    await QuestionModel.deleteMany({});
  }

  await QuestionModel.insertMany(seedQuestions);
  console.log(`[Seed] Inserted ${seedQuestions.length} questions.`);

  await mongoose.disconnect();
  console.log('[Seed] Done.');
}

seed().catch((err) => {
  console.error('[Seed] Error:', err);
  process.exit(1);
});
