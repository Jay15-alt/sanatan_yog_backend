// =============================================================
// src/controllers/eventController.ts
// =============================================================

import { Router, Request, Response } from 'express';
import { authenticate, roleGuard, writeAuditLog, resolveActorId } from '../middleware/auth';
import { EventService } from '../services/eventService';
import { sendSuccess, sendError, ApiError } from '../utils/response';

const router = Router();
router.use(authenticate);

// ─── Events ─────────────────────────────────────────────────

/** POST /events */
router.post('/', roleGuard('ADMIN', 'SUBADMIN', 'PEETH', 'SHAKHA', 'SUBSHAKHA'), async (req: Request, res: Response) => {
  try {
    const event = await EventService.create(req.body, resolveActorId(req.user!));
    await writeAuditLog(resolveActorId(req.user!), 'CREATE_EVENT', 'events', event.id, req.ipAddress ?? null, undefined, event as unknown as Record<string, unknown>);
    sendSuccess(res, event, 201, 'Event created with QR code.');
  } catch (err) {
    if (err instanceof ApiError) return sendError(res, err.message, err.statusCode);
    sendError(res, 'Internal error.', 500);
  }
});

/** GET /events */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const list = await EventService.findAll();
    sendSuccess(res, list);
  } catch { sendError(res, 'Internal error.', 500); }
});

/** GET /events/:id */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const event = await EventService.findById(parseInt(req.params.id, 10));
    if (!event) return sendError(res, 'Event not found.', 404);
    sendSuccess(res, event);
  } catch { sendError(res, 'Internal error.', 500); }
});

/**
 * PUT /events/:id
 * Edit restriction: only the creator can edit, unless caller is ADMIN/SUBADMIN.
 */
router.put('/:id', roleGuard('ADMIN', 'SUBADMIN', 'PEETH', 'SHAKHA', 'SUBSHAKHA'), async (req: Request, res: Response) => {
  try {
    const event = await EventService.findById(parseInt(req.params.id, 10));
    if (!event) return sendError(res, 'Event not found.', 404);

    // Ownership check (ADMIN / SUBADMIN bypass)
    const isAdmin = req.user!.role === 'ADMIN' || req.user!.role === 'SUBADMIN';
    if (!isAdmin && event.created_by !== resolveActorId(req.user!)) {
      return sendError(res, 'You can only edit events you created.', 403);
    }

    const updated = await EventService.update(parseInt(req.params.id, 10), req.body);
    await writeAuditLog(resolveActorId(req.user!), 'UPDATE_EVENT', 'events', updated.id, req.ipAddress ?? null, event as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>);
    sendSuccess(res, updated, 200, 'Event updated.');
  } catch (err) {
    if (err instanceof ApiError) return sendError(res, err.message, err.statusCode);
    sendError(res, 'Internal error.', 500);
  }
});

/** DELETE /events/:id  (soft) */
router.delete('/:id', roleGuard('ADMIN', 'SUBADMIN'), async (req: Request, res: Response) => {
  try {
    await EventService.deactivate(parseInt(req.params.id, 10));
    sendSuccess(res, {}, 200, 'Event deactivated.');
  } catch { sendError(res, 'Internal error.', 500); }
});

// ─── Participants ───────────────────────────────────────────

/** POST /events/:id/participants   body: { user_id, role } */
router.post('/:id/participants', async (req: Request, res: Response) => {
  try {
    const participant = await EventService.registerParticipant(parseInt(req.params.id, 10), req.body);
    sendSuccess(res, participant, 201, 'Registered for event.');
  } catch (err) {
    if (err instanceof ApiError) return sendError(res, err.message, err.statusCode);
    sendError(res, 'Internal error.', 500);
  }
});

/** GET /events/:id/participants */
router.get('/:id/participants', async (req: Request, res: Response) => {
  try {
    const list = await EventService.getParticipantsByEvent(parseInt(req.params.id, 10));
    sendSuccess(res, list);
  } catch { sendError(res, 'Internal error.', 500); }
});

// ─── Attendance ─────────────────────────────────────────────

/** POST /events/attendance/scan   body: { qr_code_token, user_id } */
router.post('/attendance/scan', async (req: Request, res: Response) => {
  try {
    const attendance = await EventService.markAttendance(req.body);
    sendSuccess(res, attendance, 200, 'Attendance recorded.');
  } catch (err) {
    if (err instanceof ApiError) return sendError(res, err.message, err.statusCode);
    sendError(res, 'Internal error.', 500);
  }
});

/** GET /events/attendance/user/:userId   — personal attendance history */
router.get('/attendance/user/:userId', async (req: Request, res: Response) => {
  try {
    const history = await EventService.getAttendanceHistory(parseInt(req.params.userId, 10));
    sendSuccess(res, history);
  } catch { sendError(res, 'Internal error.', 500); }
});

// ─── Reports ────────────────────────────────────────────────

/** GET /events/:id/report   — full event attendance report */
router.get('/:id/report', async (req: Request, res: Response) => {
  try {
    const report = await EventService.generateAttendanceReport(parseInt(req.params.id, 10));
    sendSuccess(res, report);
  } catch (err) {
    if (err instanceof ApiError) return sendError(res, err.message, err.statusCode);
    sendError(res, 'Internal error.', 500);
  }
});

export default router;
