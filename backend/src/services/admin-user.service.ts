import bcrypt from 'bcryptjs';
import { AdminUserModel, IAdminUser } from '../models';
import type { AdminUser, AdminRole } from '@uniclub/shared';

const SALT_ROUNDS = 10;

export class AdminUserService {
  /**
   * Tìm admin theo username
   */
  static async findByUsername(username: string): Promise<IAdminUser | null> {
    return AdminUserModel.findOne({ username });
  }

  /**
   * Tìm admin theo ID
   */
  static async findById(id: string): Promise<IAdminUser | null> {
    return AdminUserModel.findById(id);
  }

  /**
   * Verify password
   */
  static async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * Hash password
   */
  static async hashPassword(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, SALT_ROUNDS);
  }

  /**
   * Tạo admin mới
   */
  static async createAdmin(input: {
    username: string;
    password: string;
    name: string;
    role?: AdminRole;
  }): Promise<IAdminUser> {
    const passwordHash = await this.hashPassword(input.password);
    const admin = new AdminUserModel({
      username: input.username,
      passwordHash,
      name: input.name,
      role: input.role || 'admin',
    });
    return admin.save();
  }

  /**
   * Cập nhật thời gian đăng nhập cuối
   */
  static async updateLastLogin(adminId: string): Promise<void> {
    await AdminUserModel.findByIdAndUpdate(adminId, { lastLoginAt: new Date() });
  }

  /**
   * Đổi password
   */
  static async changePassword(adminId: string, newPassword: string): Promise<void> {
    const passwordHash = await this.hashPassword(newPassword);
    await AdminUserModel.findByIdAndUpdate(adminId, { passwordHash });
  }

  /**
   * Chuyển IAdminUser thành AdminUser (ẩn passwordHash)
   */
  static toAdminUser(doc: IAdminUser): AdminUser {
    return {
      id: doc._id.toString(),
      username: doc.username,
      name: doc.name,
      role: doc.role,
      createdAt: doc.createdAt,
      lastLoginAt: doc.lastLoginAt,
    };
  }

  /**
   * Kiểm tra có admin nào trong DB chưa
   */
  static async hasAnyAdmin(): Promise<boolean> {
    const count = await AdminUserModel.countDocuments();
    return count > 0;
  }
}
