-- ============================================================
-- Migration 014: Document → Subject link
-- Adds subject_id + school_year_id to uploaded_documents so
-- grade-submission tracking can report per-subject × per-section
-- status and the import can resolve the section's roster for the
-- correct school year.
-- ============================================================

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'uploaded_documents' AND COLUMN_NAME = 'subject_id');
SET @ddl = IF(@col_exists = 0,
  'ALTER TABLE uploaded_documents ADD COLUMN subject_id INT NULL AFTER section_id, ADD FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'uploaded_documents' AND COLUMN_NAME = 'school_year_id');
SET @ddl = IF(@col_exists = 0,
  'ALTER TABLE uploaded_documents ADD COLUMN school_year_id INT NULL AFTER subject_id, ADD FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
