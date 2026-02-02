// =============================================================
// src/controllers/adminController.ts
// Pure request-handling logic. No route definitions here.
// =============================================================

import { Request, Response } from 'express';
import { AdminService } from '../services/adminService';
import { CommissionService } from '../services/commissionService';
import { resolveActorId, writeAuditLog } from '../middleware/auth';
import { sendSuccess, sendError, ApiError } from '../utils/response';
import jwt from 'jsonwebtoken';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip password_hash before sending any admin object to the client. */
function sanitize({ password_hash, ...safe }: Record<string, unknown>) {
  return safe;
}

/**
 * Mint a signed JWT.
 * Set JWT_SECRET in your .env — never fall back to a hard-coded default in prod.
 */
function mintToken(payload: Record<string, unknown>): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured.');
  return jwt.sign(payload, secret, { expiresIn: '8h' });
}

// ---------------------------------------------------------------------------
// Register  –  POST /admin/register
// ---------------------------------------------------------------------------

export async function registerAdmin(req: Request, res: Response): Promise<void> {
  try {
    const admin = await AdminService.register(req.body);

    // For registration, use the newly created admin's ID as the actor
    // since there's no authenticated user making this request
    await writeAuditLog(
      admin.id,
      'ADMIN_REGISTERED',
      'admins',
      admin.id,
      req.ipAddress ?? null,
    );

    sendSuccess(res, sanitize(admin as any), 201, 'Admin account created.');
  } catch (err) {
    if (err instanceof ApiError) { sendError(res, err.message, err.statusCode); return; }
    sendError(res, 'Internal error.', 500);
  }
}

// ---------------------------------------------------------------------------
// Login  –  POST /admin/login
// ---------------------------------------------------------------------------

export async function loginAdmin(req: Request, res: Response): Promise<void> {
  try {
    const admin = await AdminService.login(req.body);

    const token = mintToken({
      source: 'ADMIN',
      admin_id: admin.id,
      role: admin.role,
    });

    await writeAuditLog(
      admin.id,
      'ADMIN_LOGGED_IN',
      'admins',
      admin.id,
      req.ipAddress ?? null,
    );

    sendSuccess(
      res,
      {
        token,
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
        },
      },
      200,
      'Admin login successful.',
    );
  } catch (err) {
    if (err instanceof ApiError) { sendError(res, err.message, err.statusCode); return; }
    sendError(res, 'Internal error.', 500);
  }
}

// ---------------------------------------------------------------------------
// List all admins  –  GET /admin/admins
// ---------------------------------------------------------------------------

export async function listAdmins(_req: Request, res: Response): Promise<void> {
  try {
    const list = await AdminService.findAll();
    const safe = list.map((a) => sanitize(a as any));
    sendSuccess(res, safe);
  } catch (err) {
    if (err instanceof ApiError) { sendError(res, err.message, err.statusCode); return; }
    sendError(res, 'Internal error.', 500);
  }
}

// ---------------------------------------------------------------------------
// Deactivate admin  –  PUT /admin/admins/:id/deactivate
// ---------------------------------------------------------------------------

export async function deactivateAdmin(req: Request, res: Response): Promise<void> {
  try {
    const targetId = parseInt(req.params.id, 10);
    const actorId = resolveActorId(req.user!);

    if (targetId === actorId) {
      sendError(res, 'You cannot deactivate your own account.', 403);
      return;
    }

    await AdminService.deactivate(targetId);

    await writeAuditLog(actorId, 'ADMIN_DEACTIVATED', 'admins', targetId, req.ipAddress ?? null);

    sendSuccess(res, {}, 200, 'Admin deactivated.');
  } catch (err) {
    if (err instanceof ApiError) { sendError(res, err.message, err.statusCode); return; }
    sendError(res, 'Internal error.', 500);
  }
}

// ---------------------------------------------------------------------------
// Activate admin  –  PUT /admin/admins/:id/activate
// ---------------------------------------------------------------------------

export async function activateAdmin(req: Request, res: Response): Promise<void> {
  try {
    const targetId = parseInt(req.params.id, 10);
    const actorId = resolveActorId(req.user!);

    await AdminService.activate(targetId);

    await writeAuditLog(actorId, 'ADMIN_ACTIVATED', 'admins', targetId, req.ipAddress ?? null);

    sendSuccess(res, {}, 200, 'Admin activated.');
  } catch (err) {
    if (err instanceof ApiError) { sendError(res, err.message, err.statusCode); return; }
    sendError(res, 'Internal error.', 500);
  }
}

// ---------------------------------------------------------------------------
// Create sub-admin  –  POST /admin/subadmins
// ---------------------------------------------------------------------------

export async function createSubAdmin(req: Request, res: Response): Promise<void> {
  try {
    const dto = { ...req.body, role: 'SUBADMIN' as const };
    const subadmin = await AdminService.register(dto);

    await writeAuditLog(
      resolveActorId(req.user!),
      'SUBADMIN_REGISTERED',
      'admins',
      subadmin.id,
      req.ipAddress ?? null,
    );

    sendSuccess(res, sanitize(subadmin as any), 201, 'Subadmin created.');
  } catch (err) {
    if (err instanceof ApiError) { sendError(res, err.message, err.statusCode); return; }
    sendError(res, 'Internal error.', 500);
  }
}

// ---------------------------------------------------------------------------
// List sub-admins  –  GET /admin/subadmins
// ---------------------------------------------------------------------------

export async function listSubAdmins(_req: Request, res: Response): Promise<void> {
  try {
    const list = await AdminService.findAll();
    const subs = list
      .filter((a) => a.role === 'SUBADMIN')
      .map((a) => sanitize(a as any));
    sendSuccess(res, subs);
  } catch (err) {
    if (err instanceof ApiError) { sendError(res, err.message, err.statusCode); return; }
    sendError(res, 'Internal error.', 500);
  }
}

// ---------------------------------------------------------------------------
// Deactivate sub-admin  –  PUT /admin/subadmins/:id/deactivate
// ---------------------------------------------------------------------------

export async function deactivateSubAdmin(req: Request, res: Response): Promise<void> {
  try {
    const targetId = parseInt(req.params.id, 10);
    const actorId = resolveActorId(req.user!);

    if (targetId === actorId) {
      sendError(res, 'You cannot deactivate your own account.', 403);
      return;
    }

    await AdminService.deactivate(targetId);

    await writeAuditLog(actorId, 'SUBADMIN_DEACTIVATED', 'admins', targetId, req.ipAddress ?? null);

    sendSuccess(res, {}, 200, 'Subadmin deactivated.');
  } catch (err) {
    if (err instanceof ApiError) { sendError(res, err.message, err.statusCode); return; }
    sendError(res, 'Internal error.', 500);
  }
}

// ---------------------------------------------------------------------------
// Activate sub-admin  –  PUT /admin/subadmins/:id/activate
// ---------------------------------------------------------------------------

export async function activateSubAdmin(req: Request, res: Response): Promise<void> {
  try {
    const targetId = parseInt(req.params.id, 10);
    const actorId = resolveActorId(req.user!);

    await AdminService.activate(targetId);

    await writeAuditLog(actorId, 'SUBADMIN_ACTIVATED', 'admins', targetId, req.ipAddress ?? null);

    sendSuccess(res, {}, 200, 'Subadmin activated.');
  } catch (err) {
    if (err instanceof ApiError) { sendError(res, err.message, err.statusCode); return; }
    sendError(res, 'Internal error.', 500);
  }
}

// ---------------------------------------------------------------------------
// Update sub-admin role  –  PUT /admin/subadmins/:id/role
// ---------------------------------------------------------------------------

export async function updateSubAdminRole(req: Request, res: Response): Promise<void> {
  try {
    const targetId = parseInt(req.params.id, 10);
    const role = req.body?.role;

    if (role !== 'SUBADMIN' && role !== 'ADMIN') {
      sendError(res, 'Invalid role. Must be ADMIN or SUBADMIN.', 400);
      return;
    }

    const updated = await AdminService.updateRole(targetId, role);

    await writeAuditLog(
      resolveActorId(req.user!),
      'SUBADMIN_ROLE_UPDATED',
      'admins',
      targetId,
      req.ipAddress ?? null,
    );

    sendSuccess(res, sanitize(updated as any), 200, 'Role updated.');
  } catch (err) {
    if (err instanceof ApiError) { sendError(res, err.message, err.statusCode); return; }
    sendError(res, 'Internal error.', 500);
  }
}

// ---------------------------------------------------------------------------
// Pay commission  –  PUT /admin/commissions/:id/pay
// ---------------------------------------------------------------------------

export async function payCommission(req: Request, res: Response): Promise<void> {
  try {
    const commissionId = parseInt(req.params.id, 10);
    const comm = await CommissionService.markPaid(commissionId);

    await writeAuditLog(
      resolveActorId(req.user!),
      'COMMISSION_PAID',
      'commissions',
      comm.id,
      req.ipAddress ?? null,
    );

    sendSuccess(res, comm, 200, 'Commission paid.');
  } catch (err) {
    if (err instanceof ApiError) { sendError(res, err.message, err.statusCode); return; }
    sendError(res, 'Internal error.', 500);
  }
}