-- ============================================================
-- Seed Data for HI5 Portal
-- Matches the existing sampleData.ts frontend data
-- ============================================================

-- ─── School Years ───────────────────────────────────────────────────────────────

INSERT INTO school_years (sy_label, is_current, enrollment_open) VALUES
('2025-2026', 1, 1),
('2026-2027', 0, 0);

-- ─── Users ──────────────────────────────────────────────────────────────────────
-- Default passwords (bcrypt hash of "password123") for development only
-- In production, each user must change their password on first login

INSERT INTO users (username, password_hash, name, email, role, status, employee_id, designation, date_hired, last_login) VALUES
('admin',       '$2a$10$HlcEUvuWhK1.uVHiyxv2dOdLi6yFvEFdW/WPM01wBEf6Gva3RqnD6', 'System Administrator',    'admin@school.edu.ph',     'admin',     'active', 'ADM-001',     'School Administrator', '2020-06-01', NOW()),
('teacher01',   '$2a$10$HlcEUvuWhK1.uVHiyxv2dOdLi6yFvEFdW/WPM01wBEf6Gva3RqnD6', 'Mr. Ramon Dela Cruz',     'rdelacruz@school.edu.ph', 'teacher',   'active', 'EMP-2019-001', 'Teacher I',            '2019-06-01', NOW()),
('teacher02',   '$2a$10$HlcEUvuWhK1.uVHiyxv2dOdLi6yFvEFdW/WPM01wBEf6Gva3RqnD6', 'Ms. Linda Fernandez',     'lfernandez@school.edu.ph','teacher',   'active', 'EMP-2019-002', 'Teacher II',           '2019-06-01', NOW()),
('teacher03',   '$2a$10$HlcEUvuWhK1.uVHiyxv2dOdLi6yFvEFdW/WPM01wBEf6Gva3RqnD6', 'Mr. Eduardo Ocampo',      'eocampo@school.edu.ph',   'teacher',   'active', 'EMP-2020-001', 'Teacher I',            '2020-06-01', NOW()),
('teacher04',   '$2a$10$HlcEUvuWhK1.uVHiyxv2dOdLi6yFvEFdW/WPM01wBEf6Gva3RqnD6', 'Ms. Patricia Lim',        'plim@school.edu.ph',      'teacher',   'inactive','EMP-2020-002', 'Teacher III',          '2020-06-01', '2026-02-20 14:30:00'),
('teacher05',   '$2a$10$HlcEUvuWhK1.uVHiyxv2dOdLi6yFvEFdW/WPM01wBEf6Gva3RqnD6', 'Mr. Fernando Castro',     'fcastro@school.edu.ph',   'teacher',   'active', 'EMP-2021-001', 'Teacher I',            '2021-06-01', NOW()),
('registrar01', '$2a$10$HlcEUvuWhK1.uVHiyxv2dOdLi6yFvEFdW/WPM01wBEf6Gva3RqnD6', 'Ms. Carla Reyes',         'creyes@school.edu.ph',    'registrar', 'active', 'REG-001',     'Registrar',            '2018-06-01', NOW()),
('registrar02', '$2a$10$HlcEUvuWhK1.uVHiyxv2dOdLi6yFvEFdW/WPM01wBEf6Gva3RqnD6', 'Mr. Dennis Soriano',      'dsoriano@school.edu.ph',  'registrar', 'active', 'REG-002',     'Assistant Registrar',  '2019-06-01', NOW());

-- ─── Students ───────────────────────────────────────────────────────────────────

INSERT INTO students (student_id, lrn, name, grade_level, sex, birthdate, address, guardian, contact, status) VALUES
('2026-07-0001', '123456789012', 'Maria Santos',     7, 'female', '2012-03-15', '123 Mabini St., Caloocan City',        'Elena Santos',  '09171234567', 'enrolled'),
('2026-07-0002', '123456789013', 'Juan dela Cruz',   7, 'male',   '2012-07-22', '456 Rizal Ave., Quezon City',          'Pedro dela Cruz','09281234567', 'enrolled'),
('2026-07-0003', '123456789021', 'Mark Bautista',    7, 'male',   '2012-05-08', '741 Mabini St., Valenzuela',           'Ben Bautista',  '09121234567', 'pending'),
('2026-08-0001', '123456789014', 'Ana Reyes',        8, 'female', '2011-11-05', '789 Bonifacio Blvd., Manila',          'Rosa Reyes',    '09391234567', 'enrolled'),
('2026-08-0002', '123456789015', 'Carlo Mendoza',    8, 'male',   '2011-04-18', '321 Luna St., Pasig',                  'Mario Mendoza', '09451234567', 'enrolled'),
('2026-09-0001', '123456789016', 'Sofia Villanueva', 9, 'female', '2010-08-30', '654 Del Pilar St., Makati',            'Carmen Villanueva','09561234567', 'enrolled'),
('2026-09-0002', '123456789017', 'Miguel Torres',    9, 'male',   '2010-02-14', '987 Aguinaldo St., Taguig',            'Jose Torres',   '09671234567', 'enrolled'),
('2026-10-0001', '123456789018', 'Isabella Garcia',  10, 'female','2009-06-20', '147 Quezon St., Paranaque',             'Luz Garcia',    '09781234567', 'enrolled'),
('2026-11-0001', '123456789019', 'Rafael Aquino',    11, 'male',   '2008-09-12', '258 Laurel St., Las Pinas',            'Minda Aquino',  '09891234567', 'enrolled'),
('2026-12-0001', '123456789020', 'Gabriela Luna',    12, 'female','2007-12-25', '369 Roxas St., Mandaluyong',            'Cora Luna',     '09901234567', 'enrolled');

-- ─── Student Classifications ────────────────────────────────────────────────────

INSERT INTO student_classifications (student_id, classification, school_year_id) VALUES
(1, '4ps', 1),
(3, '4ps', 1),
(8, 'pwd', 1),
(10, 'pwd', 1),
(4, 'transferee', 1);

-- ─── Section Types ────────────────────────────────────────────────────────────────

INSERT IGNORE INTO section_types (name, label, color_code, icon, sort_order, is_locked) VALUES
('ste',       'STE (Science & Technology)', 'amber',  '🔬',    1, 1),
('regular',   'Regular (Standard K-12)',   'blue',   '📚',    2, 1),
('spfl',      'SPFL (Foreign Language)',   'yellow', '🌐',    3, 1),
('spj',       'SPJ (Journalism)',          'slate',  '📰',    4, 0),
('non_reader','Non-Reader (Intervention)', 'red',    '📖',    5, 1);

-- ─── Sections ───────────────────────────────────────────────────────────────────

INSERT INTO sections (name, grade_level, section_type, capacity, current_count, adviser_id, min_average) VALUES
('7-Mabini',     7,  'ste',      45, 42, 2, 90),
('7-Sampaguita', 7,  'spfl',     45, 40, 3, 85),
('7-Integridad', 7,  'spj',      45, 38, 4, 80),
('7-Diligence',  7,  'regular',  45, 35, 5, 75),
('8-Rizal',      8,  'ste',      45, 43, 6, 90),
('8-Rosal',      8,  'spfl',     45, 41, 2, 85),
('8-Katapatan',  8,  'spj',      45, 37, 3, 80),
('8-Masipag',    8,  'regular',  45, 33, 4, 75),
('9-Bonifacio',  9,  'ste',      50, 48, 5, 90),
('9-Ilang-Ilang',9,  'spfl',     50, 46, 6, 85),
('10-Luna',      10, 'spj',      50, 44, 2, 80),
('11-Aquino',    11, 'ste',      50, 49, 3, 90),
('12-Jacinto',   12, 'regular',  50, 47, 4, 85);

-- ─── Section Type Config ────────────────────────────────────────────────────────

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

-- ─── Subjects ───────────────────────────────────────────────────────────────────

INSERT INTO subjects (name, grade_level, hours_per_week, subject_type) VALUES
('Filipino',            7, 4, 'core'),
('English',             7, 4, 'core'),
('Mathematics',         7, 4, 'core'),
('Science',             7, 4, 'core'),
('Araling Panlipunan',  7, 3, 'core'),
('MAPEH',               7, 3, 'core'),
('TLE/EPP',             7, 3, 'applied'),
('Values Education',    7, 2, 'core'),
('ESP',                 7, 2, 'core'),
('Filipino',            8, 4, 'core'),
('English',             8, 4, 'core'),
('Mathematics',         8, 4, 'core'),
('Science',             8, 4, 'core'),
('Araling Panlipunan',  8, 3, 'core'),
('MAPEH',               8, 3, 'core'),
('TLE/EPP',             8, 3, 'applied'),
('Values Education',    8, 2, 'core'),
('ESP',                 8, 2, 'core'),
('Filipino',            9, 4, 'core'),
('English',             9, 4, 'core'),
('Mathematics',         9, 4, 'core'),
('Science',             9, 4, 'core'),
('Araling Panlipunan',  9, 3, 'core'),
('MAPEH',               9, 3, 'core'),
('TLE/EPP',             9, 3, 'applied'),
('Values Education',    9, 2, 'core'),
('ESP',                 9, 2, 'core'),
('Filipino',            10, 4, 'core'),
('English',             10, 4, 'core'),
('Mathematics',         10, 4, 'core'),
('Science',             10, 4, 'core'),
('Araling Panlipunan',  10, 3, 'core'),
('MAPEH',               10, 3, 'core'),
('TLE/EPP',             10, 3, 'applied'),
('Values Education',    10, 2, 'core'),
('ESP',                 10, 2, 'core'),
('Filipino',            11, 4, 'core'),
('English',             11, 4, 'core'),
('Mathematics',         11, 4, 'core'),
('Science',             11, 4, 'core'),
('Araling Panlipunan',  11, 3, 'core'),
('MAPEH',               11, 3, 'core'),
('TLE/EPP',             11, 3, 'applied'),
('Values Education',    11, 2, 'core'),
('ESP',                 11, 2, 'core'),
('Filipino',            12, 4, 'core'),
('English',             12, 4, 'core'),
('Mathematics',         12, 4, 'core'),
('Science',             12, 4, 'core'),
('Araling Panlipunan',  12, 3, 'core'),
('MAPEH',               12, 3, 'core'),
('TLE/EPP',             12, 3, 'applied'),
('Values Education',    12, 2, 'core'),
('ESP',                 12, 2, 'core');

-- ─── Teacher Subject Assignments ────────────────────────────────────────────────

INSERT INTO teacher_subject_assignments (teacher_id, subject_id, school_year_id)
SELECT t.id, sub.id, 1
FROM (SELECT id FROM users WHERE username = 'teacher01') t
CROSS JOIN (SELECT id FROM subjects WHERE name = 'Mathematics' AND grade_level = 7) sub;

INSERT INTO teacher_subject_assignments (teacher_id, subject_id, school_year_id)
SELECT t.id, sub.id, 1
FROM (SELECT id FROM users WHERE username = 'teacher02') t
CROSS JOIN (SELECT id FROM subjects WHERE name = 'English' AND grade_level = 7) sub;

INSERT INTO teacher_subject_assignments (teacher_id, subject_id, school_year_id)
SELECT t.id, sub.id, 1
FROM (SELECT id FROM users WHERE username = 'teacher03') t
CROSS JOIN (SELECT id FROM subjects WHERE name = 'Science' AND grade_level = 7) sub;

INSERT INTO teacher_subject_assignments (teacher_id, subject_id, school_year_id)
SELECT t.id, sub.id, 1
FROM (SELECT id FROM users WHERE username = 'teacher04') t
CROSS JOIN (SELECT id FROM subjects WHERE name = 'Filipino' AND grade_level = 7) sub;

-- ─── Teacher Section Assignments ────────────────────────────────────────────────

INSERT INTO teacher_section_assignments (teacher_id, section_id, school_year_id, is_adviser)
SELECT t.id, s.id, 1, 1
FROM (SELECT id FROM users WHERE username = 'teacher01') t
CROSS JOIN (SELECT id FROM sections WHERE name = '7-Star') s;

INSERT INTO teacher_section_assignments (teacher_id, section_id, school_year_id, is_adviser)
SELECT t.id, s.id, 1, 1
FROM (SELECT id FROM users WHERE username = 'teacher02') t
CROSS JOIN (SELECT id FROM sections WHERE name = '7-Gold') s;

INSERT INTO teacher_section_assignments (teacher_id, section_id, school_year_id, is_adviser)
SELECT t.id, s.id, 1, 1
FROM (SELECT id FROM users WHERE username = 'teacher03') t
CROSS JOIN (SELECT id FROM sections WHERE name = '8-Silver') s;

INSERT INTO teacher_section_assignments (teacher_id, section_id, school_year_id, is_adviser)
SELECT t.id, s.id, 1, 1
FROM (SELECT id FROM users WHERE username = 'teacher04') t
CROSS JOIN (SELECT id FROM sections WHERE name = '9-Star') s;

-- ─── Enrollments ────────────────────────────────────────────────────────────────

INSERT INTO enrollments (student_id, section_id, school_year_id, enrollment_date, enrolled_by, status) VALUES
(1,  1,  1, '2025-06-03', 2, 'enrolled'),
(2,  2,  1, '2025-06-03', 2, 'enrolled'),
(4,  5,  1, '2025-06-03', 2, 'enrolled'),
(5,  8,  1, '2025-06-03', 2, 'enrolled'),
(6,  9,  1, '2025-06-03', 3, 'enrolled'),
(7,  10, 1, '2025-06-03', 3, 'enrolled'),
(8,  11, 1, '2025-06-03', 2, 'enrolled'),
(9,  12, 1, '2025-06-03', 3, 'enrolled'),
(10, 13, 1, '2025-06-03', 3, 'enrolled');

-- ─── Grades (3 subjects × 4 quarters for Maria Santos) ──────────────────────────

INSERT INTO grades (student_id, subject_id, enrollment_id, school_year_id, quarter, grade) VALUES
(1, 1,  1, 1, 1, 92), (1, 1,  1, 1, 2, 89), (1, 1,  1, 1, 3, 94), (1, 1,  1, 1, 4, 91),
(1, 2,  1, 1, 1, 88), (1, 2,  1, 1, 2, 90), (1, 2,  1, 1, 3, 87), (1, 2,  1, 1, 4, 92),
(1, 3,  1, 1, 1, 95), (1, 3,  1, 1, 2, 93), (1, 3,  1, 1, 3, 96), (1, 3,  1, 1, 4, 94),
(1, 4,  1, 1, 1, 85), (1, 4,  1, 1, 2, 87), (1, 4,  1, 1, 3, 83), (1, 4,  1, 1, 4, 86),
(1, 5,  1, 1, 1, 90), (1, 5,  1, 1, 2, 88), (1, 5,  1, 1, 3, 91), (1, 5,  1, 1, 4, 89),
(1, 6,  1, 1, 1, 93), (1, 6,  1, 1, 2, 95), (1, 6,  1, 1, 3, 92), (1, 6,  1, 1, 4, 94),
(1, 7,  1, 1, 1, 87), (1, 7,  1, 1, 2, 89), (1, 7,  1, 1, 3, 88), (1, 7,  1, 1, 4, 90),
(1, 8,  1, 1, 1, 91), (1, 8,  1, 1, 2, 93), (1, 8,  1, 1, 3, 90), (1, 8,  1, 1, 4, 92);

-- ─── School Settings ────────────────────────────────────────────────────────────

INSERT INTO school_settings (school_name, school_id, region, division, district, current_sy_id) VALUES
('Don Servillano Platon Memorial National High School', '301234', 'Region V (Bicol)', 'Camarines Sur', 'Tinambac', 1);

-- ─── Activity Logs ──────────────────────────────────────────────────────────────

INSERT INTO activity_logs (user_id, action, entity_type, entity_id, created_at) VALUES
(2, 'Enrolled new student: Mark Bautista (LRN: 123456789021)', 'student', '2026-07-0003', '2026-02-22 08:34:12'),
(7, 'Generated SF1 for Grade 7-Star', 'form', 'SF1', '2026-02-22 09:12:05'),
(3, 'Uploaded past grades for Grade 8-Silver (23 records)', 'grade', NULL, '2026-02-22 09:45:33'),
(1, 'Created new user account: teacher03 (Teacher)', 'user', NULL, '2026-02-22 10:02:18'),
(2, 'Locked grades for Grade 7-Star - Mathematics', 'grade', NULL, '2026-02-22 10:30:44'),
(7, 'Generated SF10 for student: Maria Santos', 'form', 'SF10', '2026-02-22 11:05:22'),
(1, 'Updated role assignment: lfernandez → Adviser 8-Silver', 'user', NULL, '2026-02-22 11:22:07'),
(4, 'Enrolled returning student: Ana Reyes (LRN: 123456789014)', 'student', '2026-08-0001', '2026-02-22 12:00:55'),
(7, 'Generated SF5 for Grade 7 students (42 records)', 'form', 'SF5', '2026-02-22 13:15:30'),
(1, 'Database backup initiated successfully', 'backup', NULL, '2026-02-22 14:00:00');
