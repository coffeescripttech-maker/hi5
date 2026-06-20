-- ============================================================
-- Migration 004: Promotion & Risk Tables
-- promotions, promotion_students, at_risk_predictions
-- ============================================================

-- 14. promotions
CREATE TABLE IF NOT EXISTS promotions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  section_id INT NOT NULL COMMENT 'Source section promoted',
  to_grade_level TINYINT NOT NULL COMMENT 'e.g. 7->8',
  school_year_id INT NOT NULL,
  promoted_by INT NOT NULL COMMENT 'Teacher who promoted',
  status ENUM('completed', 'pending_review') NOT NULL DEFAULT 'pending_review',
  created_at DATETIME DEFAULT NOW(),
  FOREIGN KEY (section_id) REFERENCES sections(id),
  FOREIGN KEY (school_year_id) REFERENCES school_years(id),
  FOREIGN KEY (promoted_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. promotion_students
CREATE TABLE IF NOT EXISTS promotion_students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  promotion_id INT NOT NULL,
  student_id INT NOT NULL,
  from_section_id INT NOT NULL,
  to_section_id INT NULL COMMENT 'Set after re-sectioning for next grade',
  general_average DECIMAL(5,2) NULL,
  is_retained TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'GA < 75 = retained',
  created_at DATETIME DEFAULT NOW(),
  FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (from_section_id) REFERENCES sections(id),
  FOREIGN KEY (to_section_id) REFERENCES sections(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. at_risk_predictions
CREATE TABLE IF NOT EXISTS at_risk_predictions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  school_year_id INT NOT NULL,
  q1_average DECIMAL(5,2) NULL,
  q2_average DECIMAL(5,2) NULL,
  q3_average DECIMAL(5,2) NULL,
  risk_score DECIMAL(5,2) NOT NULL COMMENT '0-100 scale',
  risk_level ENUM('at_risk', 'needs_monitoring', 'on_track') NOT NULL,
  trend ENUM('declining', 'stable', 'improving') NOT NULL,
  predicted_by INT NOT NULL COMMENT 'User who ran the model',
  created_at DATETIME DEFAULT NOW(),
  UNIQUE KEY uk_student_sy (student_id, school_year_id),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (school_year_id) REFERENCES school_years(id),
  FOREIGN KEY (predicted_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
