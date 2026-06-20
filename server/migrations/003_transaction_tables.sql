-- ============================================================
-- Migration 003: Transaction Tables
-- enrollments, grades, grade_correction_requests
-- ============================================================

-- 11. enrollments
CREATE TABLE IF NOT EXISTS enrollments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  section_id INT NOT NULL,
  school_year_id INT NOT NULL,
  enrollment_date DATE NOT NULL,
  enrolled_by INT NOT NULL COMMENT 'Users.id who enrolled',
  status ENUM('enrolled', 'dropped', 'transferred') NOT NULL DEFAULT 'enrolled',
  remarks TEXT NULL,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE KEY uk_student_sy (student_id, school_year_id) COMMENT 'One enrollment per SY',
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES sections(id),
  FOREIGN KEY (school_year_id) REFERENCES school_years(id),
  FOREIGN KEY (enrolled_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. grades (normalized — one row per quarter)
CREATE TABLE IF NOT EXISTS grades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  subject_id INT NOT NULL,
  enrollment_id INT NOT NULL,
  school_year_id INT NOT NULL,
  quarter TINYINT NOT NULL COMMENT '1-4',
  grade DECIMAL(5,2) NULL,
  is_locked TINYINT(1) NOT NULL DEFAULT 0,
  locked_at DATETIME NULL,
  locked_by INT NULL,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE KEY uk_grade_unique (student_id, subject_id, school_year_id, quarter),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id),
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id),
  FOREIGN KEY (school_year_id) REFERENCES school_years(id),
  FOREIGN KEY (locked_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. grade_correction_requests
CREATE TABLE IF NOT EXISTS grade_correction_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  subject_id INT NOT NULL,
  school_year_id INT NOT NULL,
  quarter TINYINT NULL COMMENT 'NULL if all quarters',
  requested_by INT NOT NULL COMMENT 'Teacher who requested',
  justification TEXT NOT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  reviewed_by INT NULL COMMENT 'Registrar/Admin who reviewed',
  reviewed_at DATETIME NULL,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id),
  FOREIGN KEY (school_year_id) REFERENCES school_years(id),
  FOREIGN KEY (requested_by) REFERENCES users(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
