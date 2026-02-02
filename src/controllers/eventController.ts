// =============================================================
// src/controllers/eventController.ts
// Pure request-handling logic. No route definitions here.
// =============================================================

import { Request, Response } from 'express';
import { EventService } from '../services/eventService';
import { resolveActorId, writeAuditLog } from '../middleware/auth';
import { sendSuccess, sendError, ApiError } from '../utils/response';

// ─── Events ─────────────────────────────────────────────────

/** Create a new event */
export async function createEvent(req: Request, res: Response): Promise<void> {
  try {
    const event = await EventService.create(req.body, resolveActorId(req.user!));
    await writeAuditLog(
      resolveActorId(req.user!),
      'CREATE_EVENT',
      'events',
      event.id,
      req.ipAddress ?? null,
      undefined,
      event as unknown as Record<string, unknown>
    );
    sendSuccess(res, event, 201, 'Event created with QR code.');
  } catch (err) {
    if (err instanceof ApiError) {
      sendError(res, err.message, err.statusCode);
      return;
    }
    sendError(res, 'Internal error.', 500);
  }
}

/** List all events */
export async function listEvents(_req: Request, res: Response): Promise<void> {
  try {
    const list = await EventService.findAll();
    sendSuccess(res, list);
  } catch {
    sendError(res, 'Internal error.', 500);
  }
}

/** Get single event by ID */
export async function getEvent(req: Request, res: Response): Promise<void> {
  try {
    const event = await EventService.findById(parseInt(req.params.id, 10));
    if (!event) {
      sendError(res, 'Event not found.', 404);
      return;
    }
    sendSuccess(res, event);
  } catch {
    sendError(res, 'Internal error.', 500);
  }
}

/** Update event (only creator or ADMIN/SUBADMIN) */
export async function updateEvent(req: Request, res: Response): Promise<void> {
  try {
    const event = await EventService.findById(parseInt(req.params.id, 10));
    if (!event) {
      sendError(res, 'Event not found.', 404);
      return;
    }

    // Ownership check (ADMIN / SUBADMIN bypass)
    const isAdmin = req.user!.role === 'ADMIN' || req.user!.role === 'SUBADMIN';
    if (!isAdmin && event.created_by !== resolveActorId(req.user!)) {
      sendError(res, 'You can only edit events you created.', 403);
      return;
    }

    const updated = await EventService.update(parseInt(req.params.id, 10), req.body);
    await writeAuditLog(
      resolveActorId(req.user!),
      'UPDATE_EVENT',
      'events',
      updated.id,
      req.ipAddress ?? null,
      event as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>
    );
    sendSuccess(res, updated, 200, 'Event updated.');
  } catch (err) {
    if (err instanceof ApiError) {
      sendError(res, err.message, err.statusCode);
      return;
    }
    sendError(res, 'Internal error.', 500);
  }
}

/** Deactivate event (soft delete) */
export async function deactivateEvent(req: Request, res: Response): Promise<void> {
  try {
    await EventService.deactivate(parseInt(req.params.id, 10));
    await writeAuditLog(
      resolveActorId(req.user!),
      'DEACTIVATE_EVENT',
      'events',
      parseInt(req.params.id, 10),
      req.ipAddress ?? null
    );
    sendSuccess(res, {}, 200, 'Event deactivated.');
  } catch {
    sendError(res, 'Internal error.', 500);
  }
}

// ─── Participants ───────────────────────────────────────────

/** Register participant for an event */
export async function registerParticipant(req: Request, res: Response): Promise<void> {
  try {
    const participant = await EventService.registerParticipant(
      parseInt(req.params.id, 10),
      req.body
    );
    sendSuccess(res, participant, 201, 'Registered for event.');
  } catch (err) {
    if (err instanceof ApiError) {
      sendError(res, err.message, err.statusCode);
      return;
    }
    sendError(res, 'Internal error.', 500);
  }
}

/** Get all participants for an event */
export async function getEventParticipants(req: Request, res: Response): Promise<void> {
  try {
    const list = await EventService.getParticipantsByEvent(parseInt(req.params.id, 10));
    sendSuccess(res, list);
  } catch {
    sendError(res, 'Internal error.', 500);
  }
}

// ─── Attendance ─────────────────────────────────────────────

/** Mark attendance via QR code scan */
export async function markAttendance(req: Request, res: Response): Promise<void> {
  try {
    const attendance = await EventService.markAttendance(req.body);
    sendSuccess(res, attendance, 200, 'Attendance recorded.');
  } catch (err) {
    if (err instanceof ApiError) {
      sendError(res, err.message, err.statusCode);
      return;
    }
    sendError(res, 'Internal error.', 500);
  }
}

/** Get attendance history for a user */
export async function getUserAttendanceHistory(req: Request, res: Response): Promise<void> {
  try {
    const history = await EventService.getAttendanceHistory(parseInt(req.params.userId, 10));
    sendSuccess(res, history);
  } catch {
    sendError(res, 'Internal error.', 500);
  }
}

// ─── Reports ────────────────────────────────────────────────

/** Generate full attendance report for an event */
export async function getEventAttendanceReport(req: Request, res: Response): Promise<void> {
  try {
    const report = await EventService.generateAttendanceReport(parseInt(req.params.id, 10));
    sendSuccess(res, report);
  } catch (err) {
    if (err instanceof ApiError) {
      sendError(res, err.message, err.statusCode);
      return;
    }
    sendError(res, 'Internal error.', 500);
  }
}