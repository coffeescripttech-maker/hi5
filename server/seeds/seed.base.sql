-- ============================================================
-- Base Seed for HI5 Portal (clean start)
-- Used by `npm run db:reset`.
--
-- Seeds ONLY the admin account + structural reference data so
-- the whole system can be built/tested from scratch through the UI:
--   - 1 admin user (admin / password123)
--   - 1 current school year (2025-2026)
--   - Section types + per-grade config (needed by section creation)
-- Everything else (other users, sections, subjects, students,
-- enrollments, grades) starts empty.
-- ============================================================

-- ─── School Years ───────────────────────────────────────────────────────────────

INSERT INTO school_years (sy_label, is_current, enrollment_open) VALUES
('2025-2026', 1, 1);

-- ─── Users (admin only) ─────────────────────────────────────────────────────────
-- bcrypt hash of "password123" for development only.
-- Change it later via User Management → Edit.

INSERT INTO users (username, password_hash, name, email, role, status, employee_id, designation, date_hired, last_login) VALUES
('admin', '$2a$10$HlcEUvuWhK1.uVHiyxv2dOdLi6yFvEFdW/WPM01wBEf6Gva3RqnD6', 'System Administrator', 'admin@school.edu.ph', 'admin', 'active', 'ADM-001', 'School Administrator', '2020-06-01', NOW()),
('principal01', '$2a$10$HlcEUvuWhK1.uVHiyxv2dOdLi6yFvEFdW/WPM01wBEf6Gva3RqnD6', 'Dr. Rosario B. Villanueva', 'rvillanueva@school.edu.ph', 'principal', 'active', 'PRI-001', 'School Principal IV', '2015-06-01', NOW());

-- ─── Section Types (reference) ──────────────────────────────────────────────────

INSERT IGNORE INTO section_types (name, label, color_code, icon, sort_order, is_locked) VALUES
('ste',       'STE (Science & Technology)', 'amber',  '🔬',    1, 1),
('regular',   'Regular (Standard K-12)',   'blue',   '📚',    2, 1),
('spfl',      'SPFL (Foreign Language)',   'yellow', '🌐',    3, 1),
('spj',       'SPJ (Journalism)',          'slate',  '📰',    4, 0),
('non_reader','Non-Reader (Intervention)', 'red',    '📖',    5, 1);

-- ─── Section Type Config (per grade-level placement bands) ───────────────────────

INSERT INTO section_type_config (section_type, grade_level, min_average, max_average, color_code, icon) VALUES
('ste',        7,  90, 100, 'bg-amber-400', '🔬'),
('spfl',        7,  85,  89, 'bg-yellow-400', '🌐'),
('spj',      7,  80,  84, 'bg-gray-400',   '🥈'),
('regular',     7,  75,  79, 'bg-blue-400',   '📚'),
('non_reader',  7,  0,   74, 'bg-red-400',    '📖'),
('ste',        8,  90, 100, 'bg-yellow-400', '⭐'),
('spfl',        8,  85,  89, 'bg-amber-500',  '🥇'),
('spj',      8,  80,  84, 'bg-gray-400',   '🥈'),
('regular',     8,  75,  79, 'bg-blue-400',   '📚'),
('non_reader',  8,  0,   74, 'bg-red-400',    '📖'),
('ste',        9,  90, 100, 'bg-yellow-400', '⭐'),
('spfl',        9,  85,  89, 'bg-amber-500',  '🥇'),
('spj',      9,  80,  84, 'bg-gray-400',   '🥈'),
('regular',     9,  75,  79, 'bg-blue-400',   '📚'),
('non_reader',  9,  0,   74, 'bg-red-400',    '📖'),
('ste',        10, 90, 100, 'bg-yellow-400', '⭐'),
('spfl',        10, 85,  89, 'bg-amber-500',  '🥇'),
('spj',      10, 80,  84, 'bg-gray-400',   '🥈'),
('regular',     10, 75,  79, 'bg-blue-400',   '📚'),
('non_reader',  10, 0,   74, 'bg-red-400',    '📖'),
('ste',        11, 90, 100, 'bg-yellow-400', '⭐'),
('spfl',        11, 85,  89, 'bg-amber-500',  '🥇'),
('spj',      11, 80,  84, 'bg-gray-400',   '🥈'),
('regular',     11, 75,  79, 'bg-blue-400',   '📚'),
('non_reader',  11, 0,   74, 'bg-red-400',    '📖'),
('ste',        12, 90, 100, 'bg-yellow-400', '⭐'),
('spfl',        12, 85,  89, 'bg-amber-500',  '🥇'),
('spj',      12, 80,  84, 'bg-gray-400',   '🥈'),
('regular',     12, 75,  79, 'bg-blue-400',   '📚'),
('non_reader',  12, 0,   74, 'bg-red-400',    '📖');

-- ─── School Settings ────────────────────────────────────────────────────────────

INSERT INTO school_settings (school_name, school_id, region, division, district, principal_name, registrar_name, current_sy_id) VALUES
('Don Servillano Platon Memorial National High School', '301234', 'Region V (Bicol)', 'Camarines Sur', 'Tinambac', 'Dr. Rosario B. Villanueva', 'Ms. Carla Reyes', 1);
