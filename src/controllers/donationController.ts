// =============================================================
// src/controllers/donationController.ts
// =============================================================

import { Router, Request, Response } from 'express';
import { authenticate, roleGuard, writeAuditLog, resolveActorId } from '../middleware/auth';
import { DonationService } from '../services/donationService';
import { sendSuccess, sendError, ApiError } from '../utils/response';

const router = Router();
router.use(authenticate);

/** POST /donations   — volunteer records a donation */
router.post('/', roleGuard('STAFF_VOLUNTEER', 'FIELD_WORKER', 'ADMIN', 'SUBADMIN'), async (req: Request, res: Response) => {
  try {
    const donation = await DonationService.create(req.body);
    await writeAuditLog(resolveActorId(req.user!), 'CREATE_DONATION', 'donations', donation.id, req.ipAddress ?? null, undefined, donation as unknown as Record<string, unknown>);
    sendSuccess(res, donation, 201, 'Donation recorded. Receipt generated.');
  } catch (err) {
    if (err instanceof ApiError) return sendError(res, err.message, err.statusCode);
    sendError(res, 'Internal error.', 500);
  }
});

/** GET /donations/:id */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const donation = await DonationService.findById(parseInt(req.params.id, 10));
    if (!donation) return sendError(res, 'Donation not found.', 404);
    sendSuccess(res, donation);
  } catch { sendError(res, 'Internal error.', 500); }
});

/** GET /donations/contributor/:contributorId */
router.get('/contributor/:contributorId', async (req: Request, res: Response) => {
  try {
    const list = await DonationService.findByContributor(parseInt(req.params.contributorId, 10));
    sendSuccess(res, list);
  } catch { sendError(res, 'Internal error.', 500); }
});

/** GET /donations/volunteer/:volunteerId */
router.get('/volunteer/:volunteerId', async (req: Request, res: Response) => {
  try {
    const list = await DonationService.findByVolunteer(parseInt(req.params.volunteerId, 10));
    sendSuccess(res, list);
  } catch { sendError(res, 'Internal error.', 500); }
});

export default router;
