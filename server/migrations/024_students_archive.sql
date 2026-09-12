-- ============================================================
-- Migration 024: Student soft-archive
-- Adds is_archived (TINYINT, default 0) and archived_at (DATETIME
-- NULL) to students so graduated records can be flagged as archived
-- without deleting any historical data. The controller sets both when
-- a student's status becomes 'graduated'.
-- ============================================================

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students' AND COLUMN_NAME = 'is_archived');
SET @ddl = IF(@col_exists = 0,
  'ALTER TABLE students ADD COLUMN is_archived TINYINT(1) NOT NULL DEFAULT 0 AFTER status',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students' AND COLUMN_NAME = 'archived_at');
SET @ddl = IF(@col_exists = 0,
  'ALTER TABLE students ADD COLUMN archived_at DATETIME NULL AFTER is_archived',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
