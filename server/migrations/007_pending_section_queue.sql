-- ============================================================
-- Migration 007: Pending Section Queue
-- Makes section_id nullable so enrollments can sit in the
-- Pending Section Queue until the Registrar assigns a section.
-- Adds tracking columns for who assigned the section and when.
--
-- Every ALTER is guarded with an information_schema check so the
-- migration can be re-run after a partial/manual application.
-- ============================================================

-- 1. Drop the legacy auto-named FK on section_id if it still exists
--    (must be dropped BEFORE changing nullability in MySQL 8)
SET @old_fk = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'enrollments'
    AND CONSTRAINT_NAME = 'enrollments_ibfk_2' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @ddl = IF(@old_fk > 0,
  'ALTER TABLE enrollments DROP FOREIGN KEY enrollments_ibfk_2',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Make section_id nullable
ALTER TABLE enrollments
  MODIFY COLUMN section_id INT NULL;

-- 3. Re-add section FK with ON DELETE SET NULL (if not already present)
SET @new_fk = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'enrollments'
    AND CONSTRAINT_NAME = 'enrollments_section_fk' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @ddl = IF(@new_fk = 0,
  'ALTER TABLE enrollments ADD CONSTRAINT enrollments_section_fk FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Add tracking columns for Registrar assignment
SET @c1 = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'enrollments' AND COLUMN_NAME = 'assigned_at');
SET @ddl = IF(@c1 = 0,
  'ALTER TABLE enrollments ADD COLUMN assigned_at DATETIME NULL AFTER section_id',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @c2 = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'enrollments' AND COLUMN_NAME = 'assigned_by');
SET @ddl = IF(@c2 = 0,
  'ALTER TABLE enrollments ADD COLUMN assigned_by INT NULL AFTER assigned_at',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5. Add assigned_by FK
SET @fk2 = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'enrollments'
    AND CONSTRAINT_NAME = 'enrollments_assigned_by_fk' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @ddl = IF(@fk2 = 0,
  'ALTER TABLE enrollments ADD CONSTRAINT enrollments_assigned_by_fk FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
