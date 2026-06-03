/**
 * Script seed admin mặc định
 * Chạy: npx tsx src/scripts/seed-admin.ts
 */
import mongoose from 'mongoose';
import { env } from '../config/env';
import { AdminUserService } from '../services/admin-user.service';

async function seedAdmin() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const hasAdmin = await AdminUserService.hasAnyAdmin();
    if (hasAdmin) {
      console.log('ℹ️  Admin users already exist, skipping seed.');
      return;
    }

    const username = env.ADMIN_DEFAULT_USERNAME;
    const password = env.ADMIN_DEFAULT_PASSWORD;

    if (!username || !password) {
      console.error('❌ ADMIN_DEFAULT_USERNAME and ADMIN_DEFAULT_PASSWORD must be set in environment');
      process.exit(1);
    }

    console.log(`📝 Creating default admin: ${username}`);
    const admin = await AdminUserService.createAdmin({
      username,
      password,
      name: 'Admin',
      role: 'superadmin',
    });

    console.log(`✅ Admin created: ${admin.username} (ID: ${admin._id})`);
    console.log('⚠️  WARNING: Please change the default password after first login!');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

seedAdmin();
