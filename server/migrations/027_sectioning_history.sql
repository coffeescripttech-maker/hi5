-- 027_sectioning_history.sql
-- Tracks each bulk section-assignment batch so the Registrar can undo a
-- mistaken confirmation. Each successful assignment records the previous
-- section (NULL = student was pending/unassigned) before the section_id is
-- overwritten, enabling a clean rollback that restores enrollments and
-- section counts.

CREATE TABLE IF NOT EXISTS sectioning_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id VARCHAR(40) NOT NULL,
  school_year_id INT NOT NULL,
  enrollment_id INT NOT NULL,
  student_id INT NOT NULL,
  prev_section_id INT NULL,
  target_section_id INT NOT NULL,
  status ENUM('done', 'undone') NOT NULL DEFAULT 'done',
  assigned_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  undone_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_batch (batch_id),
  INDEX idx_sy_status (school_year_id, status)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;