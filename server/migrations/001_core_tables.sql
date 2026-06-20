-- ============================================================
-- Migration 001: Core Tables
-- school_years, users, school_settings
-- ============================================================

-- 1. school_years
CREATE TABLE IF NOT EXISTS school_years (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sy_label VARCHAR(9) NOT NULL UNIQUE COMMENT 'e.g. "2025-2026"',
  is_current TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Only one row can be current',
  enrollment_open TINYINT(1) NOT NULL DEFAULT 0,
  enrollment_start_date DATE NULL,
  enrollment_end_date DATE NULL,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. users (all roles: admin, teacher, registrar)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL COMMENT 'bcrypt hash',
  name VARCHAR(150) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  role ENUM('admin', 'teacher', 'registrar') NOT NULL,
  phone VARCHAR(20) NULL,
  address TEXT NULL,
  profile_photo_url VARCHAR(255) NULL,
  status ENUM('active', 'idle', 'inactive') NOT NULL DEFAULT 'active',
  employee_id VARCHAR(30) NULL COMMENT 'e.g. EMP-2019-001',
  designation VARCHAR(100) NULL COMMENT 'e.g. Teacher I',
  date_hired DATE NULL,
  last_login DATETIME NULL,
  login_attempts TINYINT NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. school_settings (singleton — only 1 row)
CREATE TABLE IF NOT EXISTS school_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  school_name VARCHAR(200) NOT NULL,
  school_id VARCHAR(30) NOT NULL COMMENT 'DepEd ID',
  region VARCHAR(100) NOT NULL,
  division VARCHAR(100) NOT NULL,
  district VARCHAR(100) NULL,
  current_sy_id INT NULL,
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  FOREIGN KEY (current_sy_id) REFERENCES school_years(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
