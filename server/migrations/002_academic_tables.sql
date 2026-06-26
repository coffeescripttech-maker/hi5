-- ============================================================
-- Migration 002: Academic Structure Tables
-- students, student_classifications, section_types, sections, section_type_config, subjects
-- ============================================================

-- 4. students
CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(20) NOT NULL UNIQUE COMMENT 'Display ID like 2026-07-0001',
  lrn VARCHAR(12) NOT NULL UNIQUE COMMENT '12-digit LRN',
  name VARCHAR(150) NOT NULL,
  grade_level TINYINT NOT NULL COMMENT '7-12',
  sex ENUM('male', 'female') NOT NULL,
  birthdate DATE NOT NULL,
  address TEXT NULL,
  guardian VARCHAR(150) NULL,
  contact VARCHAR(20) NULL,
  status ENUM('enrolled', 'pending', 'dropped', 'transferred', 'graduated') NOT NULL DEFAULT 'pending',
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. student_classifications
CREATE TABLE IF NOT EXISTS student_classifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  classification ENUM('4ps', 'pwd', 'transferee', 'non_reader', 'regular') NOT NULL,
  school_year_id INT NOT NULL,
  created_at DATETIME DEFAULT NOW(),
  UNIQUE KEY uk_student_class_sy (student_id, classification, school_year_id),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (school_year_id) REFERENCES school_years(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5b. section_types — master list of dynamic section types
CREATE TABLE IF NOT EXISTS section_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE COMMENT 'key value e.g. star, honors',
  label VARCHAR(100) NOT NULL COMMENT 'display label e.g. Star Section',
  color_code VARCHAR(30) NULL COMMENT 'e.g. amber, #F59E0B',
  icon VARCHAR(30) NULL COMMENT 'lucide icon name or emoji',
  sort_order INT NOT NULL DEFAULT 0,
  is_locked TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'prevents deletion of core types',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed default section types (curriculum tracks)
INSERT IGNORE INTO section_types (name, label, color_code, icon, sort_order, is_locked) VALUES
('ste',       'STE (Science & Technology)', 'amber',  '🔬',    1, 1),
('regular',   'Regular (Standard K-12)',   'blue',   '📚',    2, 1),
('spfl',      'SPFL (Foreign Language)',   'yellow', '🌐',    3, 1),
('spj',       'SPJ (Journalism)',          'slate',  '📰',    4, 0),
('non_reader','Non-Reader (Intervention)', 'red',    '📖',    5, 1);

-- 6. sections
CREATE TABLE IF NOT EXISTS sections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(30) NOT NULL UNIQUE COMMENT 'e.g. 7-Star',
  grade_level TINYINT NOT NULL COMMENT '7-12',
  section_type VARCHAR(50) NOT NULL,
  capacity SMALLINT NOT NULL,
  current_count SMALLINT NOT NULL DEFAULT 0,
  adviser_id INT NULL,
  min_average DECIMAL(5,2) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  FOREIGN KEY (adviser_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. section_type_config
CREATE TABLE IF NOT EXISTS section_type_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  section_type VARCHAR(50) NOT NULL,
  grade_level TINYINT NOT NULL,
  min_average DECIMAL(5,2) NOT NULL,
  max_average DECIMAL(5,2) NOT NULL,
  color_code VARCHAR(20) NULL,
  icon VARCHAR(10) NULL,
  UNIQUE KEY uk_section_type_grade (section_type, grade_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. subjects
CREATE TABLE IF NOT EXISTS subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  grade_level TINYINT NOT NULL COMMENT '7-12',
  hours_per_week DECIMAL(4,1) NOT NULL,
  subject_type ENUM('core', 'applied', 'specialized') NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE KEY uk_subject_grade (name, grade_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. teacher_subject_assignments
CREATE TABLE IF NOT EXISTS teacher_subject_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  teacher_id INT NOT NULL,
  subject_id INT NOT NULL,
  school_year_id INT NOT NULL,
  created_at DATETIME DEFAULT NOW(),
  UNIQUE KEY uk_teacher_subject_sy (teacher_id, subject_id, school_year_id),
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (school_year_id) REFERENCES school_years(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. teacher_section_assignments
CREATE TABLE IF NOT EXISTS teacher_section_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  teacher_id INT NOT NULL,
  section_id INT NOT NULL,
  school_year_id INT NOT NULL,
  is_adviser TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT NOW(),
  UNIQUE KEY uk_teacher_section_sy (teacher_id, section_id, school_year_id),
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
  FOREIGN KEY (school_year_id) REFERENCES school_years(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migrate existing ENUM columns to VARCHAR (safe to re-run)
ALTER TABLE sections MODIFY section_type VARCHAR(50) NOT NULL;
ALTER TABLE section_type_config MODIFY section_type VARCHAR(50) NOT NULL;
