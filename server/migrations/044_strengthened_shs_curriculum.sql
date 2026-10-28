-- ─────────────────────────────────────────────────────────────────────────────
-- 044 — Strengthened SHS Curriculum
--
--   Implements the client's Strengthened SHS Curriculum Update Guide:
--     * Two SHS tracks — Academic and Technical-Professional (TechPro) — replace
--       the old strand picker for Mainstream/Open High School, Grades 11-12.
--     * Five Grade-11 core subjects, auto-assigned, non-selectable, both tracks.
--     * Work Immersion as its own subject category for Grade 12 (auto-assigned).
--     * Elective categories (elective / field_experience / work_immersion) and
--       per-year offering switches for electives.
--     * student_electives — electives are picked PER LEARNER (not per section).
--
--   Transition policy (client): the system goes live when both SHS grades follow
--   the new curriculum, so no dual-curriculum support is built. Legacy rows are
--   DEACTIVATED, never deleted, so historical SF9/SF10 records and old raw
--   grades keep working (subjectScope grade-preservation + name joins).
--
--   Idempotent: safe to re-run (guards/IGNORE + ledger in _migrations).
--   Rollback: restore subjects.is_active=1 for rows touched in step 4, drop
--   student_electives/elective_year_exclusions, remove the two shs_track rows,
--   revert the ENUMs (data-preserving; see docs/SHS_MIGRATION_044.md).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. strand_tracks: shs_track type + the two Strengthened SHS tracks ──────
ALTER TABLE strand_tracks
  MODIFY COLUMN track_type ENUM('tle', 'shs_strand', 'shs_track') NOT NULL;

INSERT IGNORE INTO strand_tracks (code, name, track_type, grade_level, description, sort_order) VALUES
('shs_academic', 'Academic',                            'shs_track', 0, 'Academic track — Arts/Social Sciences, Business, STEM, Sports and Health elective clusters', 1),
('shs_techpro',  'Technical-Professional (TechPro)',    'shs_track', 0, 'TechPro track — NC II / NC III specializations', 2);

-- Legacy SHS strands are closed to NEW selections (kept only so older
-- enrollments/forms can still resolve their historical strand text).
UPDATE strand_tracks SET is_active = 0 WHERE track_type = 'shs_strand';

-- ── 2. subjects: new categories, cluster heading, nullable hours ────────────
--   'elective'            — chosen per learner via student_electives
--   'field_experience'    — DepEd Academic FE subjects (80-160 h, Grade 12)
--   'work_immersion'      — Grade 12 auto-assignment
ALTER TABLE subjects
  MODIFY COLUMN subject_type
    ENUM('core', 'applied', 'specialized', 'elective', 'field_experience', 'work_immersion')
    NOT NULL;

-- hours_per_week cannot safely represent the Strengthened SHS total-hour values
-- (160 h for cores, 80 h / 320 h electives, unverified FE hours), so the column
-- becomes nullable and new curriculum rows stay NULL instead of inventing
-- weekly numbers. Work Immersion / Field Experience deliberately get NO hours
-- storage (client limitation note).
ALTER TABLE subjects MODIFY COLUMN hours_per_week DECIMAL(4,1) NULL;

-- Fixed cluster heading shown on the elective list (no cluster table — the
-- client explicitly does not want a cluster-management screen).
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subjects' AND COLUMN_NAME = 'elective_cluster');
SET @ddl = IF(@col_exists = 0,
  'ALTER TABLE subjects ADD COLUMN elective_cluster VARCHAR(100) NULL AFTER subject_group',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Widened for the long official elective names (Arts 1 / Arts 2 exceed 100 chars).
ALTER TABLE subjects MODIFY COLUMN name VARCHAR(150) NOT NULL;

-- ── 3. Per-learner electives + per-year offering switch ─────────────────────
CREATE TABLE IF NOT EXISTS student_electives (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  school_year_id INT NOT NULL,
  subject_id INT NOT NULL,
  strand_track_id INT NULL COMMENT 'Track context at assignment time (audit trail)',
  assigned_by INT NULL,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_student_elective_sy (student_id, school_year_id, subject_id),
  FOREIGN KEY (student_id)          REFERENCES students(id)        ON DELETE CASCADE,
  FOREIGN KEY (school_year_id)      REFERENCES school_years(id)    ON DELETE CASCADE,
  FOREIGN KEY (subject_id)          REFERENCES subjects(id)        ON DELETE CASCADE,
  FOREIGN KEY (strand_track_id)     REFERENCES strand_tracks(id)   ON DELETE SET NULL,
  FOREIGN KEY (assigned_by)         REFERENCES users(id)           ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A row = the elective is switched OFF for that school year. Missing row = ON
-- ("assume DSPMNHS offers every elective"), so seeding stays idempotent and the
-- Administrator adds exclusions only for what the school does not offer.
CREATE TABLE IF NOT EXISTS elective_year_exclusions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  school_year_id INT NOT NULL,
  subject_id INT NOT NULL,
  excluded_by INT NULL,
  created_at DATETIME DEFAULT NOW(),
  UNIQUE KEY uk_elective_excl_sy (school_year_id, subject_id),
  FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id)     REFERENCES subjects(id)     ON DELETE CASCADE,
  FOREIGN KEY (excluded_by)    REFERENCES users(id)        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 4. Close the legacy SHS core offering (deactivate, NOT delete) ──────────
--   New Grade-11 core "General Mathematics" reuses the existing G11 row (same
--   official name, same grade level) so any existing rows on it keep meaning.
--   The old shared G11/G12 cores must go inactive, otherwise students on the
--   new tracks would still see the old-curriculum subjects on their cards.
--   Deactivation is reversible and preserves every historical grade row.
UPDATE subjects SET is_active = 0
 WHERE grade_level >= 11
   AND subject_type = 'core'
   AND program IS NULL
   AND name <> 'General Mathematics';

-- ── 5. Seed the Grade-11 core subjects (exact official names) ───────────────
--   Grade 11 only, both tracks (program NULL = shared), not elective-selectable.
--   160 total hours per subject cannot be represented in hours_per_week (weekly
--   metric) — hours are intentionally left NULL (see doc limitation note).
INSERT IGNORE INTO subjects (name, grade_level, hours_per_week, subject_type, program, is_active) VALUES
('Effective Communication / Mabisang Komunikasyon',    11, NULL, 'core', NULL, 1),
('Pag-aaral ng Kasaysayan at Lipunang Pilipino',       11, NULL, 'core', NULL, 1),
('Life and Career Skills',                             11, NULL, 'core', NULL, 1),
('General Science',                                    11, NULL, 'core', NULL, 1);

-- ── 6. Seed Work Immersion (Grade 12, auto-assigned via learner scope) ──────
INSERT IGNORE INTO subjects (name, grade_level, hours_per_week, subject_type, program, is_active) VALUES
('Work Immersion', 12, NULL, 'work_immersion', NULL, 1);

-- ── 7. Seed the elective catalog (Academic + TechPro; both grade levels) ────
--   Names preserved verbatim from the client document (Maritime Transport
--   cluster intentionally NOT seeded). Multi-line catalog entries that the
--   client annotated as two subjects (Biology/Chemistry/Physics/Earth & Space)
--   are seeded as the numbered pair; composite NC lines are kept as printed.
--   Cluster headings are fixed strings — no cluster management.
--   Each elective exists as a Grade 11 row AND a Grade 12 row (same id family
--   per year, matched by name during carryover).

-- Academic — Arts, Social Sciences, and Humanities
INSERT IGNORE INTO subjects (name, grade_level, hours_per_week, subject_type, elective_cluster, program, is_active) VALUES
('Contemporary Literature 1',                                  11, NULL, 'elective', 'Arts, Social Sciences, and Humanities', NULL, 1),
('Creative Composition 1 / Malikhaing Pagsulat',               11, NULL, 'elective', 'Arts, Social Sciences, and Humanities', NULL, 1),
('Arts 1 (Creative Industries 1: Visual Art, Literary Art, Media Art, Applied Art, and Traditional Arts)', 11, NULL, 'elective', 'Arts, Social Sciences, and Humanities', NULL, 1),
('Arts 2 (Creative Industries 2: Music, Dance, and Theater Arts)', 11, NULL, 'elective', 'Arts, Social Sciences, and Humanities', NULL, 1),
('Filipino 1 (Wika at Komunikasyon sa Akademikong Filipino)',  11, NULL, 'elective', 'Arts, Social Sciences, and Humanities', NULL, 1),
('Introduction to Philosophy',                                 11, NULL, 'elective', 'Arts, Social Sciences, and Humanities', NULL, 1),
('Contemporary Literature 1',                                  12, NULL, 'elective', 'Arts, Social Sciences, and Humanities', NULL, 1),
('Creative Composition 1 / Malikhaing Pagsulat',               12, NULL, 'elective', 'Arts, Social Sciences, and Humanities', NULL, 1),
('Arts 1 (Creative Industries 1: Visual Art, Literary Art, Media Art, Applied Art, and Traditional Arts)', 12, NULL, 'elective', 'Arts, Social Sciences, and Humanities', NULL, 1),
('Arts 2 (Creative Industries 2: Music, Dance, and Theater Arts)', 12, NULL, 'elective', 'Arts, Social Sciences, and Humanities', NULL, 1),
('Filipino 1 (Wika at Komunikasyon sa Akademikong Filipino)',  12, NULL, 'elective', 'Arts, Social Sciences, and Humanities', NULL, 1),
('Introduction to Philosophy',                                 12, NULL, 'elective', 'Arts, Social Sciences, and Humanities', NULL, 1);

-- Academic — Social Sciences (Theory and Practice)
INSERT IGNORE INTO subjects (name, grade_level, hours_per_week, subject_type, elective_cluster, program, is_active) VALUES
('Philippine Governance (Philippine Politics and Governance)', 11, NULL, 'elective', 'Social Sciences (Theory and Practice)', NULL, 1),
('Citizenship and Civic Engagement',                           11, NULL, 'elective', 'Social Sciences (Theory and Practice)', NULL, 1),
('Contemporary Literature 2',                                  11, NULL, 'elective', 'Social Sciences (Theory and Practice)', NULL, 1),
('Creative Composition 2',                                     11, NULL, 'elective', 'Social Sciences (Theory and Practice)', NULL, 1),
('Filipino Identity Through the Arts',                         11, NULL, 'elective', 'Social Sciences (Theory and Practice)', NULL, 1),
('Filipino 2 (Filipino sa Larang Teknikal-Propesyonal)',       11, NULL, 'elective', 'Social Sciences (Theory and Practice)', NULL, 1),
('Filipino 2 (Filipino sa Isports)',                           11, NULL, 'elective', 'Social Sciences (Theory and Practice)', NULL, 1),
('Filipino 2 (Filipino sa Sining at Disenyo)',                 11, NULL, 'elective', 'Social Sciences (Theory and Practice)', NULL, 1),
('Leadership and Management in the Arts',                      11, NULL, 'elective', 'Social Sciences (Theory and Practice)', NULL, 1),
('Philippine Governance (Philippine Politics and Governance)', 12, NULL, 'elective', 'Social Sciences (Theory and Practice)', NULL, 1),
('Citizenship and Civic Engagement',                           12, NULL, 'elective', 'Social Sciences (Theory and Practice)', NULL, 1),
('Contemporary Literature 2',                                  12, NULL, 'elective', 'Social Sciences (Theory and Practice)', NULL, 1),
('Creative Composition 2',                                     12, NULL, 'elective', 'Social Sciences (Theory and Practice)', NULL, 1),
('Filipino Identity Through the Arts',                         12, NULL, 'elective', 'Social Sciences (Theory and Practice)', NULL, 1),
('Filipino 2 (Filipino sa Larang Teknikal-Propesyonal)',       12, NULL, 'elective', 'Social Sciences (Theory and Practice)', NULL, 1),
('Filipino 2 (Filipino sa Isports)',                           12, NULL, 'elective', 'Social Sciences (Theory and Practice)', NULL, 1),
('Filipino 2 (Filipino sa Sining at Disenyo)',                 12, NULL, 'elective', 'Social Sciences (Theory and Practice)', NULL, 1),
('Leadership and Management in the Arts',                      12, NULL, 'elective', 'Social Sciences (Theory and Practice)', NULL, 1);

-- Academic — Business and Entrepreneurship
INSERT IGNORE INTO subjects (name, grade_level, hours_per_week, subject_type, elective_cluster, program, is_active) VALUES
('Business 1 (Basic Accounting)',                              11, NULL, 'elective', 'Business and Entrepreneurship', NULL, 1),
('Introduction to Organization and Management',                11, NULL, 'elective', 'Business and Entrepreneurship', NULL, 1),
('Business 2 (Business Finance and Income Taxation)',          11, NULL, 'elective', 'Business and Entrepreneurship', NULL, 1),
('Business 3 (Business Economics)',                            11, NULL, 'elective', 'Business and Entrepreneurship', NULL, 1),
('Contemporary Marketing',                                     11, NULL, 'elective', 'Business and Entrepreneurship', NULL, 1),
('Entrepreneurship',                                           11, NULL, 'elective', 'Business and Entrepreneurship', NULL, 1),
('Business 1 (Basic Accounting)',                              12, NULL, 'elective', 'Business and Entrepreneurship', NULL, 1),
('Introduction to Organization and Management',                12, NULL, 'elective', 'Business and Entrepreneurship', NULL, 1),
('Business 2 (Business Finance and Income Taxation)',          12, NULL, 'elective', 'Business and Entrepreneurship', NULL, 1),
('Business 3 (Business Economics)',                            12, NULL, 'elective', 'Business and Entrepreneurship', NULL, 1),
('Contemporary Marketing',                                     12, NULL, 'elective', 'Business and Entrepreneurship', NULL, 1),
('Entrepreneurship',                                           12, NULL, 'elective', 'Business and Entrepreneurship', NULL, 1);

-- Academic — STEM (Earth & Space split per the client's "1 and 2" annotation;
-- numbering still pending DepEd Memo 12 s. 2026 verification)
INSERT IGNORE INTO subjects (name, grade_level, hours_per_week, subject_type, elective_cluster, program, is_active) VALUES
('Finite Mathematics 1',                                       11, NULL, 'elective', 'Science, Technology, Engineering, and Mathematics (STEM)', NULL, 1),
('Finite Mathematics 2',                                       11, NULL, 'elective', 'Science, Technology, Engineering, and Mathematics (STEM)', NULL, 1),
('Biology 1',                                                  11, NULL, 'elective', 'Science, Technology, Engineering, and Mathematics (STEM)', NULL, 1),
('Biology 2',                                                  11, NULL, 'elective', 'Science, Technology, Engineering, and Mathematics (STEM)', NULL, 1),
('Chemistry 1',                                                11, NULL, 'elective', 'Science, Technology, Engineering, and Mathematics (STEM)', NULL, 1),
('Chemistry 2',                                                11, NULL, 'elective', 'Science, Technology, Engineering, and Mathematics (STEM)', NULL, 1),
('Earth and Space Science 1',                                  11, NULL, 'elective', 'Science, Technology, Engineering, and Mathematics (STEM)', NULL, 1),
('Earth and Space Science 2',                                  11, NULL, 'elective', 'Science, Technology, Engineering, and Mathematics (STEM)', NULL, 1),
('Physics 1',                                                  11, NULL, 'elective', 'Science, Technology, Engineering, and Mathematics (STEM)', NULL, 1),
('Physics 2',                                                  11, NULL, 'elective', 'Science, Technology, Engineering, and Mathematics (STEM)', NULL, 1),
('Finite Mathematics 1',                                       12, NULL, 'elective', 'Science, Technology, Engineering, and Mathematics (STEM)', NULL, 1),
('Finite Mathematics 2',                                       12, NULL, 'elective', 'Science, Technology, Engineering, and Mathematics (STEM)', NULL, 1),
('Biology 1',                                                  12, NULL, 'elective', 'Science, Technology, Engineering, and Mathematics (STEM)', NULL, 1),
('Biology 2',                                                  12, NULL, 'elective', 'Science, Technology, Engineering, and Mathematics (STEM)', NULL, 1),
('Chemistry 1',                                                12, NULL, 'elective', 'Science, Technology, Engineering, and Mathematics (STEM)', NULL, 1),
('Chemistry 2',                                                12, NULL, 'elective', 'Science, Technology, Engineering, and Mathematics (STEM)', NULL, 1),
('Earth and Space Science 1',                                  12, NULL, 'elective', 'Science, Technology, Engineering, and Mathematics (STEM)', NULL, 1),
('Earth and Space Science 2',                                  12, NULL, 'elective', 'Science, Technology, Engineering, and Mathematics (STEM)', NULL, 1),
('Physics 1',                                                  12, NULL, 'elective', 'Science, Technology, Engineering, and Mathematics (STEM)', NULL, 1),
('Physics 2',                                                  12, NULL, 'elective', 'Science, Technology, Engineering, and Mathematics (STEM)', NULL, 1);

-- Academic — Sports, Health, and Wellness
INSERT IGNORE INTO subjects (name, grade_level, hours_per_week, subject_type, elective_cluster, program, is_active) VALUES
('Human Movement 1 (Basic Anatomy in Sports and Exercise)',    11, NULL, 'elective', 'Sports, Health, and Wellness', NULL, 1),
('Human Movement 2 (Motor Skills Development)',                11, NULL, 'elective', 'Sports, Health, and Wellness', NULL, 1),
('Physical Education 1 (Fitness and Recreation)',              11, NULL, 'elective', 'Sports, Health, and Wellness', NULL, 1),
('Physical Education 2 (Sports and Dance)',                    11, NULL, 'elective', 'Sports, Health, and Wellness', NULL, 1),
('Sports Activity Management',                                 11, NULL, 'elective', 'Sports, Health, and Wellness', NULL, 1),
('Sports Coaching',                                            11, NULL, 'elective', 'Sports, Health, and Wellness', NULL, 1),
('Sports Officiating',                                         11, NULL, 'elective', 'Sports, Health, and Wellness', NULL, 1),
('Human Movement 1 (Basic Anatomy in Sports and Exercise)',    12, NULL, 'elective', 'Sports, Health, and Wellness', NULL, 1),
('Human Movement 2 (Motor Skills Development)',                12, NULL, 'elective', 'Sports, Health, and Wellness', NULL, 1),
('Physical Education 1 (Fitness and Recreation)',              12, NULL, 'elective', 'Sports, Health, and Wellness', NULL, 1),
('Physical Education 2 (Sports and Dance)',                    12, NULL, 'elective', 'Sports, Health, and Wellness', NULL, 1),
('Sports Activity Management',                                 12, NULL, 'elective', 'Sports, Health, and Wellness', NULL, 1),
('Sports Coaching',                                            12, NULL, 'elective', 'Sports, Health, and Wellness', NULL, 1),
('Sports Officiating',                                         12, NULL, 'elective', 'Sports, Health, and Wellness', NULL, 1);

-- TechPro — Aesthetic, Wellness, and Human Care
INSERT IGNORE INTO subjects (name, grade_level, hours_per_week, subject_type, elective_cluster, program, is_active) VALUES
('Aesthetic Services (Beauty Care), NC II',                    11, NULL, 'elective', 'Aesthetic, Wellness, and Human Care', NULL, 1),
('Barbering Services, NC II',                                  11, NULL, 'elective', 'Aesthetic, Wellness, and Human Care', NULL, 1),
('Caregiving (Adult Care), NC II',                             11, NULL, 'elective', 'Aesthetic, Wellness, and Human Care', NULL, 1),
('Caregiving (Child Care), NC II',                             11, NULL, 'elective', 'Aesthetic, Wellness, and Human Care', NULL, 1),
('Hairdressing Services, NC II',                               11, NULL, 'elective', 'Aesthetic, Wellness, and Human Care', NULL, 1),
('Aesthetic Services (Beauty Care), NC II',                    12, NULL, 'elective', 'Aesthetic, Wellness, and Human Care', NULL, 1),
('Barbering Services, NC II',                                  12, NULL, 'elective', 'Aesthetic, Wellness, and Human Care', NULL, 1),
('Caregiving (Adult Care), NC II',                             12, NULL, 'elective', 'Aesthetic, Wellness, and Human Care', NULL, 1),
('Caregiving (Child Care), NC II',                             12, NULL, 'elective', 'Aesthetic, Wellness, and Human Care', NULL, 1),
('Hairdressing Services, NC II',                               12, NULL, 'elective', 'Aesthetic, Wellness, and Human Care', NULL, 1);

-- TechPro — Agri-Fishery Business and Food Innovation
INSERT IGNORE INTO subjects (name, grade_level, hours_per_week, subject_type, elective_cluster, program, is_active) VALUES
('Agricultural Crops Production, NC II',                       11, NULL, 'elective', 'Agri-Fishery Business and Food Innovation', NULL, 1),
('Agro-Entrepreneurship, NC II',                               11, NULL, 'elective', 'Agri-Fishery Business and Food Innovation', NULL, 1),
('Aquaculture, NC II',                                         11, NULL, 'elective', 'Agri-Fishery Business and Food Innovation', NULL, 1),
('Fish Capture, NC II',                                        11, NULL, 'elective', 'Agri-Fishery Business and Food Innovation', NULL, 1),
('Food Processing, NC II',                                     11, NULL, 'elective', 'Agri-Fishery Business and Food Innovation', NULL, 1),
('Organic Agriculture Production, NC II',                      11, NULL, 'elective', 'Agri-Fishery Business and Food Innovation', NULL, 1),
('Poultry Production (Chicken), NC II',                        11, NULL, 'elective', 'Agri-Fishery Business and Food Innovation', NULL, 1),
('Ruminants Production, NC II',                                11, NULL, 'elective', 'Agri-Fishery Business and Food Innovation', NULL, 1),
('Swine Production, NC II',                                    11, NULL, 'elective', 'Agri-Fishery Business and Food Innovation', NULL, 1),
('Agricultural Crops Production, NC II',                       12, NULL, 'elective', 'Agri-Fishery Business and Food Innovation', NULL, 1),
('Agro-Entrepreneurship, NC II',                               12, NULL, 'elective', 'Agri-Fishery Business and Food Innovation', NULL, 1),
('Aquaculture, NC II',                                         12, NULL, 'elective', 'Agri-Fishery Business and Food Innovation', NULL, 1),
('Fish Capture, NC II',                                        12, NULL, 'elective', 'Agri-Fishery Business and Food Innovation', NULL, 1),
('Food Processing, NC II',                                     12, NULL, 'elective', 'Agri-Fishery Business and Food Innovation', NULL, 1),
('Organic Agriculture Production, NC II',                      12, NULL, 'elective', 'Agri-Fishery Business and Food Innovation', NULL, 1),
('Poultry Production (Chicken), NC II',                        12, NULL, 'elective', 'Agri-Fishery Business and Food Innovation', NULL, 1),
('Ruminants Production, NC II',                                12, NULL, 'elective', 'Agri-Fishery Business and Food Innovation', NULL, 1),
('Swine Production, NC II',                                    12, NULL, 'elective', 'Agri-Fishery Business and Food Innovation', NULL, 1);

-- TechPro — Artisanry and Creative Enterprise
INSERT IGNORE INTO subjects (name, grade_level, hours_per_week, subject_type, elective_cluster, program, is_active) VALUES
('Garments and Artisanry, NC II',                              11, NULL, 'elective', 'Artisanry and Creative Enterprise', NULL, 1),
('Handicrafts (Weaving), NC II',                               11, NULL, 'elective', 'Artisanry and Creative Enterprise', NULL, 1),
('Garments and Artisanry, NC II',                              12, NULL, 'elective', 'Artisanry and Creative Enterprise', NULL, 1),
('Handicrafts (Weaving), NC II',                               12, NULL, 'elective', 'Artisanry and Creative Enterprise', NULL, 1);

-- TechPro — Automotive and Small Engine Technologies
INSERT IGNORE INTO subjects (name, grade_level, hours_per_week, subject_type, elective_cluster, program, is_active) VALUES
('Automotive Servicing (Electrical Repair), NC II',            11, NULL, 'elective', 'Automotive and Small Engine Technologies', NULL, 1),
('Automotive Servicing (Engine and Chassis Repair), NC II',    11, NULL, 'elective', 'Automotive and Small Engine Technologies', NULL, 1),
('Driving and Automotive Servicing, NC I and NC II',           11, NULL, 'elective', 'Automotive and Small Engine Technologies', NULL, 1),
('Motorcycle and Small Engine Servicing, NC II',               11, NULL, 'elective', 'Automotive and Small Engine Technologies', NULL, 1),
('Automotive Servicing (Electrical Repair), NC II',            12, NULL, 'elective', 'Automotive and Small Engine Technologies', NULL, 1),
('Automotive Servicing (Engine and Chassis Repair), NC II',    12, NULL, 'elective', 'Automotive and Small Engine Technologies', NULL, 1),
('Driving and Automotive Servicing, NC I and NC II',           12, NULL, 'elective', 'Automotive and Small Engine Technologies', NULL, 1),
('Motorcycle and Small Engine Servicing, NC II',               12, NULL, 'elective', 'Automotive and Small Engine Technologies', NULL, 1);

-- TechPro — Construction and Building Technologies
INSERT IGNORE INTO subjects (name, grade_level, hours_per_week, subject_type, elective_cluster, program, is_active) VALUES
('Carpentry, NC I and NC II',                                  11, NULL, 'elective', 'Construction and Building Technologies', NULL, 1),
('Construction Operation, NC I and NC II',                     11, NULL, 'elective', 'Construction and Building Technologies', NULL, 1),
('Manual Metal Arc Welding, NC I and/or NC II',                11, NULL, 'elective', 'Construction and Building Technologies', NULL, 1),
('Technical Drafting, NC II',                                  11, NULL, 'elective', 'Construction and Building Technologies', NULL, 1),
('Carpentry, NC I and NC II',                                  12, NULL, 'elective', 'Construction and Building Technologies', NULL, 1),
('Construction Operation, NC I and NC II',                     12, NULL, 'elective', 'Construction and Building Technologies', NULL, 1),
('Manual Metal Arc Welding, NC I and/or NC II',                12, NULL, 'elective', 'Construction and Building Technologies', NULL, 1),
('Technical Drafting, NC II',                                  12, NULL, 'elective', 'Construction and Building Technologies', NULL, 1);

-- TechPro — Creative Arts and Design Technologies
INSERT IGNORE INTO subjects (name, grade_level, hours_per_week, subject_type, elective_cluster, program, is_active) VALUES
('Animation, NC II',                                           11, NULL, 'elective', 'Creative Arts and Design Technologies', NULL, 1),
('Illustration, NC II',                                        11, NULL, 'elective', 'Creative Arts and Design Technologies', NULL, 1),
('Visual Graphic Design, NC II',                               11, NULL, 'elective', 'Creative Arts and Design Technologies', NULL, 1),
('Animation, NC II',                                           12, NULL, 'elective', 'Creative Arts and Design Technologies', NULL, 1),
('Illustration, NC II',                                        12, NULL, 'elective', 'Creative Arts and Design Technologies', NULL, 1),
('Visual Graphic Design, NC II',                               12, NULL, 'elective', 'Creative Arts and Design Technologies', NULL, 1);

-- TechPro — Hospitality and Tourism
INSERT IGNORE INTO subjects (name, grade_level, hours_per_week, subject_type, elective_cluster, program, is_active) VALUES
('Bakery Operations, NC II',                                   11, NULL, 'elective', 'Hospitality and Tourism', NULL, 1),
('Events Management Services, NC II',                          11, NULL, 'elective', 'Hospitality and Tourism', NULL, 1),
('Food and Beverage Operations, NC II',                        11, NULL, 'elective', 'Hospitality and Tourism', NULL, 1),
('Hotel Operations (Front Office Services), NC II',            11, NULL, 'elective', 'Hospitality and Tourism', NULL, 1),
('Hotel Operations (Housekeeping Services), NC II',            11, NULL, 'elective', 'Hospitality and Tourism', NULL, 1),
('Kitchen Operations, NC II',                                  11, NULL, 'elective', 'Hospitality and Tourism', NULL, 1),
('Tourism Services, NC II',                                    11, NULL, 'elective', 'Hospitality and Tourism', NULL, 1),
('Bakery Operations, NC II',                                   12, NULL, 'elective', 'Hospitality and Tourism', NULL, 1),
('Events Management Services, NC II',                          12, NULL, 'elective', 'Hospitality and Tourism', NULL, 1),
('Food and Beverage Operations, NC II',                        12, NULL, 'elective', 'Hospitality and Tourism', NULL, 1),
('Hotel Operations (Front Office Services), NC II',            12, NULL, 'elective', 'Hospitality and Tourism', NULL, 1),
('Hotel Operations (Housekeeping Services), NC II',            12, NULL, 'elective', 'Hospitality and Tourism', NULL, 1),
('Kitchen Operations, NC II',                                  12, NULL, 'elective', 'Hospitality and Tourism', NULL, 1),
('Tourism Services, NC II',                                    12, NULL, 'elective', 'Hospitality and Tourism', NULL, 1);

-- TechPro — ICT Support and Computer Programming Technologies
INSERT IGNORE INTO subjects (name, grade_level, hours_per_week, subject_type, elective_cluster, program, is_active) VALUES
('Broadband Installation, NC II',                              11, NULL, 'elective', 'ICT Support and Computer Programming Technologies', NULL, 1),
('Computer Programming (.NET Technology), NC III',             11, NULL, 'elective', 'ICT Support and Computer Programming Technologies', NULL, 1),
('Computer Programming (Java), NC III',                        11, NULL, 'elective', 'ICT Support and Computer Programming Technologies', NULL, 1),
('Computer Programming (Oracle Database), NC III',             11, NULL, 'elective', 'ICT Support and Computer Programming Technologies', NULL, 1),
('Computer Systems Servicing, NC II',                          11, NULL, 'elective', 'ICT Support and Computer Programming Technologies', NULL, 1),
('Contact Center Services, NC II',                             11, NULL, 'elective', 'ICT Support and Computer Programming Technologies', NULL, 1),
('Broadband Installation, NC II',                              12, NULL, 'elective', 'ICT Support and Computer Programming Technologies', NULL, 1),
('Computer Programming (.NET Technology), NC III',             12, NULL, 'elective', 'ICT Support and Computer Programming Technologies', NULL, 1),
('Computer Programming (Java), NC III',                        12, NULL, 'elective', 'ICT Support and Computer Programming Technologies', NULL, 1),
('Computer Programming (Oracle Database), NC III',             12, NULL, 'elective', 'ICT Support and Computer Programming Technologies', NULL, 1),
('Computer Systems Servicing, NC II',                          12, NULL, 'elective', 'ICT Support and Computer Programming Technologies', NULL, 1),
('Contact Center Services, NC II',                             12, NULL, 'elective', 'ICT Support and Computer Programming Technologies', NULL, 1);

-- TechPro — Industrial Technologies
INSERT IGNORE INTO subjects (name, grade_level, hours_per_week, subject_type, elective_cluster, program, is_active) VALUES
('Commercial Air-Conditioning Installation and Servicing, NC III', 11, NULL, 'elective', 'Industrial Technologies', NULL, 1),
('Domestic Refrigeration and Air-Conditioning Servicing, NC II',   11, NULL, 'elective', 'Industrial Technologies', NULL, 1),
('Electrical Installation Maintenance, NC II',                     11, NULL, 'elective', 'Industrial Technologies', NULL, 1),
('Electronic Product and Assembly Servicing, NC II',               11, NULL, 'elective', 'Industrial Technologies', NULL, 1),
('Mechatronics, NC II',                                            11, NULL, 'elective', 'Industrial Technologies', NULL, 1),
('Photovoltaic Systems Installation, NC II',                       11, NULL, 'elective', 'Industrial Technologies', NULL, 1),
('Commercial Air-Conditioning Installation and Servicing, NC III', 12, NULL, 'elective', 'Industrial Technologies', NULL, 1),
('Domestic Refrigeration and Air-Conditioning Servicing, NC II',   12, NULL, 'elective', 'Industrial Technologies', NULL, 1),
('Electrical Installation Maintenance, NC II',                     12, NULL, 'elective', 'Industrial Technologies', NULL, 1),
('Electronic Product and Assembly Servicing, NC II',               12, NULL, 'elective', 'Industrial Technologies', NULL, 1),
('Mechatronics, NC II',                                            12, NULL, 'elective', 'Industrial Technologies', NULL, 1),
('Photovoltaic Systems Installation, NC II',                       12, NULL, 'elective', 'Industrial Technologies', NULL, 1);

-- ── 8. Link electives to their tracks (subject_strand_tracks) ───────────────
--   Track-scoped subjects only surface to learners ON that track
--   (subjectScopeSql clause 119-123), so the Academic catalog must link to
--   shs_academic and the TechPro catalog to shs_techpro. Cross-track picks are
--   still allowed through student_electives (scoped separately in code).
INSERT IGNORE INTO subject_strand_tracks (subject_id, strand_track_id)
SELECT s.id, t.id
  FROM subjects s
  JOIN strand_tracks t
    ON ( (t.code = 'shs_academic' AND s.elective_cluster IN (
            'Arts, Social Sciences, and Humanities',
            'Social Sciences (Theory and Practice)',
            'Business and Entrepreneurship',
            'Science, Technology, Engineering, and Mathematics (STEM)',
            'Sports, Health, and Wellness'))
      OR (t.code = 'shs_techpro' AND s.elective_cluster IN (
            'Aesthetic, Wellness, and Human Care',
            'Agri-Fishery Business and Food Innovation',
            'Artisanry and Creative Enterprise',
            'Automotive and Small Engine Technologies',
            'Construction and Building Technologies',
            'Creative Arts and Design Technologies',
            'Hospitality and Tourism',
            'ICT Support and Computer Programming Technologies',
            'Industrial Technologies')) )
 WHERE s.subject_type = 'elective' AND s.grade_level IN (11, 12);
