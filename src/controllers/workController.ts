// =============================================================
// src/controllers/workController.ts
// =============================================================

import { Router, Request, Response } from 'express';
import { authenticate, roleGuard, writeAuditLog, resolveActorId } from '../middleware/auth';
import { WorkService } from '../services/workService';
import { sendSuccess, sendError, ApiError } from '../utils/response';

const router = Router();
router.use(authenticate);

/** POST /works */
router.post('/', roleGuard('ADMIN', 'SUBADMIN', 'PEETH', 'SHAKHA'), async (req: Request, res: Response) => {
  try {
    const work = await WorkService.create(req.body, resolveActorId(req.user!));
    await writeAuditLog(resolveActorId(req.user!), 'CREATE_WORK', 'works', work.id, req.ipAddress ?? null, undefined, work as unknown as Record<string, unknown>);
    sendSuccess(res, work, 201, 'Work created (Proposed).');
  } catch (err) {
    if (err instanceof ApiError) return sendError(res, err.message, err.statusCode);
    sendError(res, 'Internal error.', 500);
  }
});

/** GET /works   optional ?status=PROPOSED|ONGOING|COMPLETED */
router.get('/', async (req: Request, res: Response) => {
  try {
    const list = await WorkService.findAll(req.query.status as string | undefined);
    sendSuccess(res, list);
  } catch { sendError(res, 'Internal error.', 500); }
});

/** GET /works/:id */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const work = await WorkService.findById(parseInt(req.params.id, 10));
    if (!work) return sendError(res, 'Work not found.', 404);
    sendSuccess(res, work);
  } catch { sendError(res, 'Internal error.', 500); }
});

/** PUT /works/:id   — update title / description / status transition */
router.put('/:id', roleGuard('ADMIN', 'SUBADMIN', 'PEETH', 'SHAKHA'), async (req: Request, res: Response) => {
  try {
    const oldWork = await WorkService.findById(parseInt(req.params.id, 10));
    const work = await WorkService.update(parseInt(req.params.id, 10), req.body, resolveActorId(req.user!));
    await writeAuditLog(resolveActorId(req.user!), 'UPDATE_WORK', 'works', work.id, req.ipAddress ?? null, oldWork as unknown as Record<string, unknown>, work as unknown as Record<string, unknown>);
    sendSuccess(res, work, 200, 'Work updated.');
  } catch (err) {
    if (err instanceof ApiError) return sendError(res, err.message, err.statusCode);
    sendError(res, 'Internal error.', 500);
  }
});

// ─── Expenses ───────────────────────────────────────────────

/** POST /works/:id/expenses */
router.post('/:id/expenses', roleGuard('ADMIN', 'SUBADMIN', 'PEETH', 'SHAKHA'), async (req: Request, res: Response) => {
  try {
    const exp = await WorkService.addExpense(
      parseInt(req.params.id, 10),
      req.body.description,
      req.body.amount,
      resolveActorId(req.user!),
    );
    sendSuccess(res, exp, 201, 'Expense added.');
  } catch (err) {
    if (err instanceof ApiError) return sendError(res, err.message, err.statusCode);
    sendError(res, 'Internal error.', 500);
  }
});

/** GET /works/:id/expenses */
router.get('/:id/expenses', async (req: Request, res: Response) => {
  try {
    const list = await WorkService.getExpensesByWork(parseInt(req.params.id, 10));
    sendSuccess(res, list);
  } catch { sendError(res, 'Internal error.', 500); }
});

export default router;
