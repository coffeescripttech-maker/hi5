-- ============================================================
-- Migration 028: Activity Log Retention Configuration
-- Makes the activity log cleanup schedule configurable from the
-- admin UI instead of being hard-coded in the cron:
--   activity_log_cleanup_enabled  — 1 = cleanup cron runs (default)
--   activity_log_retention_days   — how many days of history to keep
-- Columns are added with information_schema guards so the
-- migration can be re-run safely.
-- ============================================================

SET @c1 = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'school_settings' AND COLUMN_NAME = 'activity_log_cleanup_enabled');
SET @ddl = IF(@c1 = 0,
  'ALTER TABLE school_settings ADD COLUMN activity_log_cleanup_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER last_activity_log_cleanup',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @c2 = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'school_settings' AND COLUMN_NAME = 'activity_log_retention_days');
SET @ddl = IF(@c2 = 0,
  'ALTER TABLE school_settings ADD COLUMN activity_log_retention_days INT NOT NULL DEFAULT 90 AFTER activity_log_cleanup_enabled',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;