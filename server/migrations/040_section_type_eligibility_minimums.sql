-- Migration 040: Sectioning eligibility minimums (Grade Thresholds screen v2).
--
-- Repurposes the Auto-Sectioning Grade Thresholds screen from per-grade
-- min/max average RANGES to per-program ELIGIBILITY MINIMUMS:
--   STE        -> General Average minimum AND Science & Mathematics minimums
--   SPFL       -> English & Filipino minimums (no General Average rule)
--   SPJ        -> General Average minimum AND English & Filipino minimums
--   Regular    -> General Average minimum (passing grade; never blocks
--                 placement — below-minimum students are retained, not
--                 excluded, and still land in a Regular section)
--   Non-Reader -> NO minimum and NO maximum (teacher-tagged only; fields are
--                 stored empty, never 0 or 100)
--   ALS / Open High School: placed manually, never auto-sectioned; not listed
--                 on the screen (they are enrollment programs, not section types).
--
-- These minimums are the enrollment criteria used by the Auto-Sectioning
-- eligibility preview (rules engine) and drive TC-05/TC-07 in the paper.
-- Changes apply to future sectioning runs only; already-sectioned students
-- are unaffected.

-- 1. New eligibility minimum columns (all nullable: NULL = no rule of that kind).
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'section_type_config'
    AND COLUMN_NAME = 'min_general_average'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE section_type_config
     ADD COLUMN min_general_average DECIMAL(5,2) NULL AFTER max_average,
     ADD COLUMN min_science DECIMAL(5,2) NULL AFTER min_general_average,
     ADD COLUMN min_math DECIMAL(5,2) NULL AFTER min_science,
     ADD COLUMN min_english DECIMAL(5,2) NULL AFTER min_math,
     ADD COLUMN min_filipino DECIMAL(5,2) NULL AFTER min_english',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Seed the school's paper-defined criteria (only when the columns are unset,
--    i.e. NULL — never clobber values the Administrator already saved).
UPDATE section_type_config SET
  min_general_average = IFNULL(min_general_average, 85),
  min_science         = IFNULL(min_science, 85),
  min_math            = IFNULL(min_math, 85)
WHERE section_type = 'ste';

UPDATE section_type_config SET
  min_english  = IFNULL(min_english, 85),
  min_filipino = IFNULL(min_filipino, 85)
WHERE section_type = 'spfl';

UPDATE section_type_config SET
  min_general_average = IFNULL(min_general_average, 85),
  min_english         = IFNULL(min_english, 85),
  min_filipino        = IFNULL(min_filipino, 85)
WHERE section_type = 'spj';

UPDATE section_type_config SET
  min_general_average = IFNULL(min_general_average, 75)
WHERE section_type = 'regular';

-- 3. Non-Reader: no minimum and no maximum — stored empty (NULL), never 0/100.
UPDATE section_type_config SET
  min_general_average = NULL, min_science = NULL, min_math = NULL,
  min_english = NULL, min_filipino = NULL
WHERE section_type = 'non_reader';

-- 4. Keep the legacy range columns coherent for any consumer still reading
--    them: min_average mirrors the new GA floor (0 for Non-Reader types),
--    max_average opens the full range (no more per-type ceilings).
UPDATE section_type_config SET min_average = 0, max_average = 100
WHERE section_type IN ('non_reader');

UPDATE section_type_config SET max_average = 100
WHERE section_type IN ('ste', 'regular', 'spfl', 'spj')
  AND max_average < 100;

-- 5. Sync per-section minimums so a section can never admit a student its
--    type's rule rejects (section minimum may exceed the type minimum, but
--    never fall below it).
UPDATE sections s JOIN section_type_config c
  ON c.section_type = s.section_type AND c.grade_level = s.grade_level
SET s.min_average = GREATEST(s.min_average, c.min_general_average)
WHERE c.min_general_average IS NOT NULL;
