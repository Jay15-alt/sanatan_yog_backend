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
import {
  createEvent,
  listEvents,
  getEvent,
  updateEvent,
  deactivateEvent,
  registerParticipant,
  getEventParticipants,
  markAttendance,
  getUserAttendanceHistory,
  getEventAttendanceReport,
} from '../controllers/eventController';
import {
  createPeeth,
  listPeeths,
  getPeeth,
  getPeethByCode,
  updatePeeth,
  deactivatePeeth,
  activatePeeth,
  getPeethShakhas,
  getPeethStatistics,
  getPeethContributorsSummary,
} from '../controllers/peethController';

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

// ─── Peeth Management (Division Level) ──────────────────────────────────────

// CRUD Operations
router.post  ('/peeths',                   authenticate, roleGuard('ADMIN', 'SUBADMIN'), createPeeth);
router.get   ('/peeths',                   authenticate, roleGuard('ADMIN', 'SUBADMIN'), listPeeths);
router.get   ('/peeths/:id',               authenticate, roleGuard('ADMIN', 'SUBADMIN'), getPeeth);
router.get   ('/peeths/code/:code',        authenticate, roleGuard('ADMIN', 'SUBADMIN'), getPeethByCode);
router.put   ('/peeths/:id',               authenticate, roleGuard('ADMIN', 'SUBADMIN'), updatePeeth);
router.put   ('/peeths/:id/deactivate',    authenticate, roleGuard('ADMIN', 'SUBADMIN'), deactivatePeeth);
router.put   ('/peeths/:id/activate',      authenticate, roleGuard('ADMIN', 'SUBADMIN'), activatePeeth);

// Hierarchical Data
router.get   ('/peeths/:id/shakhas',       authenticate, roleGuard('ADMIN', 'SUBADMIN'), getPeethShakhas);

// Analytics & Reports
router.get   ('/peeths/:id/statistics',    authenticate, roleGuard('ADMIN', 'SUBADMIN'), getPeethStatistics);
router.get   ('/peeths/:id/contributors',  authenticate, roleGuard('ADMIN', 'SUBADMIN'), getPeethContributorsSummary);

// ─── Contributor Management ─────────────────────────────────────────────────

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

// ─── Event Management ───────────────────────────────────────────────────────

// Events CRUD
router.post  ('/events',                    authenticate, roleGuard('ADMIN', 'SUBADMIN'), createEvent);
router.get   ('/events',                    authenticate, listEvents);
router.get   ('/events/:id',                authenticate, getEvent);
router.put   ('/events/:id',                authenticate, roleGuard('ADMIN', 'SUBADMIN'), updateEvent);
router.delete('/events/:id',                authenticate, roleGuard('ADMIN', 'SUBADMIN'), deactivateEvent);

// Event Participants
router.post  ('/events/:id/participants',   authenticate, registerParticipant);
router.get   ('/events/:id/participants',   authenticate, getEventParticipants);

// Attendance
router.post  ('/events/attendance/scan',              authenticate, markAttendance);
router.get   ('/events/attendance/user/:userId',      authenticate, getUserAttendanceHistory);

// Reports
router.get   ('/events/:id/report',         authenticate, roleGuard('ADMIN', 'SUBADMIN'), getEventAttendanceReport);

export default router;