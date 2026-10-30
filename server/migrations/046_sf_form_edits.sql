-- ============================================================
-- Migration 046: Saved School Form Edits
--
-- Implements the client's "Expected Behavior for Saved School Form Edits"
-- (docs/MAJOR_CHANGES_IN_FORMS.txt): every handwritten edit on SF1/SF5/SF9/
-- SF10 is stored per (form, school year, learner) + field key and is reused
-- the next time anyone opens, regenerates, or prints that form.
--
-- Mechanics:
-- - field_key segments are colon-separated: e.g. SF9 attendance
--   "attendance:No. of Days Present:Jun", SF1 header "header:schoolName",
--   SF1 row cells "s:{student_id}:remarks" (row-level rows carry their own
--   student_id too), SF5 summary overrides "summary:{row}:{col}", SF10
--   "learner:lastName", "record:{index}:adviser", etc.
-- - student_id NULL = form-level value that appears once for the whole form
--   (header blocks, signature names, summary tables). The unique key keeps
--   NULLs distinct in MySQL, so upserts resolve the row with an explicit
--   SELECT-first UPDATE/INSERT in the controller instead of ON DUPLICATE KEY.
-- - value NULL/'' = cleared field (an intentional, printable empty).
-- - updated_by is the acting user; each changed field is written to the
--   Activity Log with old -> new values by the controller.
-- - The whole DB (including this table) is part of System Backup/restore
--   (rule 17) — no extra export step.
-- ============================================================

CREATE TABLE IF NOT EXISTS sf_form_edits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  form ENUM('SF1','SF5','SF9','SF10') NOT NULL,
  school_year_id INT NOT NULL,
  student_id INT NULL COMMENT 'NULL = form-level row (header/signers/summary)',
  field_key VARCHAR(120) NOT NULL,
  value TEXT NULL,
  updated_by INT NOT NULL,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by) REFERENCES users(id),
  UNIQUE KEY uk_sf_edit (form, school_year_id, student_id, field_key),
  INDEX idx_student_sy (student_id, school_year_id, form)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
