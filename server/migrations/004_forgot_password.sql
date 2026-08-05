-- ============================================================
-- Migration 004: Password Reset Support
-- Adds token + expiry columns to users for forgot-password flow
-- ============================================================

ALTER TABLE users
  ADD COLUMN password_reset_token VARCHAR(64) NULL AFTER locked_until,
  ADD COLUMN password_reset_expires DATETIME NULL AFTER password_reset_token;
