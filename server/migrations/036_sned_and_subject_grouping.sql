-- ─────────────────────────────────────────────────────────────────────────────
-- 036 — Curriculum & Student Tagging
--   1. SNED (Student with Special Needs) classification
--   2. PWD ⇒ SNED backfill for existing tagged students
--   3. Repair corrupted empty classification rows (balik_aral was accepted by
--      the API but missing from the ENUM, so it was silently stored as '')
--   4. subjects.subject_group — grouping key so specialized areas (TLE
--      specializations) are reported directly under their main subject
--   5. TLE specialization subject rows (G7–G10) linked to their tle_* track
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add 'sned' (plus the missing 'balik_aral') to the classification ENUM.
ALTER TABLE student_classifications
  MODIFY COLUMN classification
    ENUM('4ps','pwd','sned','transferee','non_reader','balik_aral','regular') NOT NULL;

-- 3. Drop rows corrupted by the ENUM gap (empty string is not a valid class).
DELETE FROM student_classifications WHERE classification = '' OR classification IS NULL;

-- 2. Every PWD-tagged student is also a SNED-tagged student.
INSERT IGNORE INTO student_classifications (student_id, classification, school_year_id)
SELECT student_id, 'sned', school_year_id
FROM student_classifications
WHERE classification = 'pwd';

-- 4. Grouping key on subjects (NULL = standalone subject).
--    Convention mirrors the existing MAPEH collapse: all rows sharing a group are
--    reported under one heading, so the general average counts the group once.
ALTER TABLE subjects
  ADD COLUMN subject_group VARCHAR(50) NULL
    COMMENT 'Reporting group key — NULL = standalone subject';

-- 4b. The main TLE/EPP subject heads the TLE group.
UPDATE subjects
SET subject_group = 'tle'
WHERE name = 'TLE/EPP' AND subject_group IS NULL;

-- 5. TLE specialization learning areas for JHS (G7–G10). Each is its own subject
--    row linked to the matching strand track, so students see only their own
--    specialization while every specialization reports under the main TLE group.
INSERT IGNORE INTO subjects (name, grade_level, hours_per_week, subject_type, subject_group)
SELECT t.name, gl.grade_level, 3, 'specialized', 'tle'
FROM strand_tracks t
CROSS JOIN (
  SELECT 7 AS grade_level UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10
) gl
WHERE t.track_type = 'tle' AND t.is_active = 1;

INSERT IGNORE INTO subject_strand_tracks (subject_id, strand_track_id)
SELECT s.id, t.id
FROM subjects s
JOIN strand_tracks t
  ON t.name = s.name AND t.track_type = 'tle'
WHERE s.subject_group = 'tle'
  AND s.name <> 'TLE/EPP'
  AND s.subject_type = 'specialized';