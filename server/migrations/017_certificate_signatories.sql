-- ============================================================
-- Migration 017: Certificate signatories
--
-- Adds School Principal + Registrar names to school_settings so
-- the Certificate of Enrollment / Good Moral certificates can
-- print dynamic signatories instead of a static title only.
-- ============================================================

ALTER TABLE school_settings
  ADD COLUMN principal_name VARCHAR(255) NOT NULL DEFAULT '' AFTER district,
  ADD COLUMN registrar_name VARCHAR(255) NOT NULL DEFAULT '' AFTER principal_name;
