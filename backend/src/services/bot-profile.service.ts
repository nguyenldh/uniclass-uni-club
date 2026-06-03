// ============================================================
// Bot Profile Service — Quản lý kho tên & avatar cho AI Bot
// Cache Redis + MongoDB persistence
// ============================================================

import { redis } from '../config/index';
import { BotProfileModel } from '../models/index';
import { REDIS_KEYS, BOT_PROFILES_CACHE_TTL } from '@uniclub/shared';
import type { BotProfile, CreateBotProfileInput, UpdateBotProfileInput } from '@uniclub/shared';

/**
 * Service quản lý pool bot profiles.
 * - MongoDB: lưu trữ lâu dài
 * - Redis: cache để lấy nhanh khi tạo session
 */
export class BotProfileService {
  // ============================================================
  // Cache Operations
  // ============================================================

  /**
   * Lấy tất cả bot profiles từ cache.
   * Nếu cache miss → load từ MongoDB và cache lại.
   */
  static async getAllActive(): Promise<BotProfile[]> {
    // Thử đọc từ cache trước
    const cached = await redis.get(REDIS_KEYS.BOT_PROFILES);
    if (cached) {
      return JSON.parse(cached) as BotProfile[];
    }

    // Cache miss → load từ MongoDB
    const docs = await BotProfileModel.find({ isActive: true }).lean();
    const profiles: BotProfile[] = docs.map((doc) => ({
      id: doc._id.toString(),
      name: doc.name,
      avatar: doc.avatar,
      isActive: doc.isActive,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));

    // Cache với TTL
    await redis.set(REDIS_KEYS.BOT_PROFILES, JSON.stringify(profiles), 'EX', BOT_PROFILES_CACHE_TTL);

    return profiles;
  }

  /**
   * Lấy ngẫu nhiên 1 bot profile từ pool.
   * Trả về null nếu pool rỗng.
   */
  static async getRandomBot(): Promise<BotProfile | null> {
    const profiles = await this.getAllActive();
    if (profiles.length === 0) {
      return null;
    }
    return profiles[Math.floor(Math.random() * profiles.length)];
  }

  /**
   * Lấy ngẫu nhiên 1 bot, tránh trùng với danh sách excludeIds.
   * Nếu không còn bot nào khả dụng → trả về bất kỳ bot nào.
   */
  static async getRandomBotExcluding(excludeIds: string[]): Promise<BotProfile | null> {
    const profiles = await this.getAllActive();
    if (profiles.length === 0) {
      return null;
    }

    const excludeSet = new Set(excludeIds);
    const available = profiles.filter((p) => !excludeSet.has(p.id));

    if (available.length === 0) {
      // Không còn bot nào khả dụng → trả về bất kỳ
      return profiles[Math.floor(Math.random() * profiles.length)];
    }

    return available[Math.floor(Math.random() * available.length)];
  }

  /**
   * Invalidate cache (gọi khi có thay đổi từ CMS).
   */
  static async invalidateCache(): Promise<void> {
    await redis.del(REDIS_KEYS.BOT_PROFILES);
  }

  /**
   * Refresh cache: xóa cache cũ và load lại từ MongoDB.
   */
  static async refreshCache(): Promise<BotProfile[]> {
    await this.invalidateCache();
    return this.getAllActive();
  }

  // ============================================================
  // CRUD Operations (cho CMS Admin)
  // ============================================================

  /**
   * Lấy tất cả bot profiles (bao gồm cả inactive).
   * Dùng cho CMS quản lý.
   */
  static async getAll(): Promise<BotProfile[]> {
    const docs = await BotProfileModel.find().sort({ createdAt: -1 }).lean();
    return docs.map((doc) => ({
      id: doc._id.toString(),
      name: doc.name,
      avatar: doc.avatar,
      isActive: doc.isActive,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));
  }

  /**
   * Lấy bot profile theo ID.
   */
  static async getById(id: string): Promise<BotProfile | null> {
    const doc = await BotProfileModel.findById(id).lean();
    if (!doc) return null;

    return {
      id: doc._id.toString(),
      name: doc.name,
      avatar: doc.avatar,
      isActive: doc.isActive,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  /**
   * Tạo mới bot profile.
   * Tự động invalidate cache.
   */
  static async create(input: CreateBotProfileInput): Promise<BotProfile> {
    const doc = await BotProfileModel.create({
      name: input.name,
      avatar: input.avatar,
      isActive: input.isActive ?? true,
    });

    await this.invalidateCache();

    return {
      id: doc._id.toString(),
      name: doc.name,
      avatar: doc.avatar,
      isActive: doc.isActive,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  /**
   * Tạo nhiều bot profiles cùng lúc (bulk insert).
   * Tự động invalidate cache.
   */
  static async createMany(inputs: CreateBotProfileInput[]): Promise<BotProfile[]> {
    const docs = await BotProfileModel.insertMany(
      inputs.map((input) => ({
        name: input.name,
        avatar: input.avatar,
        isActive: input.isActive ?? true,
      })),
    );

    await this.invalidateCache();

    return docs.map((doc) => ({
      id: doc._id.toString(),
      name: doc.name,
      avatar: doc.avatar,
      isActive: doc.isActive,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));
  }

  /**
   * Cập nhật bot profile.
   * Tự động invalidate cache.
   */
  static async update(id: string, input: UpdateBotProfileInput): Promise<BotProfile | null> {
    const doc = await BotProfileModel.findByIdAndUpdate(
      id,
      { $set: input },
      { new: true, runValidators: true },
    ).lean();

    if (!doc) return null;

    await this.invalidateCache();

    return {
      id: doc._id.toString(),
      name: doc.name,
      avatar: doc.avatar,
      isActive: doc.isActive,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  /**
   * Xóa bot profile (hard delete).
   * Tự động invalidate cache.
   */
  static async delete(id: string): Promise<boolean> {
    const result = await BotProfileModel.findByIdAndDelete(id);
    if (result) {
      await this.invalidateCache();
      return true;
    }
    return false;
  }

  /**
   * Toggle trạng thái active của bot.
   * Tự động invalidate cache.
   */
  static async toggleActive(id: string): Promise<BotProfile | null> {
    const doc = await BotProfileModel.findById(id);
    if (!doc) return null;

    doc.isActive = !doc.isActive;
    await doc.save();

    await this.invalidateCache();

    return {
      id: doc._id.toString(),
      name: doc.name,
      avatar: doc.avatar,
      isActive: doc.isActive,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  // ============================================================
  // Seeding (khởi tạo dữ liệu mặc định)
  // ============================================================

  /**
   * Seed dữ liệu mặc định nếu collection rỗng.
   * Gọi khi khởi động server.
   */
  static async seedDefaultBots(): Promise<void> {
    const count = await BotProfileModel.countDocuments();
    if (count > 0) {
      console.log(`[BotProfile] Already has ${count} bots, skipping seed.`);
      return;
    }

    const defaultBots: CreateBotProfileInput[] = [
      { name: 'Minh Anh', avatar: '/bots/minh-anh.png', isActive: true },
      { name: 'Tuấn Kiệt', avatar: '/bots/tuan-kiet.png', isActive: true },
      { name: 'Bảo Châu', avatar: '/bots/bao-chau.png', isActive: true },
      { name: 'Gia Huy', avatar: '/bots/gia-huy.png', isActive: true },
      { name: 'Khánh Linh', avatar: '/bots/khanh-linh.png', isActive: true },
      { name: 'Hoàng Nam', avatar: '/bots/hoang-nam.png', isActive: true },
      { name: 'Quỳnh Anh', avatar: '/bots/quynh-anh.png', isActive: true },
      { name: 'Đức Minh', avatar: '/bots/duc-minh.png', isActive: true },
      { name: 'Thanh Tú', avatar: '/bots/thanh-tu.png', isActive: true },
      { name: 'Hải Đăng', avatar: '/bots/hai-dang.png', isActive: true },
      { name: 'Ngọc Hân', avatar: '/bots/ngoc-han.png', isActive: true },
      { name: 'Phương Thảo', avatar: '/bots/phuong-thao.png', isActive: true },
      { name: 'Anh Tuấn', avatar: '/bots/anh-tuan.png', isActive: true },
      { name: 'Mai Hương', avatar: '/bots/mai-huong.png', isActive: true },
      { name: 'Văn Đạt', avatar: '/bots/van-dat.png', isActive: true },
      { name: 'Thuỳ Dương', avatar: '/bots/thuy-duong.png', isActive: true },
      { name: 'Quốc Bảo', avatar: '/bots/quoc-bao.png', isActive: true },
      { name: 'Hồng Nhung', avatar: '/bots/hong-nhung.png', isActive: true },
      { name: 'Công Thành', avatar: '/bots/cong-thanh.png', isActive: true },
      { name: 'Bích Ngọc', avatar: '/bots/bich-ngoc.png', isActive: true },
      { name: 'Trọng Nhân', avatar: '/bots/trong-nhan.png', isActive: true },
      { name: 'Yến Nhi', avatar: '/bots/yen-nhi.png', isActive: true },
      { name: 'Đình Phong', avatar: '/bots/dinh-phong.png', isActive: true },
      { name: 'Kim Ngân', avatar: '/bots/kim-ngan.png', isActive: true },
      { name: 'Hữu Phước', avatar: '/bots/huu-phuoc.png', isActive: true },
      { name: 'Thuỳ Trang', avatar: '/bots/thuy-trang.png', isActive: true },
      { name: 'Thành Đạt', avatar: '/bots/thanh-dat.png', isActive: true },
      { name: 'Mỹ Duyên', avatar: '/bots/my-duyen.png', isActive: true },
      { name: 'Quang Vinh', avatar: '/bots/quang-vinh.png', isActive: true },
      { name: 'Ánh Dương', avatar: '/bots/anh-duong.png', isActive: true },
      { name: 'Nhật Huy', avatar: '/bots/nhat-huy.png', isActive: true },
      { name: 'Lan Chi', avatar: '/bots/lan-chi.png', isActive: true },
      { name: 'Tiến Dũng', avatar: '/bots/tien-dung.png', isActive: true },
      { name: 'Thu Hà', avatar: '/bots/thu-ha.png', isActive: true },
      { name: 'Việt Hùng', avatar: '/bots/viet-hung.png', isActive: true },
      { name: 'Bảo Ngọc', avatar: '/bots/bao-ngoc.png', isActive: true },
      { name: 'Xuân Mai', avatar: '/bots/xuan-mai.png', isActive: true },
      { name: 'Đăng Khoa', avatar: '/bots/dang-khoa.png', isActive: true },
      { name: 'Tuyết Nhung', avatar: '/bots/tuyet-nhung.png', isActive: true },
      { name: 'Phúc Khang', avatar: '/bots/phuc-khang.png', isActive: true },
      { name: 'Hà My', avatar: '/bots/ha-my.png', isActive: true },
      { name: 'Trung Kiên', avatar: '/bots/trung-kien.png', isActive: true },
      { name: 'Diễm Quỳnh', avatar: '/bots/diem-quynh.png', isActive: true },
      { name: 'Văn Toàn', avatar: '/bots/van-toan.png', isActive: true },
    ];

    await this.createMany(defaultBots);
    console.log(`[BotProfile] Seeded ${defaultBots.length} default bots.`);
  }
}
