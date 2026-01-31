# Sanatan_Yog — Backend API

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
