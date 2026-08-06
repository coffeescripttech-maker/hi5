-- ============================================================
-- Migration 015: Role-Based Access Control (RBAC)
-- Permissions matrix for which sidebar modules each role may access,
-- aligned with the Data Privacy Act of 2012 (RA10173) least-privilege
-- principle.
--
-- Deny-list model: a module is ENABLED by default; a row with
-- enabled = 0 means the module is hidden and blocked for that role.
-- The backend merges missing rows as enabled, so new modules default
-- to visible and nothing breaks out of the box.
-- ============================================================

CREATE TABLE IF NOT EXISTS role_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role ENUM('admin', 'teacher', 'registrar', 'principal') NOT NULL,
  menu_key VARCHAR(64) NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_role_menu (role, menu_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
