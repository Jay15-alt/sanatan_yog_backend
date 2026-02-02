import { RequestHandler } from 'express';
import { authenticate, roleGuard } from './auth';

export const subadminOnly: RequestHandler[] = [authenticate, roleGuard('SUBADMIN')];
export const subadminOrAdmin: RequestHandler[] = [authenticate, roleGuard('SUBADMIN', 'ADMIN')];
