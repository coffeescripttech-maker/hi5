-- ─────────────────────────────────────────────────────────────────────────────
-- 038 — ALS programs & per-program subject scoping
--
--   1. Add 'als_jhs' to enrollments.program (als_shs already exists).
--   2. subjects.program — the curriculum program a subject belongs to.
--      NULL means "shared by every program" (all core subjects), which keeps the
--      existing behaviour for every subject not explicitly scoped.
--   3. Backfill the STE / SPFL additions so they stop appearing on other
--      programs' report cards. Before this migration SF9/SF10 listed *every*
--      active subject at the learner's grade level regardless of program, so a
--      regular learner's card showed Research / Advanced Math / Advanced Science
--      / Foreign Language and all five TLE specializations at once.
--   4. Seed the ALS learning strands (LS1–LS6) as additional subjects:
--      Grades 7–10 under ALS JHS, Grades 11–12 under ALS SHS. ALS learners take
--      the regular core plus these strands (the same "additional subjects"
--      model used by STE/SPFL).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. ALS JHS joins ALS SHS in the program enum (existing values keep their order).
ALTER TABLE enrollments
  MODIFY COLUMN program
    ENUM('regular','ste','spfl','open_high','als_shs','als_jhs')
    NOT NULL DEFAULT 'regular' AFTER school_year_id;

-- 2. Per-program subject scope. NULL = available to every program.
ALTER TABLE subjects
  ADD COLUMN program ENUM('regular','ste','spfl','open_high','als_shs','als_jhs') NULL DEFAULT NULL
    COMMENT 'Curriculum program this subject belongs to; NULL = shared across all programs';

-- 3. Backfill the STE / SPFL additions created by the Subject Management presets.
UPDATE subjects SET program = 'ste'
WHERE name IN ('Research', 'Advanced Mathematics', 'Advanced Science')
  AND subject_type = 'specialized'
  AND program IS NULL;

UPDATE subjects SET program = 'spfl'
WHERE name = 'Foreign Language'
  AND program IS NULL;

-- 4. ALS learning strands (additional subjects for ALS learners).
--    subject_group NULL = standalone row (not collapsed into another group).
INSERT IGNORE INTO subjects (name, grade_level, hours_per_week, subject_type, subject_group, program, is_active)
SELECT ls.name, gl.grade_level, 4, 'core', NULL, gl.program, 1
FROM (
  SELECT 'LS1 — Communication Skills (English)' AS name UNION ALL
  SELECT 'LS2 — Communication Skills (Filipino)' UNION ALL
  SELECT 'LS3 — Scientific Literacy and Critical Thinking Skills' UNION ALL
  SELECT 'LS4 — Mathematical and Problem Solving Skills' UNION ALL
  SELECT 'LS5 — Life and Career Skills' UNION ALL
  SELECT 'LS6 — Understanding the Self and Society'
) ls
CROSS JOIN (
  SELECT 7 AS grade_level, 'als_jhs' AS program UNION ALL
  SELECT 8, 'als_jhs' UNION ALL
  SELECT 9, 'als_jhs' UNION ALL
  SELECT 10, 'als_jhs' UNION ALL
  SELECT 11, 'als_shs' UNION ALL
  SELECT 12, 'als_shs'
) gl;
