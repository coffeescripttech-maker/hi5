-- ============================================================
-- Migration 007: Pending Section Queue
-- Makes section_id nullable so enrollments can sit in the
-- Pending Section Queue until the Registrar assigns a section.
-- Adds tracking columns for who assigned the section and when.
-- ============================================================

-- 1. Make section_id nullable
ALTER TABLE enrollments
  MODIFY COLUMN section_id INT NULL;

-- 2. Drop auto-generated FK on section_id and re-add with SET NULL
--    (MySQL auto-names enforcements_ibfk_2 for the second FK)
ALTER TABLE enrollments
  DROP FOREIGN KEY enrollments_ibfk_2;

ALTER TABLE enrollments
  ADD CONSTRAINT enrollments_section_fk
  FOREIGN KEY (section_id) REFERENCES sections(id)
  ON DELETE SET NULL;

-- 3. Add tracking columns for Registrar assignment
ALTER TABLE enrollments
  ADD COLUMN assigned_at DATETIME NULL
  AFTER section_id;

ALTER TABLE enrollments
  ADD COLUMN assigned_by INT NULL
  AFTER assigned_at;

ALTER TABLE enrollments
  ADD CONSTRAINT enrollments_assigned_by_fk
  FOREIGN KEY (assigned_by) REFERENCES users(id)
  ON DELETE SET NULL;
