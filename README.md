# Client Documentation Flow — Backend API

## Tech Stack
| Layer | Tool |
|---|---|
| Runtime | Node.js + TypeScript |
| Framework | Express.js |
| Database | MySQL 8 (via `mysql2`) |
| Auth (stub) | Header-based dev stub → swap for JWT |
| IDs | UUID v4 |

---

## Project Layout

```
project/
├── database/
│   ├── schema.sql          ← Full MySQL schema (run first)
│   └── seed.sql            ← Default commission slabs & categories
├── src/
│   ├── app.ts              ← Express bootstrap & route mounting
│   ├── types/index.ts      ← ALL interfaces (row types + DTOs)
│   ├── config/
│   │   └── database.ts     ← mysql2 connection pool
│   ├── middleware/
│   │   └── auth.ts         ← authenticate, roleGuard, audit logger
│   ├── utils/
│   │   ├── helpers.ts      ← UUID, OTP, receipt generators
│   │   └── response.ts     ← ApiError class + sendSuccess/sendError
│   ├── services/           ← Business logic (no HTTP knowledge)
│   │   ├── userService.ts
│   │   ├── organizationService.ts
│   │   ├── volunteerService.ts
│   │   ├── contributorService.ts
│   │   ├── donationService.ts
│   │   ├── commissionService.ts
│   │   ├── workService.ts
│   │   └── eventService.ts
│   └── controllers/        ← Thin HTTP layer (route handlers)
│       ├── authController.ts
│       ├── organizationController.ts
│       ├── volunteerController.ts
│       ├── contributorController.ts
│       ├── donationController.ts
│       ├── commissionController.ts
│       ├── workController.ts
│       ├── eventController.ts
│       └── categoryController.ts
├── package.json
├── tsconfig.json
└── .env.example
```

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env and fill in your MySQL credentials
cp .env.example .env

# 3. Create the database & run schema + seed (in MySQL client)
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql

# 4. Run in dev mode (ts-node, no build needed)
npm run dev
```

---

## API Route Map

| Method | Path | Auth Role | Description |
|--------|------|-----------|-------------|
| POST | `/auth/otp/request` | — | Request OTP (creates user if new) |
| POST | `/auth/otp/verify` | — | Verify OTP → login |
| POST | `/org/peeth` | ADMIN, SUBADMIN | Create Peeth |
| GET | `/org/peeth` | any | List all Peeths |
| GET | `/org/peeth/:id` | any | Get Peeth |
| DELETE | `/org/peeth/:id` | ADMIN, SUBADMIN | Deactivate Peeth |
| POST | `/org/shakha` | ADMIN, SUBADMIN, PEETH | Create Shakha |
| GET | `/org/shakha?peeth_id=X` | any | Shakhas under a Peeth |
| GET | `/org/shakha/:id` | any | Get Shakha |
| DELETE | `/org/shakha/:id` | ADMIN, SUBADMIN, PEETH | Deactivate |
| POST | `/org/sub-shakha` | ADMIN, SUBADMIN, SHAKHA | Create SubShakha |
| GET | `/org/sub-shakha?shakha_id=X` | any | SubShakhas under Shakha |
| GET | `/org/sub-shakha/:id` | any | Get SubShakha |
| DELETE | `/org/sub-shakha/:id` | ADMIN, SUBADMIN, SHAKHA | Deactivate |
| POST | `/org/team` | ADMIN, SUBADMIN, SHAKHA, SUBSHAKHA | Create Team |
| GET | `/org/team/:id` | any | Get Team |
| DELETE | `/org/team/:id` | ADMIN, SUBADMIN, SHAKHA, SUBSHAKHA | Deactivate |
| POST | `/volunteers` | ADMIN, SUBADMIN, SHAKHA, SUBSHAKHA | Add volunteer |
| GET | `/volunteers/:id` | any | Get volunteer |
| GET | `/volunteers/team/:teamId` | any | Volunteers in a team |
| DELETE | `/volunteers/:id` | ADMIN, SUBADMIN, SHAKHA, SUBSHAKHA | Deactivate |
| POST | `/volunteers/:id/salary` | ADMIN, SUBADMIN | Create salary record |
| GET | `/volunteers/:id/salary` | any | List salary records |
| PUT | `/volunteers/salary/:salaryId/pay` | ADMIN, SUBADMIN | Mark salary paid |
| POST | `/contributors/add` | STAFF_VOLUNTEER, FIELD_WORKER, … | Add contributor (Step 1) |
| POST | `/contributors/:id/pan` | any auth | Upload PAN (Step 2) |
| PUT | `/contributors/:id/pan/verify` | STAFF_VOLUNTEER, SHAKHA, … | Approve/reject PAN |
| PUT | `/contributors/:id/upgrade` | SHAKHA, ADMIN, SUBADMIN | Upgrade to Trustee/Gruhini |
| PUT | `/contributors/:id/reassign` | SHAKHA, ADMIN, SUBADMIN | Move to new team |
| GET | `/contributors/:id` | any | Get contributor |
| GET | `/contributors/:id/donations` | any | Contributor's donation history |
| GET | `/contributors/team/:teamId` | any | Contributors in a team |
| DELETE | `/contributors/:id` | SHAKHA, ADMIN, SUBADMIN | Deactivate |
| POST | `/donations` | STAFF_VOLUNTEER, FIELD_WORKER, … | Record donation |
| GET | `/donations/:id` | any | Get donation |
| GET | `/donations/contributor/:cId` | any | Donations by contributor |
| GET | `/donations/volunteer/:vId` | any | Donations by volunteer |
| POST | `/commissions/slabs` | ADMIN, SUBADMIN, SHAKHA | Create commission slab |
| GET | `/commissions/slabs` | any | List slabs (optional ?shakha_id) |
| GET | `/commissions/:id` | any | Get commission |
| GET | `/commissions/volunteer/:vId` | any | Commissions for a volunteer |
| PUT | `/commissions/:id/approve` | SHAKHA, SUBSHAKHA, … | Approve commission |
| PUT | `/commissions/:id/reject` | SHAKHA, SUBSHAKHA, … | Reject commission |
| PUT | `/commissions/:id/pay` | ADMIN, SUBADMIN | Mark commission paid |
| POST | `/works` | ADMIN, SUBADMIN, PEETH, SHAKHA | Create work (Proposed) |
| GET | `/works` | any | List works (?status filter) |
| GET | `/works/:id` | any | Get work |
| PUT | `/works/:id` | ADMIN, SUBADMIN, PEETH, SHAKHA | Update / transition status |
| POST | `/works/:id/expenses` | ADMIN, SUBADMIN, PEETH, SHAKHA | Add expense line |
| GET | `/works/:id/expenses` | any | List expenses |
| POST | `/events` | ADMIN, SUBADMIN, PEETH, SHAKHA, SUBSHAKHA | Create event |
| GET | `/events` | any | List active events |
| GET | `/events/:id` | any | Get event |
| PUT | `/events/:id` | creator or ADMIN/SUBADMIN | Edit event |
| DELETE | `/events/:id` | ADMIN, SUBADMIN | Deactivate event |
| POST | `/events/:id/participants` | any auth | Register for event |
| GET | `/events/:id/participants` | any | Participants list |
| POST | `/events/attendance/scan` | any auth | Scan QR → mark present |
| GET | `/events/attendance/user/:uId` | any | User's attendance history |
| GET | `/events/:id/report` | any | Full event attendance report |
| POST | `/categories` | ADMIN | Add custom contributor category |
| GET | `/categories` | any | List all categories |

---

## Dev-Mode Auth

During development the server reads three headers instead of a JWT:

```
X-User-Id:   1
X-User-Role: ADMIN
X-Unique-Id: <uuid>
```

Replace the `authenticate` function in `src/middleware/auth.ts` with real JWT verification before deploying.

---

## Key Design Decisions

1. **All interfaces live in `src/types/index.ts`** — single source of truth; row types mirror columns 1:1, DTOs are kept beside them.
2. **Services are stateless static classes** — easy to unit-test, no DI container needed at this scale.
3. **Commission auto-calculation** fires synchronously inside `DonationService.create()`. For high-throughput you can move it to a queue.
4. **Gruhini one-per-family** is enforced at the DB query level (matching pincode + address_line1).
5. **Audit logs** are fire-and-forget; failures are logged to console but never break the main flow.
6. **Soft deletes** (`is_active = 0`) are used throughout to preserve referential integrity.
