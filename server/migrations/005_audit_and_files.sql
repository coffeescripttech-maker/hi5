-- ============================================================
-- Migration 005: Audit & File Tables
-- activity_logs, backups, uploaded_documents, notifications, notification_reads
-- ============================================================

-- 17. activity_logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action TEXT NOT NULL COMMENT 'Human-readable description',
  entity_type VARCHAR(50) NULL COMMENT 'e.g. student, grade, section',
  entity_id VARCHAR(50) NULL,
  created_at DATETIME NOT NULL DEFAULT NOW(),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. backups
CREATE TABLE IF NOT EXISTS backups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  backup_type ENUM('auto', 'manual') NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  file_size BIGINT NULL COMMENT 'Size in bytes',
  record_count INT NULL,
  status ENUM('success', 'failed', 'in_progress') NOT NULL,
  initiated_by INT NULL,
  created_at DATETIME DEFAULT NOW(),
  FOREIGN KEY (initiated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 19. uploaded_documents
CREATE TABLE IF NOT EXISTS uploaded_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NULL,
  section_id INT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type ENUM('pdf', 'xlsx', 'xls', 'docx') NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  file_size INT NULL COMMENT 'Size in bytes',
  uploaded_by INT NOT NULL,
  record_count INT NULL COMMENT 'For grade uploads: number of records',
  quarter TINYINT NULL COMMENT 'For grade uploads: which quarter',
  status ENUM('pending', 'validated', 'imported', 'failed') NOT NULL DEFAULT 'pending',
  created_at DATETIME DEFAULT NOW(),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL,
  FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE SET NULL,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 20. notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL COMMENT 'NULL = broadcast to role',
  role ENUM('admin', 'teacher', 'registrar') NULL COMMENT 'Target role if broadcast',
  type ENUM('info', 'success', 'warning', 'error', 'security') NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 21. notification_reads
CREATE TABLE IF NOT EXISTS notification_reads (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  notification_id INT NOT NULL,
  user_id INT NOT NULL,
  read_at DATETIME DEFAULT NOW(),
  UNIQUE KEY uk_notif_user (notification_id, user_id),
  FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
