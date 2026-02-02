import { RequestHandler } from 'express';
import { authenticate, roleGuard } from './auth';

export const adminOnly: RequestHandler[] = [authenticate, roleGuard('ADMIN')];
export const adminOrSubadmin: RequestHandler[] = [authenticate, roleGuard('ADMIN', 'SUBADMIN')];
