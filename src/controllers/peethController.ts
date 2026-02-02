// =============================================================
// src/controllers/peethController.ts
// Request handlers for Peeth (Division Level) management
// Fixed to match actual schema: admins + users + user_roles
// =============================================================

import { Request, Response } from 'express';
import { PeethService } from '../services/peethService';
import { resolveActorId, writeAuditLog } from '../middleware/auth';
import { sendSuccess, sendError, ApiError } from '../utils/response';

// ─── Helper Functions ───────────────────────────────────────

/**
 * Check if request is from admin (from admins table)
 * @param req - Express Request object
 */
function isAdminRequest(req: Request): boolean {
  // This should check if req.user comes from admins table
  // Implementation depends on your auth middleware
  // Example: return req.user?.userType === 'ADMIN';
  return req.user?.role === 'ADMIN' || req.user?.role === 'SUBADMIN';
}

/**
 * Get admin ID from request (for operations requiring admin)
 * @param req - Express Request object
 */
function getAdminId(req: Request): number {
  if (!isAdminRequest(req)) {
    throw new ApiError('Admin access required', 403);
  }
  return resolveActorId(req.user!);
}

/**
 * Get user ID from request (for operations that support both admin and users)
 * @param req - Express Request object
 */
function getUserId(req: Request): number | undefined {
  // For admin requests, this might be undefined
  // For user requests, this is the user ID from users table
  if (isAdminRequest(req)) {
    return undefined; // Admins don't have a user_id
  }
  return resolveActorId(req.user!);
}

// ─── CRUD Operations ────────────────────────────────────────

/**
 * Create a new Peeth (Division)
 * Access: ADMIN, SUBADMIN only (from admins table)
 */
export async function createPeeth(req: Request, res: Response): Promise<void> {
  try {
    // Only admins can create Peeths
    const adminId = getAdminId(req);
    
    const peeth = await PeethService.create(req.body, adminId);

    await writeAuditLog(
      adminId,
      'CREATE_PEETH',
      'peeths',
      peeth.id,
      req.ipAddress ?? null,
      undefined,
      peeth as unknown as Record<string, unknown>
    );

    sendSuccess(res, peeth, 201, 'Peeth created successfully.');
  } catch (err) {
    if (err instanceof ApiError) {
      sendError(res, err.message, err.statusCode);
      return;
    }
    sendError(res, 'Internal error.', 500);
  }
}

/**
 * List all Peeths with optional filters
 * Access: 
 * - ADMIN, SUBADMIN: See all Peeths
 * - PEETH users: See only their assigned Peeth
 */
export async function listPeeths(req: Request, res: Response): Promise<void> {
  try {
    const filters: {
      is_active?: boolean;
      search?: string;
    } = {};

    if (req.query.is_active !== undefined) {
      filters.is_active = req.query.is_active === 'true';
    }

    if (req.query.search) {
      filters.search = req.query.search as string;
    }

    const isAdmin = isAdminRequest(req);
    const userId = getUserId(req);

    const peeths = await PeethService.findAll(filters, userId, isAdmin);
    sendSuccess(res, peeths);
  } catch (err) {
    if (err instanceof ApiError) {
      sendError(res, err.message, err.statusCode);
      return;
    }
    sendError(res, 'Internal error.', 500);
  }
}

/**
 * Get single Peeth by ID
 * Access: 
 * - ADMIN, SUBADMIN: Can view any Peeth
 * - PEETH users: Can only view their assigned Peeth
 */
export async function getPeeth(req: Request, res: Response): Promise<void> {
  try {
    const peethId = parseInt(req.params.id, 10);
    const isAdmin = isAdminRequest(req);
    const userId = getUserId(req);

    const peeth = await PeethService.findById(peethId, userId, isAdmin);

    if (!peeth) {
      sendError(res, 'Peeth not found.', 404);
      return;
    }

    sendSuccess(res, peeth);
  } catch (err) {
    if (err instanceof ApiError) {
      sendError(res, err.message, err.statusCode);
      return;
    }
    sendError(res, 'Internal error.', 500);
  }
}

/**
 * Get Peeth by division code
 * Access: ADMIN, SUBADMIN
 */
export async function getPeethByCode(req: Request, res: Response): Promise<void> {
  try {
    // Only admins should use this endpoint (no user filtering)
    if (!isAdminRequest(req)) {
      sendError(res, 'Admin access required.', 403);
      return;
    }

    const peeth = await PeethService.findByDivisionCode(req.params.code);

    if (!peeth) {
      sendError(res, 'Peeth not found.', 404);
      return;
    }

    sendSuccess(res, peeth);
  } catch (err) {
    sendError(res, 'Internal error.', 500);
  }
}

/**
 * Get current user's Peeth (for PEETH role users)
 * Access: Users with PEETH role
 */
export async function getMyPeeth(req: Request, res: Response): Promise<void> {
  try {
    if (isAdminRequest(req)) {
      sendError(res, 'This endpoint is for PEETH users only. Admins should use /peeths endpoint.', 400);
      return;
    }

    const userId = getUserId(req);
    if (!userId) {
      sendError(res, 'User ID not found.', 401);
      return;
    }

    const peeth = await PeethService.findByUserId(userId);

    if (!peeth) {
      sendError(res, 'No Peeth assigned to you.', 404);
      return;
    }

    sendSuccess(res, peeth);
  } catch (err) {
    sendError(res, 'Internal error.', 500);
  }
}

/**
 * Update Peeth details
 * Access: ADMIN, SUBADMIN only
 */
export async function updatePeeth(req: Request, res: Response): Promise<void> {
  try {
    const peethId = parseInt(req.params.id, 10);
    const adminId = getAdminId(req);

    const oldPeeth = await PeethService.findById(peethId);

    if (!oldPeeth) {
      sendError(res, 'Peeth not found.', 404);
      return;
    }

    const updated = await PeethService.update(peethId, req.body, adminId);

    await writeAuditLog(
      adminId,
      'UPDATE_PEETH',
      'peeths',
      updated.id,
      req.ipAddress ?? null,
      oldPeeth as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>
    );

    sendSuccess(res, updated, 200, 'Peeth updated successfully.');
  } catch (err) {
    if (err instanceof ApiError) {
      sendError(res, err.message, err.statusCode);
      return;
    }
    sendError(res, 'Internal error.', 500);
  }
}

/**
 * Deactivate Peeth (soft delete)
 * Access: ADMIN, SUBADMIN
 */
export async function deactivatePeeth(req: Request, res: Response): Promise<void> {
  try {
    const peethId = parseInt(req.params.id, 10);
    const adminId = getAdminId(req);

    const peeth = await PeethService.deactivate(peethId, adminId);

    await writeAuditLog(
      adminId,
      'DEACTIVATE_PEETH',
      'peeths',
      peethId,
      req.ipAddress ?? null
    );

    sendSuccess(res, peeth, 200, 'Peeth deactivated successfully.');
  } catch (err) {
    if (err instanceof ApiError) {
      sendError(res, err.message, err.statusCode);
      return;
    }
    sendError(res, 'Internal error.', 500);
  }
}

/**
 * Activate Peeth
 * Access: ADMIN, SUBADMIN
 */
export async function activatePeeth(req: Request, res: Response): Promise<void> {
  try {
    const peethId = parseInt(req.params.id, 10);
    const adminId = getAdminId(req);

    const peeth = await PeethService.activate(peethId, adminId);

    await writeAuditLog(
      adminId,
      'ACTIVATE_PEETH',
      'peeths',
      peethId,
      req.ipAddress ?? null
    );

    sendSuccess(res, peeth, 200, 'Peeth activated successfully.');
  } catch (err) {
    if (err instanceof ApiError) {
      sendError(res, err.message, err.statusCode);
      return;
    }
    sendError(res, 'Internal error.', 500);
  }
}

// ─── Hierarchical Data ──────────────────────────────────────

/**
 * Get all Shakhas under a Peeth
 * Access: 
 * - ADMIN, SUBADMIN: Can view Shakhas of any Peeth
 * - PEETH users: Can only view Shakhas of their assigned Peeth
 */
export async function getPeethShakhas(req: Request, res: Response): Promise<void> {
  try {
    const peethId = parseInt(req.params.id, 10);
    const isAdmin = isAdminRequest(req);
    const userId = getUserId(req);

    const shakhas = await PeethService.getShakhas(peethId, userId, isAdmin);

    sendSuccess(res, shakhas);
  } catch (err) {
    if (err instanceof ApiError) {
      sendError(res, err.message, err.statusCode);
      return;
    }
    sendError(res, 'Internal error.', 500);
  }
}

// ─── Analytics & Reports ────────────────────────────────────

/**
 * Get Peeth statistics (division-level overview)
 * Access: 
 * - ADMIN, SUBADMIN: Can view statistics of any Peeth
 * - PEETH users: Can only view statistics of their assigned Peeth
 */
export async function getPeethStatistics(req: Request, res: Response): Promise<void> {
  try {
    const peethId = parseInt(req.params.id, 10);
    const isAdmin = isAdminRequest(req);
    const userId = getUserId(req);

    const stats = await PeethService.getStatistics(peethId, userId, isAdmin);

    sendSuccess(res, stats);
  } catch (err) {
    if (err instanceof ApiError) {
      sendError(res, err.message, err.statusCode);
      return;
    }
    sendError(res, 'Internal error.', 500);
  }
}

/**
 * Get contributors summary for a Peeth
 * Access: 
 * - ADMIN, SUBADMIN: Can view contributors of any Peeth
 * - PEETH users: Can only view contributors of their assigned Peeth
 */
export async function getPeethContributorsSummary(req: Request, res: Response): Promise<void> {
  try {
    const peethId = parseInt(req.params.id, 10);
    const isAdmin = isAdminRequest(req);
    const userId = getUserId(req);

    const filters: {
      contributor_type?: 'GENERAL' | 'TRUSTEE' | 'GRUHINI';
      pan_status?: string;
    } = {};

    if (req.query.contributor_type) {
      filters.contributor_type = req.query.contributor_type as 'GENERAL' | 'TRUSTEE' | 'GRUHINI';
    }

    if (req.query.pan_status) {
      filters.pan_status = req.query.pan_status as string;
    }

    const summary = await PeethService.getContributorsSummary(
      peethId,
      filters,
      userId,
      isAdmin
    );

    sendSuccess(res, summary);
  } catch (err) {
    if (err instanceof ApiError) {
      sendError(res, err.message, err.statusCode);
      return;
    }
    sendError(res, 'Internal error.', 500);
  }
}