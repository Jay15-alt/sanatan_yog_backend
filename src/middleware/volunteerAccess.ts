import { RequestHandler } from 'express';
import { authenticate, roleGuard } from './auth';

export const volunteerManagers: RequestHandler[] = [authenticate, roleGuard('ADMIN', 'SUBADMIN', 'SHAKHA', 'SUBSHAKHA')];
export const volunteerActors: RequestHandler[] = [authenticate, roleGuard('STAFF_VOLUNTEER', 'FIELD_WORKER', 'ADMIN', 'SUBADMIN', 'SHAKHA', 'SUBSHAKHA')];
