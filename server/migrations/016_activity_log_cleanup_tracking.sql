-- ============================================================
-- Migration 016: Activity Log Cleanup Tracking
-- Adds last_activity_log_cleanup column to school_settings for tracking cron job execution
-- ============================================================

SET @c1 = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'school_settings' AND COLUMN_NAME = 'last_activity_log_cleanup');
SET @ddl = IF(@c1 = 0,
  'ALTER TABLE school_settings ADD COLUMN last_activity_log_cleanup DATETIME NULL AFTER updated_at',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;