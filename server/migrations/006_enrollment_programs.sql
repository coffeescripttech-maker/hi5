-- ============================================================
-- Migration 006: Enrollment Programs & Requirements
-- Adds curriculum program tracking and enrollment requirements checklist
-- ============================================================

-- 1. Add program column to enrollments (idempotent guard so the migration
--    can be re-run after a partial/ manual application)
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'enrollments' AND COLUMN_NAME = 'program'
);
SET @ddl = IF(@col_exists = 0,
  'ALTER TABLE enrollments ADD COLUMN program ENUM(''regular'',''ste'',''spfl'',''open_high'',''als_shs'') NOT NULL DEFAULT ''regular'' AFTER school_year_id',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Create enrollment_requirements table
CREATE TABLE IF NOT EXISTS enrollment_requirements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  enrollment_id INT NOT NULL,
  requirement_key VARCHAR(40) NOT NULL,
  label VARCHAR(100) NOT NULL,
  is_submitted TINYINT(1) NOT NULL DEFAULT 0,
  submitted_at DATETIME NULL,
  notes TEXT NULL,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE KEY uk_enrollment_req (enrollment_id, requirement_key),
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
