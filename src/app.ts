// =============================================================
// src/app.ts   — Application configuration
// =============================================================

import express from 'express';
import dotenv from 'dotenv';
import { attachIp } from './middleware/auth';

// Controllers (these should be route files with default exports)
import authController       from './controllers/authController';
import donationController   from './controllers/donationController';
import commissionController from './controllers/commissionController';
import workController        from './controllers/workController';
// REMOVE THIS LINE: import eventController from './controllers/eventController';
import categoryController   from './controllers/categoryController';

// Routes
import adminRoutes           from './routes/adminRoutes';
import subadminRoutes        from './routes/subadminRoutes';
import commonRoutes          from './routes/commonRoutes';
import volunteerRoutes       from './routes/volunteerRoutes';
import contributorRoutes     from './routes/contributorRoutes';

dotenv.config();

const app = express();

// ─── Global middleware ──────────────────────────────────────
app.use(express.json());
app.use(attachIp);

// ─── Health check ───────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─── Route mounting ─────────────────────────────────────────
app.use('/auth',         authController);
app.use('/volunteer',    volunteerRoutes);
app.use('/contributor',  contributorRoutes);
app.use('/donations',    donationController);
app.use('/commissions',  commissionController);
app.use('/works',        workController);
// REMOVE THIS LINE: app.use('/events', eventController);
app.use('/categories',   categoryController);
app.use('/admin',        adminRoutes);
app.use('/subadmin',     subadminRoutes);
app.use('/common',       commonRoutes);

// ─── 404 catch-all ──────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found.', statusCode: 404 });
});

// ─── Global error handler ───────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[ERROR]', err);
  res.status(500).json({ success: false, error: 'Internal server error.', statusCode: 500 });
});

export default app;