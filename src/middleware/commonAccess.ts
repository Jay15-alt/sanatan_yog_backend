import { RequestHandler } from 'express';
import { authenticate, roleGuard } from './auth';

export const orgManagers: RequestHandler[] = [authenticate, roleGuard('ADMIN', 'SUBADMIN', 'PEETH', 'SHAKHA', 'SUBSHAKHA')];
