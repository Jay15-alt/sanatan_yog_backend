import { RequestHandler } from 'express';
import { authenticate, roleGuard } from './auth';

export const contributorActors: RequestHandler[] = [authenticate];
export const panVerifiers: RequestHandler[] = [authenticate, roleGuard('STAFF_VOLUNTEER', 'FIELD_WORKER', 'ADMIN', 'SUBADMIN', 'SHAKHA')];
