// =============================================================
// src/controllers/authController.ts
//
// Two completely separate login flows, zero shared state:
//
//   POST /auth/admin/register   — create ADMIN or SUBADMIN
//   POST /auth/admin/login      — password-based, returns token
//
//   POST /auth/otp/request      — request OTP (Peeth/Shakha/SubShakha/…)
//   POST /auth/otp/verify       — verify OTP  → resolves org role → returns token
// =============================================================

import { Router, Request, Response } from 'express';
import { AdminService }  from '../services/adminService';
import { UserService }   from '../services/userService';
import { authenticate, roleGuard } from '../middleware/auth';
import { sendSuccess, sendError, ApiError } from '../utils/response';
import {
  AdminLoginResponse,
  OrgLoginResponse,
  TokenPayload,
} from '../types';

const router = Router();

// ─── Token stub ─────────────────────────────────────────────
// In production replace this with jsonwebtoken.sign(payload, secret, { expiresIn }).
// The stub just JSON-encodes the payload so the middleware stub can decode it.
function mintToken(payload: TokenPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

// =============================================================
// ADMIN / SUBADMIN — password flow
// =============================================================

/**
 * POST /auth/admin/register
 * Protected — only an existing ADMIN can create new admins/sub-admins.
 * On a brand-new install the bootstrap row from seed.sql is the entry point.
 */
router.post('/admin/register', authenticate, roleGuard('ADMIN'), async (req: Request, res: Response) => {
  try {
    const admin = await AdminService.register(req.body);

    // Never return password_hash
    const { password_hash, ...safe } = admin;
    sendSuccess(res, safe, 201, 'Admin account created.');
  } catch (err) {
    if (err instanceof ApiError) return sendError(res, err.message, err.statusCode);
    sendError(res, 'Internal error.', 500);
  }
});

/**
 * POST /auth/admin/login
 * Public — no prior auth required.
 */
router.post('/admin/login', async (req: Request, res: Response) => {
  try {
    const admin = await AdminService.login(req.body);

    const payload: TokenPayload = {
      source:   'ADMIN',
      admin_id: admin.id,
      role:     admin.role,       // 'ADMIN' | 'SUBADMIN'
    };

    const response: AdminLoginResponse = {
      token: mintToken(payload),
      admin: {
        id:    admin.id,
        email: admin.email,
        name:  admin.name,
        role:  admin.role,
      },
    };

    sendSuccess(res, response, 200, 'Admin login successful.');
  } catch (err) {
    if (err instanceof ApiError) return sendError(res, err.message, err.statusCode);
    sendError(res, 'Internal error.', 500);
  }
});

// =============================================================
// ORG (Peeth / Shakha / SubShakha / Volunteer / Contributor) — OTP flow
// =============================================================

/** POST /auth/otp/request */
router.post('/otp/request', async (req: Request, res: Response) => {
  try {
    const result = await UserService.requestOtp(req.body);
    sendSuccess(res, result, 200, 'OTP sent successfully.');
  } catch (err) {
    if (err instanceof ApiError) return sendError(res, err.message, err.statusCode);
    sendError(res, 'Internal error.', 500);
  }
});

/**
 * POST /auth/otp/verify
 * After OTP is confirmed we resolve which org entity this user owns
 * and embed the full context in the token.
 */
router.post('/otp/verify', async (req: Request, res: Response) => {
  try {
    const user    = await UserService.verifyOtp(req.body);
    const context = await UserService.resolveOrgRole(user.id);

    const payload: TokenPayload = {
      source:    'ORG',
      user_id:   user.id,
      unique_id: user.unique_id,
      role:      context.role,
    };

    const response: OrgLoginResponse = {
      token: mintToken(payload),
      user: {
        id:        user.id,
        unique_id: user.unique_id,
        email:     user.email,
        phone:     user.phone,
        status:    user.status,
      },
      role:    context.role,
      context: {
        peeth_id:      context.peeth_id,
        shakha_id:     context.shakha_id,
        sub_shakha_id: context.sub_shakha_id,
      },
    };

    sendSuccess(res, response, 200, 'Login successful.');
  } catch (err) {
    if (err instanceof ApiError) return sendError(res, err.message, err.statusCode);
    sendError(res, 'Internal error.', 500);
  }
});

export default router;
