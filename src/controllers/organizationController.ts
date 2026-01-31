// =============================================================
// src/controllers/organizationController.ts
// =============================================================

import { Router, Request, Response } from 'express';
import { authenticate, roleGuard, writeAuditLog, resolveActorId } from '../middleware/auth';
import {
  PeethService,
  ShakhaService,
  SubShakhaService,
  TeamService,
} from '../services/organizationService';
import { sendSuccess, sendError, ApiError } from '../utils/response';

const router = Router();
router.use(authenticate);

// ─── PEETH ──────────────────────────────────────────────────

/** POST /org/peeth */
router.post('/peeth', roleGuard('ADMIN', 'SUBADMIN'), async (req: Request, res: Response) => {
  try {
    const peeth = await PeethService.create(req.body, resolveActorId(req.user!));
    await writeAuditLog(resolveActorId(req.user!), 'CREATE', 'peeths', peeth.id, req.ipAddress ?? null, undefined, peeth as unknown as Record<string, unknown>);
    sendSuccess(res, peeth, 201, 'Peeth created.');
  } catch (err) {
    if (err instanceof ApiError) return sendError(res, err.message, err.statusCode);
    sendError(res, 'Internal error.', 500);
  }
});

/** GET /org/peeth */
router.get('/peeth', async (_req: Request, res: Response) => {
  try {
    const list = await PeethService.findAll();
    sendSuccess(res, list);
  } catch { sendError(res, 'Internal error.', 500); }
});

/** GET /org/peeth/:id */
router.get('/peeth/:id', async (req: Request, res: Response) => {
  try {
    const peeth = await PeethService.findById(parseInt(req.params.id, 10));
    if (!peeth) return sendError(res, 'Peeth not found.', 404);
    sendSuccess(res, peeth);
  } catch { sendError(res, 'Internal error.', 500); }
});

/** DELETE /org/peeth/:id  (soft-delete) */
router.delete('/peeth/:id', roleGuard('ADMIN', 'SUBADMIN'), async (req: Request, res: Response) => {
  try {
    await PeethService.deactivate(parseInt(req.params.id, 10));
    sendSuccess(res, {}, 200, 'Peeth deactivated.');
  } catch { sendError(res, 'Internal error.', 500); }
});

// ─── SHAKHA ─────────────────────────────────────────────────

/** POST /org/shakha */
router.post('/shakha', roleGuard('ADMIN', 'SUBADMIN', 'PEETH'), async (req: Request, res: Response) => {
  try {
    const shakha = await ShakhaService.create(req.body, resolveActorId(req.user!));
    await writeAuditLog(resolveActorId(req.user!), 'CREATE', 'shakhas', shakha.id, req.ipAddress ?? null, undefined, shakha as unknown as Record<string, unknown>);
    sendSuccess(res, shakha, 201, 'Shakha created.');
  } catch (err) {
    if (err instanceof ApiError) return sendError(res, err.message, err.statusCode);
    sendError(res, 'Internal error.', 500);
  }
});

/** GET /org/shakha?peeth_id=X */
router.get('/shakha', async (req: Request, res: Response) => {
  try {
    const peethId = req.query.peeth_id ? parseInt(req.query.peeth_id as string, 10) : undefined;
    const list = peethId
      ? await ShakhaService.findByPeeth(peethId)
      : [];                                          // require peeth_id for listing
    sendSuccess(res, list);
  } catch { sendError(res, 'Internal error.', 500); }
});

/** GET /org/shakha/:id */
router.get('/shakha/:id', async (req: Request, res: Response) => {
  try {
    const shakha = await ShakhaService.findById(parseInt(req.params.id, 10));
    if (!shakha) return sendError(res, 'Shakha not found.', 404);
    sendSuccess(res, shakha);
  } catch { sendError(res, 'Internal error.', 500); }
});

/** DELETE /org/shakha/:id */
router.delete('/shakha/:id', roleGuard('ADMIN', 'SUBADMIN', 'PEETH'), async (req: Request, res: Response) => {
  try {
    await ShakhaService.deactivate(parseInt(req.params.id, 10));
    sendSuccess(res, {}, 200, 'Shakha deactivated.');
  } catch { sendError(res, 'Internal error.', 500); }
});

// ─── SUB-SHAKHA ─────────────────────────────────────────────

/** POST /org/sub-shakha */
router.post('/sub-shakha', roleGuard('ADMIN', 'SUBADMIN', 'SHAKHA'), async (req: Request, res: Response) => {
  try {
    const ss = await SubShakhaService.create(req.body, resolveActorId(req.user!));
    await writeAuditLog(resolveActorId(req.user!), 'CREATE', 'sub_shakhas', ss.id, req.ipAddress ?? null, undefined, ss as unknown as Record<string, unknown>);
    sendSuccess(res, ss, 201, 'SubShakha created.');
  } catch (err) {
    if (err instanceof ApiError) return sendError(res, err.message, err.statusCode);
    sendError(res, 'Internal error.', 500);
  }
});

/** GET /org/sub-shakha?shakha_id=X */
router.get('/sub-shakha', async (req: Request, res: Response) => {
  try {
    const shakhaId = req.query.shakha_id ? parseInt(req.query.shakha_id as string, 10) : undefined;
    const list = shakhaId ? await SubShakhaService.findByShakha(shakhaId) : [];
    sendSuccess(res, list);
  } catch { sendError(res, 'Internal error.', 500); }
});

/** GET /org/sub-shakha/:id */
router.get('/sub-shakha/:id', async (req: Request, res: Response) => {
  try {
    const ss = await SubShakhaService.findById(parseInt(req.params.id, 10));
    if (!ss) return sendError(res, 'SubShakha not found.', 404);
    sendSuccess(res, ss);
  } catch { sendError(res, 'Internal error.', 500); }
});

/** DELETE /org/sub-shakha/:id */
router.delete('/sub-shakha/:id', roleGuard('ADMIN', 'SUBADMIN', 'SHAKHA'), async (req: Request, res: Response) => {
  try {
    await SubShakhaService.deactivate(parseInt(req.params.id, 10));
    sendSuccess(res, {}, 200, 'SubShakha deactivated.');
  } catch { sendError(res, 'Internal error.', 500); }
});

// ─── TEAM ───────────────────────────────────────────────────

/** POST /org/team */
router.post('/team', roleGuard('ADMIN', 'SUBADMIN', 'SHAKHA', 'SUBSHAKHA'), async (req: Request, res: Response) => {
  try {
    const team = await TeamService.create(req.body, resolveActorId(req.user!));
    await writeAuditLog(resolveActorId(req.user!), 'CREATE', 'teams', team.id, req.ipAddress ?? null, undefined, team as unknown as Record<string, unknown>);
    sendSuccess(res, team, 201, 'Team created.');
  } catch (err) {
    if (err instanceof ApiError) return sendError(res, err.message, err.statusCode);
    sendError(res, 'Internal error.', 500);
  }
});

/** GET /org/team/:id */
router.get('/team/:id', async (req: Request, res: Response) => {
  try {
    const team = await TeamService.findById(parseInt(req.params.id, 10));
    if (!team) return sendError(res, 'Team not found.', 404);
    sendSuccess(res, team);
  } catch { sendError(res, 'Internal error.', 500); }
});

/** DELETE /org/team/:id */
router.delete('/team/:id', roleGuard('ADMIN', 'SUBADMIN', 'SHAKHA', 'SUBSHAKHA'), async (req: Request, res: Response) => {
  try {
    await TeamService.deactivate(parseInt(req.params.id, 10));
    sendSuccess(res, {}, 200, 'Team deactivated.');
  } catch { sendError(res, 'Internal error.', 500); }
});

export default router;
