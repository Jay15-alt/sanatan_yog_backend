// =============================================================
// src/controllers/commissionController.ts
// =============================================================

import { Router, Request, Response } from 'express';
import { authenticate, roleGuard, writeAuditLog, resolveActorId } from '../middleware/auth';
import { CommissionService } from '../services/commissionService';
import { sendSuccess, sendError, ApiError } from '../utils/response';

const router = Router();
router.use(authenticate);

// ─── Slabs ──────────────────────────────────────────────────

/** POST /commissions/slabs */
router.post('/slabs', roleGuard('ADMIN', 'SUBADMIN', 'SHAKHA'), async (req: Request, res: Response) => {
  try {
    const slab = await CommissionService.createSlab(req.body, resolveActorId(req.user!));
    sendSuccess(res, slab, 201, 'Commission slab created.');
  } catch (err) {
    if (err instanceof ApiError) return sendError(res, err.message, err.statusCode);
    sendError(res, 'Internal error.', 500);
  }
});

/** GET /commissions/slabs?shakha_id=X */
router.get('/slabs', async (req: Request, res: Response) => {
  try {
    const shakhaId = req.query.shakha_id ? parseInt(req.query.shakha_id as string, 10) : undefined;
    const slabs = await CommissionService.getAllSlabs(shakhaId);
    sendSuccess(res, slabs);
  } catch { sendError(res, 'Internal error.', 500); }
});

// ─── Commission records ─────────────────────────────────────

/** GET /commissions/:id */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const comm = await CommissionService.findById(parseInt(req.params.id, 10));
    if (!comm) return sendError(res, 'Commission not found.', 404);
    sendSuccess(res, comm);
  } catch { sendError(res, 'Internal error.', 500); }
});

/** GET /commissions/volunteer/:volunteerId */
router.get('/volunteer/:volunteerId', async (req: Request, res: Response) => {
  try {
    const list = await CommissionService.findByVolunteer(parseInt(req.params.volunteerId, 10));
    sendSuccess(res, list);
  } catch { sendError(res, 'Internal error.', 500); }
});

/** PUT /commissions/:id/approve */
router.put('/:id/approve', roleGuard('SHAKHA', 'SUBSHAKHA', 'ADMIN', 'SUBADMIN'), async (req: Request, res: Response) => {
  try {
    const comm = await CommissionService.approve(parseInt(req.params.id, 10), resolveActorId(req.user!));
    await writeAuditLog(resolveActorId(req.user!), 'COMMISSION_APPROVED', 'commissions', comm.id, req.ipAddress ?? null);
    sendSuccess(res, comm, 200, 'Commission approved.');
  } catch (err) {
    if (err instanceof ApiError) return sendError(res, err.message, err.statusCode);
    sendError(res, 'Internal error.', 500);
  }
});

/** PUT /commissions/:id/reject */
router.put('/:id/reject', roleGuard('SHAKHA', 'SUBSHAKHA', 'ADMIN', 'SUBADMIN'), async (req: Request, res: Response) => {
  try {
    const comm = await CommissionService.reject(parseInt(req.params.id, 10), resolveActorId(req.user!));
    await writeAuditLog(resolveActorId(req.user!), 'COMMISSION_REJECTED', 'commissions', comm.id, req.ipAddress ?? null);
    sendSuccess(res, comm, 200, 'Commission rejected.');
  } catch (err) {
    if (err instanceof ApiError) return sendError(res, err.message, err.statusCode);
    sendError(res, 'Internal error.', 500);
  }
});

/** PUT /commissions/:id/pay */
router.put('/:id/pay', roleGuard('ADMIN', 'SUBADMIN'), async (req: Request, res: Response) => {
  try {
    const comm = await CommissionService.markPaid(parseInt(req.params.id, 10));
    await writeAuditLog(resolveActorId(req.user!), 'COMMISSION_PAID', 'commissions', comm.id, req.ipAddress ?? null);
    sendSuccess(res, comm, 200, 'Commission paid.');
  } catch (err) {
    if (err instanceof ApiError) return sendError(res, err.message, err.statusCode);
    sendError(res, 'Internal error.', 500);
  }
});

export default router;
