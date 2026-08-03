-- ============================================================
-- Migration 009: Backup Schedule Configuration
-- Adds auto-backup scheduling columns to school_settings
-- ============================================================

ALTER TABLE school_settings
  ADD COLUMN backup_frequency ENUM('daily','every_12h','weekly') NOT NULL DEFAULT 'daily' AFTER current_sy_id,
  ADD COLUMN backup_time TIME NOT NULL DEFAULT '02:00:00' AFTER backup_frequency,
  ADD COLUMN backup_retention ENUM('last_7','last_30','all') NOT NULL DEFAULT 'last_30' AFTER backup_time,
  ADD COLUMN backup_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER backup_retention;
