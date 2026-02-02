import { Router } from 'express';
import { authenticate, roleGuard } from '../middleware/auth';
import {
  registerAdmin,
  loginAdmin,
  listAdmins,
  deactivateAdmin,
  activateAdmin,
  createSubAdmin,
  listSubAdmins,
  deactivateSubAdmin,
  activateSubAdmin,
  updateSubAdminRole,
  payCommission,
} from '../controllers/adminController';
import {
  // existing handlers reused under the admin prefix
  addContributor,
  listByTeam,
  getContributor,
  getContributorDonations,
  uploadPan,
  verifyPan,
  upgradeContributor,
  reassignContributor,
  deactivateContributor,
  // new admin-only handlers
  listAllContributors,
  activateContributor,
} from '../controllers/contributorController';

const router = Router();

// ─── Auth ───────────────────────────────────────────────────────────────────
router.post('/login',    loginAdmin);                                          // public
router.post('/register', registerAdmin);                                       // public

// ─── Admin management ───────────────────────────────────────────────────────
router.get   ('/admins',                   authenticate, roleGuard('ADMIN'), listAdmins);
router.put   ('/admins/:id/deactivate',    authenticate, roleGuard('ADMIN'), deactivateAdmin);
router.put   ('/admins/:id/activate',      authenticate, roleGuard('ADMIN'), activateAdmin);

// ─── Sub-admin management ───────────────────────────────────────────────────
router.post  ('/subadmins',                authenticate, roleGuard('ADMIN'), createSubAdmin);
router.get   ('/subadmins',                authenticate, roleGuard('ADMIN'), listSubAdmins);
router.put   ('/subadmins/:id/deactivate', authenticate, roleGuard('ADMIN'), deactivateSubAdmin);
router.put   ('/subadmins/:id/activate',   authenticate, roleGuard('ADMIN'), activateSubAdmin);
router.put   ('/subadmins/:id/role',       authenticate, roleGuard('ADMIN'), updateSubAdminRole);

// ─── Commissions ────────────────────────────────────────────────────────────
router.put   ('/commissions/:id/pay',      authenticate, roleGuard('ADMIN', 'SUBADMIN'), payCommission);


// List all contributors (filterable via query string — see handler)
router.get   ('/contributors',                          authenticate, roleGuard('ADMIN'), listAllContributors);

// List contributors scoped to a single team
router.get   ('/contributors/team/:teamId',             authenticate, roleGuard('ADMIN'), listByTeam);

// Add a new contributor on behalf of a volunteer or directly
router.post  ('/contributors/add',                      authenticate, roleGuard('ADMIN'), addContributor);

// ── Single-contributor operations (all keyed on :id) ──────────────────────

// Read
router.get   ('/contributors/:id',                      authenticate, roleGuard('ADMIN'), getContributor);
router.get   ('/contributors/:id/donations',            authenticate, roleGuard('ADMIN'), getContributorDonations);

// PAN lifecycle
router.post  ('/contributors/:id/pan',                  authenticate, roleGuard('ADMIN'), uploadPan);
router.put   ('/contributors/:id/pan/verify',           authenticate, roleGuard('ADMIN'), verifyPan);

// Type upgrade
router.put   ('/contributors/:id/upgrade',              authenticate, roleGuard('ADMIN'), upgradeContributor);

// Team reassignment
router.put   ('/contributors/:id/reassign',             authenticate, roleGuard('ADMIN'), reassignContributor);

// Activate / deactivate
router.put   ('/contributors/:id/activate',             authenticate, roleGuard('ADMIN'), activateContributor);
router.delete('/contributors/:id',                      authenticate, roleGuard('ADMIN'), deactivateContributor);

export default router;