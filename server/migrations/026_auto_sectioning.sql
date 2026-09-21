-- ============================================================
-- Migration 026: Auto-Sectioning — STE/SPFL Admission Evidence
-- Records whether an STE/SPFL applicant passed the entrance
-- examination and interview, plus their exam score.
-- NULL = not yet assessed (treated as NOT eligible by the rules engine).
-- ============================================================

SET @c1 = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'enrollments' AND COLUMN_NAME = 'entrance_exam_grade');
SET @ddl = IF(@c1 = 0,
  'ALTER TABLE enrollments ADD COLUMN entrance_exam_grade DECIMAL(5,2) NULL AFTER program',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @c2 = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'enrollments' AND COLUMN_NAME = 'entrance_exam_passed');
SET @ddl = IF(@c2 = 0,
  'ALTER TABLE enrollments ADD COLUMN entrance_exam_passed TINYINT(1) NULL AFTER entrance_exam_grade',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @c3 = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'enrollments' AND COLUMN_NAME = 'interview_passed');
SET @ddl = IF(@c3 = 0,
  'ALTER TABLE enrollments ADD COLUMN interview_passed TINYINT(1) NULL AFTER entrance_exam_passed',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;