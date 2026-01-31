-- ============================================================
-- CLIENT DOCUMENTATION FLOW — MYSQL DATABASE SCHEMA
-- ============================================================

CREATE DATABASE IF NOT EXISTS client_doc_flow
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE client_doc_flow;

-- ------------------------------------------------------------
-- 1. ROLES  (static seed table)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id          TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        ENUM('ADMIN','SUBADMIN','PEETH','SHAKHA','SUBSHAKHA',
                    'STAFF_VOLUNTEER','FIELD_WORKER','GUEST_VOLUNTEER',
                    'CONTRIBUTOR')
              NOT NULL UNIQUE,
  description VARCHAR(120) DEFAULT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 2. ADMINS  (ADMIN / SUBADMIN — password-based, separate login)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admins (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email           VARCHAR(191) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  name            VARCHAR(120) NOT NULL,
  role            ENUM('ADMIN','SUBADMIN') NOT NULL DEFAULT 'SUBADMIN',
  is_active       TINYINT(1)  NOT NULL DEFAULT 1,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                  ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 3. USERS  (Peeth / Shakha / SubShakha / Volunteers / Contributors
--            — OTP-based login, shared single endpoint)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  unique_id       VARCHAR(40)  NOT NULL UNIQUE,           -- system-generated UID
  email           VARCHAR(191) DEFAULT NULL UNIQUE,
  phone           VARCHAR(20)  DEFAULT NULL,
  otp_hash        VARCHAR(255) DEFAULT NULL,
  otp_expires_at  DATETIME     DEFAULT NULL,
  is_verified     TINYINT(1)   NOT NULL DEFAULT 0,        -- PAN verified flag
  status          ENUM('ACTIVE','INACTIVE','PENDING_PAN','UNVERIFIED')
                  NOT NULL DEFAULT 'UNVERIFIED',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                  ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 4. PEETH  (Division Level)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS peeths (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(100) NOT NULL,
  user_id       INT UNSIGNED NOT NULL,                     -- linked user
  created_by    INT UNSIGNED NOT NULL,                     -- ADMIN / SUBADMIN
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_peeth_user    FOREIGN KEY (user_id)    REFERENCES users (id),
  CONSTRAINT fk_peeth_creator FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 5. SHAKHA  (District Level)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shakhas (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  peeth_id      INT UNSIGNED NOT NULL,
  name          VARCHAR(100) NOT NULL,
  user_id       INT UNSIGNED NOT NULL,
  created_by    INT UNSIGNED NOT NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_shakha_peeth   FOREIGN KEY (peeth_id)   REFERENCES peeths  (id),
  CONSTRAINT fk_shakha_user    FOREIGN KEY (user_id)    REFERENCES users   (id),
  CONSTRAINT fk_shakha_creator FOREIGN KEY (created_by) REFERENCES users   (id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 6. SUB-SHAKHA  (Taluka Level)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sub_shakhas (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  shakha_id     INT UNSIGNED NOT NULL,
  name          VARCHAR(100) NOT NULL,
  user_id       INT UNSIGNED NOT NULL,
  created_by    INT UNSIGNED NOT NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_sub_shakha_shakha   FOREIGN KEY (shakha_id)   REFERENCES shakhas     (id),
  CONSTRAINT fk_sub_shakha_user     FOREIGN KEY (user_id)     REFERENCES users       (id),
  CONSTRAINT fk_sub_shakha_creator  FOREIGN KEY (created_by)  REFERENCES users       (id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 7. TEAMS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  shakha_id       INT UNSIGNED DEFAULT NULL,
  sub_shakha_id   INT UNSIGNED DEFAULT NULL,
  name            VARCHAR(100) NOT NULL,
  created_by      INT UNSIGNED NOT NULL,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_team_shakha     FOREIGN KEY (shakha_id)     REFERENCES shakhas     (id),
  CONSTRAINT fk_team_sub_shakha FOREIGN KEY (sub_shakha_id) REFERENCES sub_shakhas (id),
  CONSTRAINT fk_team_creator    FOREIGN KEY (created_by)    REFERENCES users       (id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 8. VOLUNTEERS  (Staff / Field Worker / Guest)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS volunteers (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         INT UNSIGNED NOT NULL,
  team_id         INT UNSIGNED NOT NULL,
  shakha_id       INT UNSIGNED DEFAULT NULL,              -- managing shakha for Guests
  volunteer_type  ENUM('STAFF','FIELD_WORKER','GUEST') NOT NULL,
  monthly_salary  DECIMAL(12,2) DEFAULT NULL,             -- STAFF only
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_by      INT UNSIGNED NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_vol_user       FOREIGN KEY (user_id)    REFERENCES users   (id),
  CONSTRAINT fk_vol_team       FOREIGN KEY (team_id)    REFERENCES teams   (id),
  CONSTRAINT fk_vol_shakha     FOREIGN KEY (shakha_id)  REFERENCES shakhas (id),
  CONSTRAINT fk_vol_creator    FOREIGN KEY (created_by) REFERENCES users   (id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 9. CONTRIBUTOR TYPES  (admin-extensible categories)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contributor_categories (
  id          SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(60) NOT NULL UNIQUE,
  is_default  TINYINT(1) NOT NULL DEFAULT 0,
  created_by  INT UNSIGNED NOT NULL,                     -- ADMIN user
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_cat_creator FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 10. CONTRIBUTORS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contributors (
  id                    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id               INT UNSIGNED NOT NULL UNIQUE,
  category_id           SMALLINT UNSIGNED NOT NULL,       -- contributor_categories
  pan_number            VARCHAR(12) DEFAULT NULL,
  pan_status            ENUM('NOT_UPLOADED','PENDING','VERIFIED','REJECTED')
                        NOT NULL DEFAULT 'NOT_UPLOADED',
  contributor_type      ENUM('GENERAL','TRUSTEE','GRUHINI') NOT NULL DEFAULT 'GENERAL',
  gender                ENUM('MALE','FEMALE','OTHER') DEFAULT NULL,
  address_line1         VARCHAR(200) DEFAULT NULL,
  address_line2         VARCHAR(200) DEFAULT NULL,
  city                  VARCHAR(100) DEFAULT NULL,
  state                 VARCHAR(100) DEFAULT NULL,
  pincode               VARCHAR(10)  DEFAULT NULL,
  photo_face            VARCHAR(500) DEFAULT NULL,        -- stored path / URL
  photo_full            VARCHAR(500) DEFAULT NULL,
  photo_house           VARCHAR(500) DEFAULT NULL,
  geo_latitude          DECIMAL(10,7) DEFAULT NULL,
  geo_longitude         DECIMAL(11,7) DEFAULT NULL,
  added_by_volunteer    INT UNSIGNED DEFAULT NULL,        -- volunteer who added
  assigned_team_id      INT UNSIGNED DEFAULT NULL,
  is_active             TINYINT(1) NOT NULL DEFAULT 1,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                        ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_contrib_user      FOREIGN KEY (user_id)            REFERENCES users                (id),
  CONSTRAINT fk_contrib_category  FOREIGN KEY (category_id)        REFERENCES contributor_categories (id),
  CONSTRAINT fk_contrib_volunteer FOREIGN KEY (added_by_volunteer) REFERENCES volunteers           (id),
  CONSTRAINT fk_contrib_team      FOREIGN KEY (assigned_team_id)   REFERENCES teams                (id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 11. DONATION TYPES   (reference)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS donation_types (
  id   TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name ENUM('AMOUNT','RICE_GRAIN','CUSTOM') NOT NULL UNIQUE,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 12. DONATIONS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS donations (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  contributor_id    INT UNSIGNED NOT NULL,
  volunteer_id      INT UNSIGNED NOT NULL,
  donation_type_id  TINYINT UNSIGNED NOT NULL,
  amount            DECIMAL(14,2) DEFAULT NULL,           -- monetary amount (or calculated for rice)
  quantity_kg       DECIMAL(10,2) DEFAULT NULL,           -- for RICE_GRAIN
  market_rate       DECIMAL(8,2) DEFAULT NULL,            -- ₹/kg at time of donation
  custom_description TEXT DEFAULT NULL,                   -- for CUSTOM donations
  payment_method    ENUM('CASH','UPI','NEFT','RTGS','BANK_TRANSFER','CHEQUE','ONLINE')
                    DEFAULT NULL,
  receipt_number    VARCHAR(60) DEFAULT NULL UNIQUE,
  is_commission_applicable TINYINT(1) NOT NULL DEFAULT 1,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_don_contributor FOREIGN KEY (contributor_id) REFERENCES contributors    (id),
  CONSTRAINT fk_don_volunteer   FOREIGN KEY (volunteer_id)   REFERENCES volunteers      (id),
  CONSTRAINT fk_don_type        FOREIGN KEY (donation_type_id) REFERENCES donation_types (id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 13. COMMISSION SLABS  (customisable per shakha / global)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commission_slabs (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  shakha_id       INT UNSIGNED DEFAULT NULL,              -- NULL = global default
  min_amount      DECIMAL(14,2) NOT NULL,
  max_amount      DECIMAL(14,2) NOT NULL,
  commission_type ENUM('FIXED','PERCENTAGE') NOT NULL,
  commission_value DECIMAL(10,4) NOT NULL,                -- ₹ amount OR percentage
  applies_to      ENUM('AMOUNT','RICE_GRAIN') NOT NULL DEFAULT 'AMOUNT',
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_by      INT UNSIGNED NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_slab_shakha  FOREIGN KEY (shakha_id)  REFERENCES shakhas (id),
  CONSTRAINT fk_slab_creator FOREIGN KEY (created_by) REFERENCES users   (id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 14. COMMISSIONS  (one row per eligible donation)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commissions (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  donation_id       INT UNSIGNED NOT NULL UNIQUE,
  volunteer_id      INT UNSIGNED NOT NULL,
  slab_id           INT UNSIGNED NOT NULL,
  calculated_amount DECIMAL(14,2) NOT NULL,
  status            ENUM('PENDING','APPROVED','REJECTED','PAID')
                    NOT NULL DEFAULT 'PENDING',
  approved_by       INT UNSIGNED DEFAULT NULL,            -- shakha / subshakha user
  approved_at       DATETIME DEFAULT NULL,
  paid_at           DATETIME DEFAULT NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_comm_donation   FOREIGN KEY (donation_id)  REFERENCES donations    (id),
  CONSTRAINT fk_comm_volunteer  FOREIGN KEY (volunteer_id) REFERENCES volunteers   (id),
  CONSTRAINT fk_comm_slab       FOREIGN KEY (slab_id)      REFERENCES commission_slabs (id),
  CONSTRAINT fk_comm_approver   FOREIGN KEY (approved_by)  REFERENCES users        (id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 15. WORK MANAGEMENT
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS works (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title           VARCHAR(200) NOT NULL,
  description     TEXT DEFAULT NULL,
  status          ENUM('PROPOSED','ONGOING','COMPLETED') NOT NULL DEFAULT 'PROPOSED',
  budget          DECIMAL(14,2) DEFAULT NULL,
  actual_expense  DECIMAL(14,2) DEFAULT NULL,
  shakha_id       INT UNSIGNED DEFAULT NULL,
  sub_shakha_id   INT UNSIGNED DEFAULT NULL,
  created_by      INT UNSIGNED NOT NULL,
  approved_by     INT UNSIGNED DEFAULT NULL,
  started_at      DATETIME DEFAULT NULL,
  completed_at    DATETIME DEFAULT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                  ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_work_shakha     FOREIGN KEY (shakha_id)     REFERENCES shakhas     (id),
  CONSTRAINT fk_work_sub_shakha FOREIGN KEY (sub_shakha_id) REFERENCES sub_shakhas (id),
  CONSTRAINT fk_work_creator    FOREIGN KEY (created_by)    REFERENCES users       (id),
  CONSTRAINT fk_work_approver   FOREIGN KEY (approved_by)   REFERENCES users       (id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 16. WORK EXPENSES  (line items under a work)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS work_expenses (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  work_id     INT UNSIGNED NOT NULL,
  description VARCHAR(200) NOT NULL,
  amount      DECIMAL(14,2) NOT NULL,
  created_by  INT UNSIGNED NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_exp_work    FOREIGN KEY (work_id)    REFERENCES works (id),
  CONSTRAINT fk_exp_creator FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 17. EVENTS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title           VARCHAR(200) NOT NULL,
  description     TEXT DEFAULT NULL,
  category        VARCHAR(80) DEFAULT NULL,
  event_date      DATETIME NOT NULL,
  location        VARCHAR(300) DEFAULT NULL,
  qr_code_token   VARCHAR(100) DEFAULT NULL UNIQUE,       -- used for attendance QR
  created_by      INT UNSIGNED NOT NULL,                   -- must own or be admin/sub
  shakha_id       INT UNSIGNED DEFAULT NULL,
  sub_shakha_id   INT UNSIGNED DEFAULT NULL,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                  ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_event_creator    FOREIGN KEY (created_by)    REFERENCES users       (id),
  CONSTRAINT fk_event_shakha     FOREIGN KEY (shakha_id)     REFERENCES shakhas     (id),
  CONSTRAINT fk_event_sub_shakha FOREIGN KEY (sub_shakha_id) REFERENCES sub_shakhas (id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 18. EVENT PARTICIPANTS  (registration)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_participants (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id    INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NOT NULL,
  role        ENUM('VOLUNTEER','CONTRIBUTOR','GUEST') NOT NULL DEFAULT 'CONTRIBUTOR',
  registered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_event_user (event_id, user_id),
  CONSTRAINT fk_ep_event FOREIGN KEY (event_id) REFERENCES events (id),
  CONSTRAINT fk_ep_user  FOREIGN KEY (user_id)  REFERENCES users  (id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 19. ATTENDANCE  (single-scan, per user per event)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendances (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id    INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NOT NULL,
  scan_time   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status      ENUM('PRESENT','ABSENT') NOT NULL DEFAULT 'PRESENT',
  PRIMARY KEY (id),
  UNIQUE KEY uq_attendance (event_id, user_id),           -- one scan per user per event
  CONSTRAINT fk_att_event FOREIGN KEY (event_id) REFERENCES events (id),
  CONSTRAINT fk_att_user  FOREIGN KEY (user_id)  REFERENCES users  (id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 20. STAFF SALARIES  (monthly pay records)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_salaries (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  volunteer_id  INT UNSIGNED NOT NULL,
  pay_month     DATE NOT NULL,                            -- first day of the pay month
  amount        DECIMAL(12,2) NOT NULL,
  status        ENUM('PENDING','PAID') NOT NULL DEFAULT 'PENDING',
  paid_at       DATETIME DEFAULT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_salary (volunteer_id, pay_month),
  CONSTRAINT fk_sal_volunteer FOREIGN KEY (volunteer_id) REFERENCES volunteers (id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 21. AUDIT LOG
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED DEFAULT NULL,
  action      VARCHAR(80) NOT NULL,
  table_name  VARCHAR(80) NOT NULL,
  record_id   INT UNSIGNED DEFAULT NULL,
  old_data    JSON DEFAULT NULL,
  new_data    JSON DEFAULT NULL,
  ip_address  VARCHAR(45) DEFAULT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_audit_user (user_id),
  INDEX idx_audit_table (table_name, created_at)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 22. USER-ROLE MAPPING  (polymorphic: user can hold one org role)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_roles (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  role_id     TINYINT UNSIGNED NOT NULL,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_role (user_id, role_id),
  CONSTRAINT fk_ur_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_ur_role FOREIGN KEY (role_id) REFERENCES roles (id)
) ENGINE=InnoDB;

-- ============================================================
-- SEED: ROLES
-- ============================================================
INSERT INTO roles (name, description) VALUES
  ('ADMIN',            'Root-level full access'),
  ('SUBADMIN',         'Full access except SubAdmin management'),
  ('PEETH',            'Division-level manager'),
  ('SHAKHA',           'District-level manager'),
  ('SUBSHAKHA',        'Taluka-level manager'),
  ('STAFF_VOLUNTEER',  'Salaried volunteer'),
  ('FIELD_WORKER',     'Commission-based volunteer'),
  ('GUEST_VOLUNTEER',  'Event-based / training volunteer'),
  ('CONTRIBUTOR',      'Donor / supporter');

-- ============================================================
-- SEED: DONATION TYPES
-- ============================================================
INSERT INTO donation_types (name) VALUES
  ('AMOUNT'), ('RICE_GRAIN'), ('CUSTOM');

-- ============================================================
-- SEED: DEFAULT CONTRIBUTOR CATEGORIES
-- (admin can add more via contributor_categories)
-- ============================================================
-- placeholder – will be inserted by application bootstrap

-- ============================================================
-- SEED: DEFAULT GLOBAL COMMISSION SLABS
-- ============================================================
-- These match the doc's default Field-Worker slab table.
-- shakha_id = NULL  →  global defaults.
-- Requires a bootstrap admin user (id = 1) to exist first;
-- application startup script should run this after seeding admin.
-- INSERT INTO commission_slabs …  (handled by app seed script)

-- ============================================================
-- INDEXES  (performance helpers)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_donations_contributor ON donations (contributor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_donations_volunteer   ON donations (volunteer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_commissions_vol       ON commissions (volunteer_id, status);
CREATE INDEX IF NOT EXISTS idx_contributors_type     ON contributors (contributor_type, is_active);
CREATE INDEX IF NOT EXISTS idx_contributors_address  ON contributors (pincode, address_line1);
CREATE INDEX IF NOT EXISTS idx_works_status          ON works (status, created_at);
CREATE INDEX IF NOT EXISTS idx_events_date           ON events (event_date);
CREATE INDEX IF NOT EXISTS idx_attendances_event     ON attendances (event_id);
