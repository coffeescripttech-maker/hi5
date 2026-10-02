-- ─────────────────────────────────────────────────────────────────────────────
-- 037 — Enrollment Committee, Transfer Requests, Reading Assessments
--   1. 'enrollment_committee' role on users / role_permissions / notifications
--      (additive ENUM widening only — existing rows are untouched)
--   2. transfer_requests — Registrar files Transfer-In / Transfer-Out requests,
--      the Enrollment Committee reviews and approves/rejects them
--   3. reading_assessments — evidence record that lets a Teacher manually tag a
--      learner as Non-Reader. Classification is never derived from grades.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Role ENUMs.
ALTER TABLE users
  MODIFY COLUMN role
    ENUM('admin','teacher','registrar','principal','enrollment_committee')
    NOT NULL DEFAULT 'teacher';

ALTER TABLE role_permissions
  MODIFY COLUMN role
    ENUM('admin','teacher','registrar','principal','enrollment_committee') NOT NULL;

ALTER TABLE notifications
  MODIFY COLUMN role
    ENUM('admin','teacher','registrar','principal','enrollment_committee') NULL
    COMMENT 'Target role if broadcast';

-- The committee inherits every Admin menu permission, so no deny rows are needed
-- (the RBAC service defaults to enabled and only records overrides).

-- 2. Transfer requests.
CREATE TABLE IF NOT EXISTS transfer_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  transfer_type ENUM('transfer_in','transfer_out') NOT NULL
    COMMENT 'transfer_in = new learner from another school; transfer_out = leaving',
  school_year_id INT NOT NULL COMMENT 'SY the request applies to',
  grade_level TINYINT NULL COMMENT 'Admitting grade level for transfer_in',
  requested_section_id INT NULL COMMENT 'Section proposed for transfer_in',
  previous_school VARCHAR(200) NULL COMMENT 'Origin school (transfer_in)',
  destination_school VARCHAR(200) NULL COMMENT 'Receiving school (transfer_out)',
  reason TEXT NULL,
  status ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  requested_by INT NOT NULL COMMENT 'Registrar who filed the request',
  reviewed_by INT NULL COMMENT 'Enrollment Committee member who decided',
  reviewed_at DATETIME NULL,
  review_remarks TEXT NULL,
  enrollment_id INT NULL COMMENT 'Enrollment created when transfer_in was approved',
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  KEY idx_transfer_status (status, school_year_id),
  KEY idx_transfer_student (student_id),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (school_year_id) REFERENCES school_years(id),
  FOREIGN KEY (requested_section_id) REFERENCES sections(id) ON DELETE SET NULL,
  FOREIGN KEY (requested_by) REFERENCES users(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Reading assessments — the only admissible basis for Non-Reader tagging.
CREATE TABLE IF NOT EXISTS reading_assessments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  school_year_id INT NOT NULL,
  assessment_date DATE NOT NULL,
  result ENUM('non_reader','reader') NOT NULL,
  score DECIMAL(5,2) NULL,
  instrument VARCHAR(120) NULL COMMENT 'Test used, e.g. Phil-IRI',
  remarks TEXT NULL,
  assessed_by INT NOT NULL COMMENT 'Teacher who administered it',
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE KEY uk_reading_assessment (student_id, school_year_id, assessment_date),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (school_year_id) REFERENCES school_years(id),
  FOREIGN KEY (assessed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Document verification on the enrollment checklist.
--    is_submitted = the learner/staff handed the document over.
--    is_verified  = the Enrollment Committee checked the receipt. Verification
--    never uploads anything; it only records that the paper was sighted.
ALTER TABLE enrollment_requirements
  ADD COLUMN is_verified TINYINT(1) NOT NULL DEFAULT 0 AFTER is_submitted,
  ADD COLUMN verified_at DATETIME NULL AFTER is_verified,
  ADD COLUMN verified_by INT NULL AFTER verified_at,
  ADD COLUMN verification_notes TEXT NULL AFTER verified_by,
  ADD KEY idx_req_verified (enrollment_id, is_verified),
  ADD CONSTRAINT fk_req_verified_by FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL;