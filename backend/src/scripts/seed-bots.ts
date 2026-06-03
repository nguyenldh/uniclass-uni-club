// ============================================================
// Seed Bot Profiles Script
// Khởi tạo dữ liệu bot profiles cho AI Bot Pool
//
// Chạy: npx tsx src/scripts/seed-bots.ts
// Force re-seed: npx tsx src/scripts/seed-bots.ts --force
// ============================================================

import mongoose from 'mongoose';
import { BotProfileModel } from '../models/index';

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/uniclub';

// Danh sách bot profiles mẫu (tên người thật để người chơi không nhận ra là BOT)
const seedBotProfiles = [
  { name: 'Minh Anh', avatar: '/bots/minh-anh.png' },
  { name: 'Tuấn Kiệt', avatar: '/bots/tuan-kiet.png' },
  { name: 'Bảo Châu', avatar: '/bots/bao-chau.png' },
  { name: 'Gia Huy', avatar: '/bots/gia-huy.png' },
  { name: 'Khánh Linh', avatar: '/bots/khanh-linh.png' },
  { name: 'Hoàng Nam', avatar: '/bots/hoang-nam.png' },
  { name: 'Quỳnh Anh', avatar: '/bots/quynh-anh.png' },
  { name: 'Đức Minh', avatar: '/bots/duc-minh.png' },
  { name: 'Thanh Tú', avatar: '/bots/thanh-tu.png' },
  { name: 'Hải Đăng', avatar: '/bots/hai-dang.png' },
  { name: 'Ngọc Hân', avatar: '/bots/ngoc-han.png' },
  { name: 'Phương Thảo', avatar: '/bots/phuong-thao.png' },
  { name: 'Anh Tuấn', avatar: '/bots/anh-tuan.png' },
  { name: 'Mai Hương', avatar: '/bots/mai-huong.png' },
  { name: 'Văn Đạt', avatar: '/bots/van-dat.png' },
  { name: 'Thuỳ Dương', avatar: '/bots/thuy-duong.png' },
  { name: 'Quốc Bảo', avatar: '/bots/quoc-bao.png' },
  { name: 'Hồng Nhung', avatar: '/bots/hong-nhung.png' },
  { name: 'Công Thành', avatar: '/bots/cong-thanh.png' },
  { name: 'Bích Ngọc', avatar: '/bots/bich-ngoc.png' },
  { name: 'Trọng Nhân', avatar: '/bots/trong-nhan.png' },
  { name: 'Yến Nhi', avatar: '/bots/yen-nhi.png' },
  { name: 'Đình Phong', avatar: '/bots/dinh-phong.png' },
  { name: 'Kim Ngân', avatar: '/bots/kim-ngan.png' },
  { name: 'Hữu Phước', avatar: '/bots/huu-phuoc.png' },
  { name: 'Thuỳ Trang', avatar: '/bots/thuy-trang.png' },
  { name: 'Thành Đạt', avatar: '/bots/thanh-dat.png' },
  { name: 'Mỹ Duyên', avatar: '/bots/my-duyen.png' },
  { name: 'Quang Vinh', avatar: '/bots/quang-vinh.png' },
  { name: 'Ánh Dương', avatar: '/bots/anh-duong.png' },
  { name: 'Nhật Huy', avatar: '/bots/nhat-huy.png' },
  { name: 'Lan Chi', avatar: '/bots/lan-chi.png' },
  { name: 'Tiến Dũng', avatar: '/bots/tien-dung.png' },
  { name: 'Thu Hà', avatar: '/bots/thu-ha.png' },
  { name: 'Việt Hùng', avatar: '/bots/viet-hung.png' },
  { name: 'Bảo Ngọc', avatar: '/bots/bao-ngoc.png' },
  { name: 'Xuân Mai', avatar: '/bots/xuan-mai.png' },
  { name: 'Đăng Khoa', avatar: '/bots/dang-khoa.png' },
  { name: 'Tuyết Nhung', avatar: '/bots/tuyet-nhung.png' },
  { name: 'Phúc Khang', avatar: '/bots/phuc-khang.png' },
  { name: 'Hà My', avatar: '/bots/ha-my.png' },
  { name: 'Trung Kiên', avatar: '/bots/trung-kien.png' },
  { name: 'Diễm Quỳnh', avatar: '/bots/diem-quynh.png' },
  { name: 'Văn Toàn', avatar: '/bots/van-toan.png' },
];

async function seed(force = false): Promise<void> {
  console.log('[Seed] Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('[Seed] Connected to MongoDB.');

  const existingCount = await BotProfileModel.countDocuments();

  if (existingCount > 0 && !force) {
    console.log(`[Seed] Already has ${existingCount} bot profiles.`);
    console.log('[Seed] Use --force to delete and re-seed.');
    await mongoose.disconnect();
    return;
  }

  if (force && existingCount > 0) {
    console.log(`[Seed] Force mode: Deleting ${existingCount} existing bot profiles...`);
    await BotProfileModel.deleteMany({});
    console.log('[Seed] Deleted all existing bot profiles.');
  }

  console.log(`[Seed] Inserting ${seedBotProfiles.length} bot profiles...`);

  const docs = await BotProfileModel.insertMany(
    seedBotProfiles.map((bot) => ({
      name: bot.name,
      avatar: bot.avatar,
      isActive: true,
    })),
  );

  console.log(`[Seed] Successfully inserted ${docs.length} bot profiles.`);

  // Hiển thị danh sách bot đã tạo
  console.log('\n[Seed] Bot profiles created:');
  docs.forEach((doc, idx) => {
    console.log(`  ${idx + 1}. ${doc.name} (${doc.avatar})`);
  });

  await mongoose.disconnect();
  console.log('\n[Seed] Done. MongoDB disconnected.');
}

// Parse CLI arguments
const args = process.argv.slice(2);
const force = args.includes('--force') || args.includes('-f');

seed(force).catch((err) => {
  console.error('[Seed] Error:', err);
  process.exit(1);
});
