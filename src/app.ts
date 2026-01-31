// =============================================================
// src/app.ts   — Application entry-point
// =============================================================

import express from 'express';
import dotenv from 'dotenv';
import { attachIp } from './middleware/auth';

// Controllers
import authController       from './controllers/authController';
import organizationController from './controllers/organizationController';
import volunteerController  from './controllers/volunteerController';
import contributorController from './controllers/contributorController';
import donationController   from './controllers/donationController';
import commissionController from './controllers/commissionController';
import workController        from './controllers/workController';
import eventController       from './controllers/eventController';
import categoryController   from './controllers/categoryController';

dotenv.config();

const app  = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ─── Global middleware ──────────────────────────────────────
app.use(express.json());
app.use(attachIp);

// ─── Health check ───────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─── Route mounting ─────────────────────────────────────────
app.use('/auth',         authController);
app.use('/org',          organizationController);
app.use('/volunteers',   volunteerController);
app.use('/contributors', contributorController);
app.use('/donations',    donationController);
app.use('/commissions',  commissionController);
app.use('/works',        workController);
app.use('/events',       eventController);
app.use('/categories',   categoryController);

// ─── 404 catch-all ──────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found.', statusCode: 404 });
});

// ─── Global error handler ───────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[ERROR]', err);
  res.status(500).json({ success: false, error: 'Internal server error.', statusCode: 500 });
});

// ─── Start ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[SERVER] Client Doc Flow API running on http://localhost:${PORT}`);
});

export default app;
