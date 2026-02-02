// =============================================================
// src/middleware/auth.ts
// =============================================================
// Updated to use proper JWT tokens (no more base64 stub)
// =============================================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { TokenPayload, RoleName } from '../types';
import { sendError } from '../utils/response';
import pool from '../config/database';

// Extend Express Request so controllers can read req.user
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      ipAddress?: string;
    }
  }
}

/** Attach the real client IP (handles proxies) */
export function attachIp(req: Request, _res: Response, next: NextFunction): void {
  const forwarded = req.headers['x-forwarded-for'];
  req.ipAddress = (typeof forwarded === 'string' ? forwarded.split(',')[0] : req.ip) || '0.0.0.0';
  next();
}

/**
 * Authenticate – verify JWT token from the Authorization header.
 * Works identically for both login paths because TokenPayload already
 * carries `source: 'ADMIN' | 'ORG'` — no branching needed here.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'] as string | undefined;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(res, 'Authentication required. Send Authorization: Bearer <token>.', 401);
    return;
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    // Get JWT secret from environment
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('[AUTH] JWT_SECRET is not configured');
      sendError(res, 'Server configuration error.', 500);
      return;
    }

    // Verify and decode JWT token
    const payload = jwt.verify(token, secret) as TokenPayload;

    // Minimal sanity check
    if (!payload.source || !payload.role) {
      sendError(res, 'Malformed token.', 401);
      return;
    }

    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      sendError(res, 'Token has expired.', 401);
      return;
    }
    if (err instanceof jwt.JsonWebTokenError) {
      sendError(res, 'Invalid token.', 401);
      return;
    }
    sendError(res, 'Invalid or expired token.', 401);
  }
}

/**
 * Role-guard factory.  Usage: roleGuard('ADMIN', 'SUBADMIN')
 * Works on both token sources — it only looks at req.user.role.
 */
export function roleGuard(...allowed: RoleName[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !allowed.includes(req.user.role)) {
      sendError(res, 'Insufficient permissions.', 403);
      return;
    }
    next();
  };
}

/**
 * Resolve a single numeric "actor ID" from the token regardless of source.
 *   ADMIN tokens  →  admin_id   (row in `admins`)
 *   ORG   tokens  →  user_id    (row in `users`)
 *
 * Controllers pass this to services that need a `created_by` / audit user_id.
 * NOTE: for FK columns that reference `users(id)` specifically (e.g. works.created_by)
 * ADMIN-sourced requests will still work because those FKs only matter for
 * org-level entities.  If your schema ever needs an admin FK you'll want a
 * separate column; for now this is fine.
 */
export function resolveActorId(payload: TokenPayload): number {
  if (payload.source === 'ADMIN') return payload.admin_id!;
  return payload.user_id!;
}

export async function writeAuditLog(
  userId: number | null,
  action: string,
  tableName: string,
  recordId: number | null,
  ipAddress: string | null,
  oldData?: Record<string, unknown>,
  newData?: Record<string, unknown>,
): Promise<void> {
  try {
    await pool.execute(
      `INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        action,
        tableName,
        recordId,
        oldData ? JSON.stringify(oldData) : null,
        newData ? JSON.stringify(newData) : null,
        ipAddress,
      ],
    );
  } catch {
    // Audit failures must never crash the main flow
    console.error('[AUDIT] Failed to write log entry.');
  }
}