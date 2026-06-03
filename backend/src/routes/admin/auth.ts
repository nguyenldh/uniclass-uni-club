import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { requireAdminAuth } from '../../middleware';
import { AdminUserService } from '../../services/admin-user.service';
import type { AdminLoginRequest, AdminJwtPayload, AdminLoginResponse } from '@uniclub/shared';

const router = Router();

/**
 * POST /api/admin/auth/login
 * Đăng nhập admin
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body as AdminLoginRequest;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const adminDoc = await AdminUserService.findByUsername(username);
    if (!adminDoc) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isValid = await AdminUserService.verifyPassword(password, adminDoc.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Cập nhật lastLoginAt
    await AdminUserService.updateLastLogin(adminDoc._id.toString());

    // Tạo JWT
    const payload: AdminJwtPayload = {
      adminId: adminDoc._id.toString(),
      username: adminDoc.username,
      role: adminDoc.role,
    };

    const token = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.ADMIN_JWT_EXPIRES_IN as string,
    } as jwt.SignOptions);

    const response: AdminLoginResponse = {
      success: true,
      token,
      admin: AdminUserService.toAdminUser(adminDoc),
    };

    res.json(response);
  } catch (error: any) {
    console.error('[Admin Auth] Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/auth/me
 * Lấy thông tin admin hiện tại từ token
 */
router.get('/me', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    // req.admin được gắn bởi middleware
    const adminPayload = (req as any).admin as AdminJwtPayload;
    
    const adminDoc = await AdminUserService.findById(adminPayload.adminId);
    if (!adminDoc) {
      res.status(404).json({ error: 'Admin not found' });
      return;
    }

    res.json({
      success: true,
      admin: AdminUserService.toAdminUser(adminDoc),
    });
  } catch (error: any) {
    console.error('[Admin Auth] Get me error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
