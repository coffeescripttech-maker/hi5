-- ============================================================
-- Migration 009: Backup Schedule Configuration
-- Adds auto-backup scheduling columns to school_settings
--
-- Each column is added with an information_schema guard so the
-- migration can be re-run after a partial/manual application.
-- ============================================================

SET @c1 = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'school_settings' AND COLUMN_NAME = 'backup_frequency');
SET @ddl = IF(@c1 = 0,
  'ALTER TABLE school_settings ADD COLUMN backup_frequency ENUM(''daily'',''every_12h'',''weekly'') NOT NULL DEFAULT ''daily'' AFTER current_sy_id',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @c2 = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'school_settings' AND COLUMN_NAME = 'backup_time');
SET @ddl = IF(@c2 = 0,
  'ALTER TABLE school_settings ADD COLUMN backup_time TIME NOT NULL DEFAULT ''02:00:00'' AFTER backup_frequency',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @c3 = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'school_settings' AND COLUMN_NAME = 'backup_retention');
SET @ddl = IF(@c3 = 0,
  'ALTER TABLE school_settings ADD COLUMN backup_retention ENUM(''last_7'',''last_30'',''all'') NOT NULL DEFAULT ''last_30'' AFTER backup_time',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @c4 = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'school_settings' AND COLUMN_NAME = 'backup_enabled');
SET @ddl = IF(@c4 = 0,
  'ALTER TABLE school_settings ADD COLUMN backup_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER backup_retention',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
