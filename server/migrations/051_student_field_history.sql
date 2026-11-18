-- 051: change history for learner detail fields
-- Generic by design: shared by the LIS import (reason 'LIS import', batch id)
-- and the student-details-edit feature (reason 'per LIS record', etc.).
-- Every changed field is written here with old → new, who, when, and why.

CREATE TABLE IF NOT EXISTS student_field_history (
  id         BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  student_id INT          NOT NULL,
  field      VARCHAR(60)  NOT NULL,
  old_value  TEXT         NULL,
  new_value  TEXT         NULL,
  reason     VARCHAR(60)  NOT NULL,
  changed_by INT          NOT NULL,
  batch_id   VARCHAR(64)  NULL,
  created_at DATETIME     DEFAULT NOW(),
  INDEX idx_sfh_student_field (student_id, field),
  INDEX idx_sfh_batch (batch_id),
  CONSTRAINT fk_sfh_student FOREIGN KEY (student_id)
    REFERENCES students (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
