-- ============================================================
-- Migration 010: Strand/Track Management
-- Adds strand/track support for per-student subject tracks:
--   - JHS (Grades 7-10): TLE specializations
--   - SHS (Grades 11-12): Academic/Technical strands
-- ============================================================

-- 1. Create strand_tracks table
CREATE TABLE IF NOT EXISTS strand_tracks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  track_type ENUM('tle', 'shs_strand') NOT NULL,
  grade_level TINYINT NOT NULL COMMENT 'Primary grade level this track applies to (0 = multi-grade)',
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Create subject_strand_tracks junction table
CREATE TABLE IF NOT EXISTS subject_strand_tracks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subject_id INT NOT NULL,
  strand_track_id INT NOT NULL,
  UNIQUE KEY uk_subject_track (subject_id, strand_track_id),
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (strand_track_id) REFERENCES strand_tracks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Add strand_track_id to enrollments (guarded so the migration can be re-run)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'enrollments' AND COLUMN_NAME = 'strand_track_id');
SET @ddl = IF(@col_exists = 0,
  'ALTER TABLE enrollments ADD COLUMN strand_track_id INT NULL AFTER program, ADD FOREIGN KEY (strand_track_id) REFERENCES strand_tracks(id)',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Seed default strand tracks (INSERT IGNORE — safe to re-run)

-- TLE specializations (Grades 7-10)
INSERT IGNORE INTO strand_tracks (code, name, track_type, grade_level, description, sort_order) VALUES
('tle_agri',      'TLE — Agriculture & Fishery Arts',          'tle', 0, 'Specialization in agriculture, animal production, and fishery',  1),
('tle_he',        'TLE — Home Economics',                      'tle', 0, 'Specialization in cookery, dressmaking, and household services', 2),
('tle_ict',       'TLE — Information & Communications Technology', 'tle', 0, 'Specialization in computer programming, animation, and CSS',     3),
('tle_ia',        'TLE — Industrial Arts',                    'tle', 0, 'Specialization in carpentry, masonry, and welding',              4),
('tle_eia',       'TLE — Entrepreneurship & Innovation Arts',  'tle', 0, 'Specialization in business incubation and creative industries',  5);

-- SHS strands (Grades 11-12)
INSERT IGNORE INTO strand_tracks (code, name, track_type, grade_level, description, sort_order) VALUES
('stem',   'STEM — Science, Technology, Engineering & Mathematics',                 'shs_strand', 11, 'For students pursuing science, engineering, and math careers',    10),
('abm',    'ABM — Accountancy, Business & Management',                              'shs_strand', 11, 'For students pursuing business, finance, and entrepreneurship',   11),
('humss',  'HUMSS — Humanities & Social Sciences',                                  'shs_strand', 11, 'For students pursuing law, social sciences, and humanities',      12),
('gas',    'GAS — General Academic Strand',                                         'shs_strand', 11, 'A flexible strand for undecided students',                        13),
('tvl',    'TVL — Technical-Vocational & Livelihood',                               'shs_strand', 11, 'For students pursuing technical and vocational careers',          14),
('sports', 'Sports — Sports & Physical Education Track',                             'shs_strand', 11, 'For students pursuing sports and fitness careers',                15),
('arts',   'ADT — Arts & Design Track',                                             'shs_strand', 11, 'For students pursuing creative and performing arts',              16);

-- 5. Update existing enrollment records with strand_track_ids based on section program mapping
-- (This is a no-op for existing data; new data will explicitly set strand_track_id)
