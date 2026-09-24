-- Migration 035: Configurable academic thresholds.
-- Adds the school-configurable passing mark (promotion/retention, LIS & SF5,
-- at-risk classification) and the monitoring threshold used by the at-risk
-- model. Additive & backward-compatible — defaults preserve the current
-- DepEd-standard behavior (passing = 75, monitoring = 80).

SET @c1 = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'school_settings' AND COLUMN_NAME = 'passing_grade');
SET @ddl1 = IF(@c1 = 0,
  'ALTER TABLE school_settings ADD COLUMN passing_grade DECIMAL(5,2) NOT NULL DEFAULT 75.00 AFTER grade_edit_deadline',
  'SELECT 1');
PREPARE stmt1 FROM @ddl1; EXECUTE stmt1; DEALLOCATE PREPARE stmt1;

SET @c2 = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'school_settings' AND COLUMN_NAME = 'monitor_threshold');
SET @ddl2 = IF(@c2 = 0,
  'ALTER TABLE school_settings ADD COLUMN monitor_threshold DECIMAL(5,2) NOT NULL DEFAULT 80.00 AFTER passing_grade',
  'SELECT 1');
PREPARE stmt2 FROM @ddl2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;