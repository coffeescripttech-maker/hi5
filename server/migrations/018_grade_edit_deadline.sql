-- Migration 018: Grade security — configurable grade-edit deadline.
-- Additive & backward-compatible. When grade_deadline_enabled = 1 and the
-- current time passes grade_edit_deadline, teachers lose write access to
-- grades (read-only). The Registrar can still unlock/edit via the existing
-- grade-correct workflow and the unlock endpoint (see grades.routes.ts).

SET @c1 = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'school_settings' AND COLUMN_NAME = 'grade_deadline_enabled');
SET @ddl = IF(@c1 = 0,
  'ALTER TABLE school_settings ADD COLUMN grade_deadline_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER backup_enabled',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c2 = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'school_settings' AND COLUMN_NAME = 'grade_edit_deadline');
SET @ddl2 = IF(@c2 = 0,
  'ALTER TABLE school_settings ADD COLUMN grade_edit_deadline DATETIME NULL AFTER grade_deadline_enabled',
  'SELECT 1');
PREPARE stmt2 FROM @ddl2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;