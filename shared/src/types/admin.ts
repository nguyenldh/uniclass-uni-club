// ============================================================
// Admin Types — CMS Admin Dashboard
// ============================================================

/** Vai trò của admin */
export type AdminRole = 'admin' | 'superadmin';

/** Admin user trong hệ thống */
export interface AdminUser {
  id: string;
  username: string;
  name: string;
  role: AdminRole;
  createdAt?: Date;
  lastLoginAt?: Date;
}

/** Request đăng nhập admin */
export interface AdminLoginRequest {
  username: string;
  password: string;
}

/** Response đăng nhập admin */
export interface AdminLoginResponse {
  success: boolean;
  token: string;
  admin: AdminUser;
}

/** JWT payload cho admin */
export interface AdminJwtPayload {
  adminId: string;
  username: string;
  role: AdminRole;
  iat?: number;
  exp?: number;
}
