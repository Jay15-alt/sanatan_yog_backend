-- ============================================================
-- SEED DATA  —  run AFTER schema.sql
-- ============================================================

USE client_doc_flow;

-- ------------------------------------------------------------
-- Bootstrap ADMIN  (password: "admin123" — change immediately)
-- The hash below is bcrypt of "admin123" with cost 10.
-- ------------------------------------------------------------
INSERT INTO admins (email, password_hash, name, role, is_active) VALUES
  ('admin@yourdomain.com',
   '$2a$10$XvKMKMq4FQSvhRnBOkEZ7eaRNi5yMYMJsEmEDn0BNaWQkXyMOPNnq',
   'System Admin',
   'ADMIN',
   1);

-- ------------------------------------------------------------
-- Default Contributor Categories
-- ------------------------------------------------------------
INSERT INTO contributor_categories (name, is_default, created_by) VALUES
  ('General',  1, 1),
  ('Trustee',  0, 1),
  ('Gruhini',  0, 1);

-- ------------------------------------------------------------
-- Default Global Commission Slabs  (Field Workers)
-- shakha_id = NULL  →  applies everywhere unless overridden
-- Matches the documentation table exactly.
-- ------------------------------------------------------------
INSERT INTO commission_slabs
  (shakha_id, min_amount, max_amount, commission_type, commission_value, applies_to, is_active, created_by)
VALUES
  (NULL,  10.00,      100.00,     'FIXED',      5.0000,  'AMOUNT',     1, 1),  -- ₹5 fixed
  (NULL,  100.01,    1000.00,     'FIXED',     10.0000,  'AMOUNT',     1, 1),  -- ₹10 fixed
  (NULL, 1001.00,    5000.00,     'PERCENTAGE', 5.0000,  'AMOUNT',     1, 1),  -- 5 %
  (NULL, 5001.00,  100000.00,     'PERCENTAGE', 5.0000,  'AMOUNT',     1, 1),  -- 5 %
  (NULL,100001.00,1000000.00,     'PERCENTAGE', 4.0000,  'AMOUNT',     1, 1),  -- 4 %
  -- Rice / Grain slabs mirror the same structure on calculated monetary value
  (NULL,  10.00,      100.00,     'FIXED',      5.0000,  'RICE_GRAIN', 1, 1),
  (NULL,  100.01,    1000.00,     'FIXED',     10.0000,  'RICE_GRAIN', 1, 1),
  (NULL, 1001.00,    5000.00,     'PERCENTAGE', 5.0000,  'RICE_GRAIN', 1, 1),
  (NULL, 5001.00,  100000.00,     'PERCENTAGE', 5.0000,  'RICE_GRAIN', 1, 1),
  (NULL,100001.00,1000000.00,     'PERCENTAGE', 4.0000,  'RICE_GRAIN', 1, 1);
