import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { normalizeAuthUser } from '@uniclub/shared';
import type { AdminJwtPayload, AdminRole, AuthUser } from '@uniclub/shared';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      admin?: AdminJwtPayload;
      user?: AuthUser;
    }
  }
}

const ADMIN_ROLES: AdminRole[] = ['admin', 'superadmin'];

/**
 * Middleware xác thực admin JWT
 * Gắn req.admin nếu token hợp lệ
 */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, env.JWT_SECRET) as AdminJwtPayload;

    // Kiểm tra có phải admin token không (có adminId và role)
    if (!payload.adminId || !payload.role || !ADMIN_ROLES.includes(payload.role)) {
      res.status(403).json({ error: 'Access denied: Admin role required' });
      return;
    }

    req.admin = payload;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Token expired' });
      return;
    }
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    console.error('[Middleware] Auth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Middleware chỉ cho phép superadmin
 */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.admin?.role !== 'superadmin') {
    res.status(403).json({ error: 'Access denied: Superadmin role required' });
    return;
  }
  next();
}

/**
 * Error handler middleware
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[Error]', err);
  res.status(500).json({
    error: err.message || 'Internal server error',
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

/**
 * Middleware xác thực JWT của người dùng (học sinh).
 * UniClass WebView gửi token qua header Authorization.
 * Gắn req.user nếu hợp lệ.
 */
export function requireUserAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const rawPayload = jwt.verify(token, env.JWT_SECRET);
    const payload = normalizeAuthUser(rawPayload);

    if (payload.profileId) {
      payload.userId = payload.profileId; // Sử dụng profileId làm userId chính nếu có
    }

    if (!payload.userId) {
      res.status(401).json({ error: 'Invalid user token' });
      return;
    }

    req.user = payload;
    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Token expired' });
      return;
    }
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    console.error('[Middleware] User auth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
