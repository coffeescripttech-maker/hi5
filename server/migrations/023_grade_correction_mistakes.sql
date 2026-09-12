-- ============================================================
-- Migration 023: Grade-correction common mistakes
-- Adds common_mistake (preset dropdown reason, VARCHAR 80 NULL)
-- and other_mistake (free text used when preset is "Other") to
-- grade_correction_requests so teachers can flag the typical
-- cause of a requested correction. Both remain optional.
-- ============================================================

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'grade_correction_requests' AND COLUMN_NAME = 'common_mistake');
SET @ddl = IF(@col_exists = 0,
  'ALTER TABLE grade_correction_requests ADD COLUMN common_mistake VARCHAR(80) NULL AFTER justification',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'grade_correction_requests' AND COLUMN_NAME = 'other_mistake');
SET @ddl = IF(@col_exists = 0,
  'ALTER TABLE grade_correction_requests ADD COLUMN other_mistake TEXT NULL AFTER common_mistake',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
