import { Router, Request, Response } from 'express';
import { authenticate, roleGuard, resolveActorId, writeAuditLog } from '../middleware/auth';
import { AdminService } from '../services/adminService';
import { CommissionService } from '../services/commissionService';
import { sendSuccess, sendError, ApiError } from '../utils/response';

const router = Router();

function mintToken(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

router.post('/login', async (req: Request, res: Response) => {
  try {
    const admin = await AdminService.login(req.body);
    const payload = { source: 'ADMIN', admin_id: admin.id, role: admin.role };
    const token = mintToken(payload);
    sendSuccess(res, { token, admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role } }, 200, 'Login successful.');
  } catch (err) {
    if (err instanceof ApiError) return sendError(res, err.message, err.statusCode);
    sendError(res, 'Internal error.', 500);
  }
});

router.put('/commissions/:id/pay', authenticate, roleGuard('SUBADMIN', 'ADMIN'), async (req: Request, res: Response) => {
  try {
    const comm = await CommissionService.markPaid(parseInt(req.params.id, 10));
    await writeAuditLog(resolveActorId(req.user!), 'COMMISSION_PAID', 'commissions', comm.id, req.ipAddress ?? null);
    sendSuccess(res, comm, 200, 'Commission paid.');
  } catch (err) {
    if (err instanceof ApiError) return sendError(res, err.message, err.statusCode);
    sendError(res, 'Internal error.', 500);
  }
});

export default router;
