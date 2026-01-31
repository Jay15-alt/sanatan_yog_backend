// =============================================================
// src/controllers/contributorController.ts
// =============================================================

import { Router, Request, Response } from 'express';
import { authenticate, roleGuard, writeAuditLog, resolveActorId } from '../middleware/auth';
import { ContributorService } from '../services/contributorService';
import { sendSuccess, sendError, ApiError } from '../utils/response';
import { DonationService } from '../services/donationService';

const router = Router();
router.use(authenticate);

/** POST /contributors/add   — volunteer adds a contributor (Step 1) */
router.post('/add', roleGuard('STAFF_VOLUNTEER', 'FIELD_WORKER', 'ADMIN', 'SUBADMIN', 'SHAKHA', 'SUBSHAKHA'), async (req: Request, res: Response) => {
  try {
    // Resolve the volunteer row for the current user
    const { VolunteerService: VS } = await import('../services/volunteerService');
    const volunteer = await VS.findByUserId(resolveActorId(req.user!));
    const volunteerId = volunteer?.id ?? resolveActorId(req.user!); // fallback for admin

    const contrib = await ContributorService.addByVolunteer(req.body, volunteerId);
    await writeAuditLog(resolveActorId(req.user!), 'ADD_CONTRIBUTOR', 'contributors', contrib.id, req.ipAddress ?? null, undefined, contrib as unknown as Record<string, unknown>);
    sendSuccess(res, contrib, 201, 'Contributor added. PAN upload pending.');
  } catch (err) {
    if (err instanceof ApiError) return sendError(res, err.message, err.statusCode);
    sendError(res, 'Internal error.', 500);
  }
});

/** POST /contributors/:id/pan   — contributor uploads PAN (Step 2) */
router.post('/:id/pan', async (req: Request, res: Response) => {
  try {
    const contrib = await ContributorService.uploadPan(parseInt(req.params.id, 10), req.body);
    sendSuccess(res, contrib, 200, 'PAN uploaded. Awaiting verification.');
  } catch (err) {
    if (err instanceof ApiError) return sendError(res, err.message, err.statusCode);
    sendError(res, 'Internal error.', 500);
  }
});

/** PUT /contributors/:id/pan/verify   — volunteer / shakha verifies PAN */
router.put('/:id/pan/verify', roleGuard('STAFF_VOLUNTEER', 'FIELD_WORKER', 'ADMIN', 'SUBADMIN', 'SHAKHA'), async (req: Request, res: Response) => {
  try {
    const { approve } = req.body as { approve: boolean };
    const contrib = await ContributorService.verifyPan(parseInt(req.params.id, 10), approve === true);
    await writeAuditLog(resolveActorId(req.user!), approve ? 'PAN_APPROVED' : 'PAN_REJECTED', 'contributors', contrib.id, req.ipAddress ?? null);
    sendSuccess(res, contrib, 200, approve ? 'PAN verified.' : 'PAN rejected.');
  } catch (err) {
    if (err instanceof ApiError) return sendError(res, err.message, err.statusCode);
    sendError(res, 'Internal error.', 500);
  }
});

/** PUT /contributors/:id/upgrade   body: { type: "TRUSTEE" | "GRUHINI" } */
router.put('/:id/upgrade', roleGuard('SHAKHA', 'ADMIN', 'SUBADMIN'), async (req: Request, res: Response) => {
  try {
    const contrib = await ContributorService.upgradeType(
      parseInt(req.params.id, 10),
      req.body.type,
    );
    await writeAuditLog(resolveActorId(req.user!), 'UPGRADE_TYPE', 'contributors', contrib.id, req.ipAddress ?? null, undefined, { contributor_type: contrib.contributor_type });
    sendSuccess(res, contrib, 200, `Upgraded to ${contrib.contributor_type}.`);
  } catch (err) {
    if (err instanceof ApiError) return sendError(res, err.message, err.statusCode);
    sendError(res, 'Internal error.', 500);
  }
});

/** PUT /contributors/:id/reassign   body: { team_id: number } */
router.put('/:id/reassign', roleGuard('SHAKHA', 'ADMIN', 'SUBADMIN'), async (req: Request, res: Response) => {
  try {
    const contrib = await ContributorService.reassignTeam(
      parseInt(req.params.id, 10),
      req.body.team_id,
    );
    sendSuccess(res, contrib, 200, 'Reassigned to new team.');
  } catch (err) {
    if (err instanceof ApiError) return sendError(res, err.message, err.statusCode);
    sendError(res, 'Internal error.', 500);
  }
});

/** GET /contributors/:id */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const contrib = await ContributorService.findById(parseInt(req.params.id, 10));
    if (!contrib) return sendError(res, 'Contributor not found.', 404);
    sendSuccess(res, contrib);
  } catch { sendError(res, 'Internal error.', 500); }
});

/** GET /contributors/:id/donations   — transaction history */
router.get('/:id/donations', async (req: Request, res: Response) => {
  try {
    const donations = await DonationService.findByContributor(parseInt(req.params.id, 10));
    sendSuccess(res, donations);
  } catch { sendError(res, 'Internal error.', 500); }
});

/** GET /contributors/team/:teamId */
router.get('/team/:teamId', async (req: Request, res: Response) => {
  try {
    const list = await ContributorService.findByTeam(parseInt(req.params.teamId, 10));
    sendSuccess(res, list);
  } catch { sendError(res, 'Internal error.', 500); }
});

/** DELETE /contributors/:id  (soft) */
router.delete('/:id', roleGuard('ADMIN', 'SUBADMIN', 'SHAKHA'), async (req: Request, res: Response) => {
  try {
    await ContributorService.deactivate(parseInt(req.params.id, 10));
    sendSuccess(res, {}, 200, 'Contributor deactivated.');
  } catch { sendError(res, 'Internal error.', 500); }
});

export default router;
