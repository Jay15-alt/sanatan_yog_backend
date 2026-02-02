import { Router, Request, Response } from 'express';
import { authenticate, roleGuard, resolveActorId, writeAuditLog } from '../middleware/auth';
import { VolunteerService } from '../services/volunteerService';
import { sendSuccess, sendError, ApiError } from '../utils/response';

const router = Router();
router.use(authenticate);

router.post('/', roleGuard('ADMIN', 'SUBADMIN', 'SHAKHA', 'SUBSHAKHA'), async (req: Request, res: Response) => {
  try {
    const vol = await VolunteerService.create(req.body, resolveActorId(req.user!));
    await writeAuditLog(resolveActorId(req.user!), 'CREATE', 'volunteers', vol.id, req.ipAddress ?? null, undefined, vol as unknown as Record<string, unknown>);
    sendSuccess(res, vol, 201, 'Volunteer created.');
  } catch (err) {
    if (err instanceof ApiError) return sendError(res, err.message, err.statusCode);
    sendError(res, 'Internal error.', 500);
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const vol = await VolunteerService.findById(parseInt(req.params.id, 10));
    if (!vol) return sendError(res, 'Volunteer not found.', 404);
    sendSuccess(res, vol);
  } catch {
    sendError(res, 'Internal error.', 500);
  }
});

router.get('/team/:teamId', async (req: Request, res: Response) => {
  try {
    const list = await VolunteerService.findByTeam(parseInt(req.params.teamId, 10));
    sendSuccess(res, list);
  } catch {
    sendError(res, 'Internal error.', 500);
  }
});

router.delete('/:id', roleGuard('ADMIN', 'SUBADMIN', 'SHAKHA', 'SUBSHAKHA'), async (req: Request, res: Response) => {
  try {
    await VolunteerService.deactivate(parseInt(req.params.id, 10));
    sendSuccess(res, {}, 200, 'Volunteer deactivated.');
  } catch {
    sendError(res, 'Internal error.', 500);
  }
});

router.post('/:id/salary', roleGuard('ADMIN', 'SUBADMIN'), async (req: Request, res: Response) => {
  try {
    const sal = await VolunteerService.createSalaryRecord(parseInt(req.params.id, 10), new Date(req.body.pay_month));
    sendSuccess(res, sal, 201, 'Salary record created.');
  } catch (err) {
    if (err instanceof ApiError) return sendError(res, err.message, err.statusCode);
    sendError(res, 'Internal error.', 500);
  }
});

router.get('/:id/salary', async (req: Request, res: Response) => {
  try {
    const list = await VolunteerService.getSalariesByVolunteer(parseInt(req.params.id, 10));
    sendSuccess(res, list);
  } catch {
    sendError(res, 'Internal error.', 500);
  }
});

router.put('/salary/:salaryId/pay', roleGuard('ADMIN', 'SUBADMIN'), async (req: Request, res: Response) => {
  try {
    const sal = await VolunteerService.markSalaryPaid(parseInt(req.params.salaryId, 10));
    sendSuccess(res, sal, 200, 'Salary marked as paid.');
  } catch (err) {
    if (err instanceof ApiError) return sendError(res, err.message, err.statusCode);
    sendError(res, 'Internal error.', 500);
  }
});

export default router;
