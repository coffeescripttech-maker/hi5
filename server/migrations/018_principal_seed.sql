-- ============================================================
-- Migration 018: Seed principal demo account
--
-- Adds principal01 so the Login page's Principal quick-access
-- button can sign in. Same bcrypt hash as the other demo users
-- ("password123"). The RBAC deny-list defaults the principal
-- role to full access, so no role_permissions rows are needed.
-- ============================================================

INSERT INTO users (username, password_hash, name, email, role, status, employee_id, designation, date_hired, last_login)
SELECT 'principal01',
       '$2a$10$HlcEUvuWhK1.uVHiyxv2dOdLi6yFvEFdW/WPM01wBEf6Gva3RqnD6',
       'Dr. Rosario B. Villanueva',
       'rvillanueva@school.edu.ph',
       'principal',
       'active',
       'PRI-001',
       'School Principal IV',
       '2015-06-01',
       NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'principal01');
