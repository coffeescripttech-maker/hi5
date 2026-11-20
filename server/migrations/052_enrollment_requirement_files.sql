-- 052: Digital Requirements Upload (client revision: Digital Requirements
-- Upload, Name Suffix, and School Form Field Population §A).
-- Scanned copies of enrollment requirements, attached to the learner's
-- Enrollment Document Checklist. The physical documents remain with the
-- school. Files live in PRIVATE storage and are served only through an
-- authenticated endpoint (no public links). Up to 3 files per requirement,
-- 5 MB each — enforced in the API.

CREATE TABLE IF NOT EXISTS enrollment_requirement_files (
  id              INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  enrollment_id   INT          NOT NULL,
  requirement_key VARCHAR(60)  NOT NULL,
  file_path       VARCHAR(255) NOT NULL,
  original_name   VARCHAR(150) NOT NULL,
  mime_type       VARCHAR(60)  NOT NULL,
  file_size       INT          NOT NULL,
  uploaded_by     INT          NOT NULL,
  created_at      DATETIME     DEFAULT NOW(),
  INDEX idx_erf_enrollment (enrollment_id, requirement_key),
  CONSTRAINT fk_erf_enrollment FOREIGN KEY (enrollment_id)
    REFERENCES enrollments (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
