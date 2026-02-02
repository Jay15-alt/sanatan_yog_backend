// =============================================================
// src/controllers/contributorController.ts
// Pure request-handling logic.  No route definitions here.
// =============================================================

import { Request, Response } from 'express';
import { resolveActorId, writeAuditLog } from '../middleware/auth';
import { ContributorService, ContributorListFilters } from '../services/contributorService';
import { VolunteerService } from '../services/volunteerService';
import { DonationService } from '../services/donationService';
import { sendSuccess, sendError, ApiError } from '../utils/response';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the volunteer row for the acting user.
 * Returns the volunteer's DB id if the actor is a volunteer,
 * or null if the actor is an admin/shakha who has no volunteer row.
 */
async function resolveVolunteerId(actorUserId: number): Promise<number | null> {
  const volunteer = await VolunteerService.findByUserId(actorUserId);
  return volunteer?.id ?? null;
}

// ---------------------------------------------------------------------------
// POST /contributors/add
// Volunteer (or admin on behalf) adds a new contributor — Step 1.
// ---------------------------------------------------------------------------

export async function addContributor(req: Request, res: Response): Promise<void> {
  try {
    const actorId = resolveActorId(req.user!);
    const volunteerId = await resolveVolunteerId(actorId);

    if (volunteerId === null && req.user?.role !== 'ADMIN' && req.user?.role !== 'SUBADMIN') {
      sendError(res, 'Only volunteers or admins can add contributors.', 403);
      return;
    }

    const contrib = await ContributorService.addByVolunteer(req.body, volunteerId);

    await writeAuditLog(
      actorId,
      'CONTRIBUTOR_ADDED',
      'contributors',
      contrib.id,
      req.ipAddress ?? null,
      undefined,
      contrib as unknown as Record<string, unknown>,
    );

    sendSuccess(res, contrib, 201, 'Contributor added. PAN upload pending.');
  } catch (err) {
    if (err instanceof ApiError) { sendError(res, err.message, err.statusCode); return; }
    sendError(res, 'Internal error.', 500);
  }
}

// ---------------------------------------------------------------------------
// POST /contributors/:id/pan
// Contributor uploads their own PAN — Step 2.
// ---------------------------------------------------------------------------

export async function uploadPan(req: Request, res: Response): Promise<void> {
  try {
    const contributorId = parseInt(req.params.id, 10);
    const actorId = resolveActorId(req.user!);
    const actorRole = req.user?.role;

    const contrib = await ContributorService.findById(contributorId);
    if (!contrib) {
      sendError(res, 'Contributor not found.', 404);
      return;
    }

    const isOwner = contrib.user_id === actorId;
    const isManager =
      actorRole === 'ADMIN' ||
      actorRole === 'SUBADMIN' ||
      actorRole === 'SHAKHA' ||
      actorRole === 'SUBSHAKHA' ||
      actorRole === 'STAFF_VOLUNTEER' ||
      actorRole === 'FIELD_WORKER';

    if (!isOwner && !isManager) {
      sendError(res, 'You do not have permission to upload PAN for this contributor.', 403);
      return;
    }

    const updated = await ContributorService.uploadPan(contributorId, req.body);

    await writeAuditLog(actorId, 'PAN_UPLOADED', 'contributors', contributorId, req.ipAddress ?? null);

    sendSuccess(res, updated, 200, 'PAN uploaded. Awaiting verification.');
  } catch (err) {
    if (err instanceof ApiError) { sendError(res, err.message, err.statusCode); return; }
    sendError(res, 'Internal error.', 500);
  }
}

// ---------------------------------------------------------------------------
// PUT /contributors/:id/pan/verify
// ---------------------------------------------------------------------------

export async function verifyPan(req: Request, res: Response): Promise<void> {
  try {
    const contributorId = parseInt(req.params.id, 10);
    const approve = req.body?.approve === true;

    const contrib = await ContributorService.verifyPan(contributorId, approve);

    await writeAuditLog(
      resolveActorId(req.user!),
      approve ? 'PAN_APPROVED' : 'PAN_REJECTED',
      'contributors',
      contributorId,
      req.ipAddress ?? null,
    );

    sendSuccess(res, contrib, 200, approve ? 'PAN verified.' : 'PAN rejected.');
  } catch (err) {
    if (err instanceof ApiError) { sendError(res, err.message, err.statusCode); return; }
    sendError(res, 'Internal error.', 500);
  }
}

// ---------------------------------------------------------------------------
// PUT /contributors/:id/upgrade
// body: { type: "TRUSTEE" | "GRUHINI" }
// ---------------------------------------------------------------------------

export async function upgradeContributor(req: Request, res: Response): Promise<void> {
  try {
    const contributorId = parseInt(req.params.id, 10);
    const newType = req.body?.type;

    if (newType !== 'TRUSTEE' && newType !== 'GRUHINI') {
      sendError(res, 'Invalid type. Must be TRUSTEE or GRUHINI.', 400);
      return;
    }

    const contrib = await ContributorService.upgradeType(contributorId, newType);

    await writeAuditLog(
      resolveActorId(req.user!),
      'CONTRIBUTOR_UPGRADED',
      'contributors',
      contributorId,
      req.ipAddress ?? null,
      undefined,
      { contributor_type: contrib.contributor_type },
    );

    sendSuccess(res, contrib, 200, `Upgraded to ${contrib.contributor_type}.`);
  } catch (err) {
    if (err instanceof ApiError) { sendError(res, err.message, err.statusCode); return; }
    sendError(res, 'Internal error.', 500);
  }
}

// ---------------------------------------------------------------------------
// PUT /contributors/:id/reassign
// body: { team_id: number }
// ---------------------------------------------------------------------------

export async function reassignContributor(req: Request, res: Response): Promise<void> {
  try {
    const contributorId = parseInt(req.params.id, 10);
    const teamId = req.body?.team_id;

    if (!teamId || typeof teamId !== 'number') {
      sendError(res, 'team_id is required and must be a number.', 400);
      return;
    }

    const contrib = await ContributorService.reassignTeam(contributorId, teamId);

    await writeAuditLog(
      resolveActorId(req.user!),
      'CONTRIBUTOR_REASSIGNED',
      'contributors',
      contributorId,
      req.ipAddress ?? null,
      undefined,
      { assigned_team_id: teamId },
    );

    sendSuccess(res, contrib, 200, 'Reassigned to new team.');
  } catch (err) {
    if (err instanceof ApiError) { sendError(res, err.message, err.statusCode); return; }
    sendError(res, 'Internal error.', 500);
  }
}

// ---------------------------------------------------------------------------
// GET /contributors/team/:teamId
// ---------------------------------------------------------------------------

export async function listByTeam(req: Request, res: Response): Promise<void> {
  try {
    const teamId = parseInt(req.params.teamId, 10);
    const list = await ContributorService.findByTeam(teamId);
    sendSuccess(res, list);
  } catch (err) {
    if (err instanceof ApiError) { sendError(res, err.message, err.statusCode); return; }
    sendError(res, 'Internal error.', 500);
  }
}

// ---------------------------------------------------------------------------
// GET /contributors/:id
// ---------------------------------------------------------------------------

export async function getContributor(req: Request, res: Response): Promise<void> {
  try {
    const contrib = await ContributorService.findById(parseInt(req.params.id, 10));
    if (!contrib) {
      sendError(res, 'Contributor not found.', 404);
      return;
    }
    sendSuccess(res, contrib);
  } catch (err) {
    if (err instanceof ApiError) { sendError(res, err.message, err.statusCode); return; }
    sendError(res, 'Internal error.', 500);
  }
}

// ---------------------------------------------------------------------------
// GET /contributors/:id/donations
// ---------------------------------------------------------------------------

export async function getContributorDonations(req: Request, res: Response): Promise<void> {
  try {
    const donations = await DonationService.findByContributor(parseInt(req.params.id, 10));
    sendSuccess(res, donations);
  } catch (err) {
    if (err instanceof ApiError) { sendError(res, err.message, err.statusCode); return; }
    sendError(res, 'Internal error.', 500);
  }
}

// ---------------------------------------------------------------------------
// DELETE /contributors/:id   (soft-delete)
// ---------------------------------------------------------------------------

export async function deactivateContributor(req: Request, res: Response): Promise<void> {
  try {
    const contributorId = parseInt(req.params.id, 10);

    await ContributorService.deactivate(contributorId);

    await writeAuditLog(
      resolveActorId(req.user!),
      'CONTRIBUTOR_DEACTIVATED',
      'contributors',
      contributorId,
      req.ipAddress ?? null,
    );

    sendSuccess(res, {}, 200, 'Contributor deactivated.');
  } catch (err) {
    if (err instanceof ApiError) { sendError(res, err.message, err.statusCode); return; }
    sendError(res, 'Internal error.', 500);
  }
}

// ===========================================================================
// Admin-only handlers  (mounted under adminRoutes, not contributorRoutes)
// ===========================================================================

// ---------------------------------------------------------------------------
// GET /admin/contributors
// Query-string filters (all optional):
//   ?is_active=0|1
//   &category_id=<n>
//   &contributor_type=GENERAL|TRUSTEE|GRUHINI
//   &pan_status=NOT_UPLOADED|PENDING|VERIFIED|REJECTED
//   &assigned_team_id=<n>
//   &search=<text>   ← matches user name, email, or PAN number
// ---------------------------------------------------------------------------

export async function listAllContributors(req: Request, res: Response): Promise<void> {
  try {
    const q = req.query;

    const filters: ContributorListFilters = {};

    // ── is_active ──
    if (q.is_active === '0' || q.is_active === '1') {
      filters.is_active = parseInt(q.is_active, 10) as 0 | 1;
    }

    // ── category_id ──
    if (q.category_id) {
      const parsed = parseInt(q.category_id as string, 10);
      if (!isNaN(parsed)) filters.category_id = parsed;
    }

    // ── contributor_type ──
    const validTypes = ['GENERAL', 'TRUSTEE', 'GRUHINI'] as const;
    if (q.contributor_type && validTypes.includes(q.contributor_type as typeof validTypes[number])) {
      filters.contributor_type = q.contributor_type as typeof validTypes[number];
    }

    // ── pan_status ──
    const validPanStatuses = ['NOT_UPLOADED', 'PENDING', 'VERIFIED', 'REJECTED'] as const;
    if (q.pan_status && validPanStatuses.includes(q.pan_status as typeof validPanStatuses[number])) {
      filters.pan_status = q.pan_status as typeof validPanStatuses[number];
    }

    // ── assigned_team_id ──
    if (q.assigned_team_id) {
      const parsed = parseInt(q.assigned_team_id as string, 10);
      if (!isNaN(parsed)) filters.assigned_team_id = parsed;
    }

    // ── free-text search ──
    if (q.search && typeof q.search === 'string' && q.search.trim()) {
      filters.search = q.search.trim();
    }

    const list = await ContributorService.findAll(filters);
    sendSuccess(res, list);
  } catch (err) {
    if (err instanceof ApiError) { sendError(res, err.message, err.statusCode); return; }
    sendError(res, 'Internal error.', 500);
  }
}

// ---------------------------------------------------------------------------
// PUT /admin/contributors/:id/activate
// Re-enables a previously deactivated contributor.
// ---------------------------------------------------------------------------

export async function activateContributor(req: Request, res: Response): Promise<void> {
  try {
    const contributorId = parseInt(req.params.id, 10);

    // Verify the row actually exists before we write.
    const contrib = await ContributorService.findById(contributorId);
    if (!contrib) {
      sendError(res, 'Contributor not found.', 404);
      return;
    }

    await ContributorService.activate(contributorId);

    await writeAuditLog(
      resolveActorId(req.user!),
      'CONTRIBUTOR_ACTIVATED',
      'contributors',
      contributorId,
      req.ipAddress ?? null,
    );

    sendSuccess(res, {}, 200, 'Contributor activated.');
  } catch (err) {
    if (err instanceof ApiError) { sendError(res, err.message, err.statusCode); return; }
    sendError(res, 'Internal error.', 500);
  }
}