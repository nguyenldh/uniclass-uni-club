// ============================================================
// Script giả lập bắn socket event Boss Battle để test hiệu ứng
// Cách dùng: node scripts/test-boss-socket.js
//
// Script gọi admin API endpoint để server emit socket event
// đến room, frontend sẽ nhận event như thật.
//
// Tuỳ chỉnh WEEK_KEY, GRADE, API_URL qua env vars.
// ============================================================

const API_URL = process.env.API_URL || 'http://localhost:3000';
const WEEK_KEY = process.env.WEEK_KEY || '2026-W23';
const GRADE_LEVEL = parseInt(process.env.GRADE || '10', 10);
const HIT_INTERVAL_MS = parseInt(process.env.INTERVAL || '500', 10);

// Admin token — lấy từ CMS login hoặc tạo JWT thủ công
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

// Tên giả lập ngẫu nhiên
const FAKE_NAMES = [
  'Nguyễn Văn An', 'Trần Thị Bích', 'Lê Hoàng Nam', 'Phạm Minh Tuấn',
  'Vũ Thu Hằng', 'Đặng Quốc Bảo', 'Bùi Thanh Tùng', 'Ngô Hạnh Linh',
  'Hoàng Đức Anh', 'Lý Phúc Khang', 'Trịnh Ngọc Quyên', 'Đỗ Quang Minh',
];

function randomName() {
  return FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)];
}

function randomPoints() {
  return Math.floor(Math.random() * 80) + 20; // 20-100 điểm
}

// ---- Gọi admin API để emit socket event ----
async function emitHpUpdate(payload) {
  try {
    const res = await fetch(`${API_URL}/api/admin/boss-battle/test/emit-hp-update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ADMIN_TOKEN ? { Authorization: `Bearer ${ADMIN_TOKEN}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) {
      console.error('❌ API error:', data.error);
    }
    return data;
  } catch (err) {
    console.error('❌ Fetch error:', err.message);
    return null;
  }
}

// ---- Giả lập ----
let progressPercent = 0;
let totalPointsEarned = 0;
const HP_MAX = 50000; // giả lập hpMax

async function startSimulation() {
  console.log('🎮 Bắt đầu giả lập hit boss mỗi', HIT_INTERVAL_MS, 'ms');
  console.log(`   weekKey=${WEEK_KEY}, gradeLevel=${GRADE_LEVEL}`);
  console.log('   Nhấn Ctrl+C để dừng\n');

  const interval = setInterval(async () => {
    const hitPoints = randomPoints();
    totalPointsEarned += hitPoints;
    progressPercent = Math.min(100, (totalPointsEarned / HP_MAX) * 100);

    const willDefeat = progressPercent >= 100;
    const status = willDefeat ? 'DEFEATED' : 'ACTIVE';

    const payload = {
      weekKey: WEEK_KEY,
      gradeLevel: GRADE_LEVEL,
      totalPointsEarned,
      progressPercent: Math.round(progressPercent * 1000) / 1000,
      currentBossStateImg: progressPercent < 33
        ? '/images/boss/1.webp'
        : progressPercent < 66
          ? '/images/boss/2.webp'
          : '/images/boss/3.webp',
      status,
      hitBy: `user-${Math.floor(Math.random() * 1000)}`,
      hitByName: randomName(),
      hitPoints,
    };

    console.log(
      `⚔️  ${payload.hitByName} → +${hitPoints} điểm ` +
      `(tổng: ${totalPointsEarned}, HP: ${(100 - progressPercent).toFixed(1)}%)`
    );

    await emitHpUpdate(payload);

    if (willDefeat) {
      console.log('💀 BOSS ĐÃ BỊ HẠ!');
      clearInterval(interval);
      process.exit(0);
    }
  }, HIT_INTERVAL_MS);

  process.on('SIGINT', () => {
    console.log('\n👋 Dừng giả lập...');
    clearInterval(interval);
    process.exit(0);
  });
}

startSimulation();