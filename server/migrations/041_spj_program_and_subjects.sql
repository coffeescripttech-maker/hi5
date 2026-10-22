-- ─────────────────────────────────────────────────────────────────────────────
-- 041 — SPJ (Special Program in Journalism) enrollment program + subjects
--
--   1. Extend enrollments.program and subjects.program ENUMs with 'spj'
--      (values keep their relative order; existing data is unaffected).
--   2. Seed the SPJ specialization subjects (D.O. 46 s. 2012 curriculum):
--      Journalism + Advanced English take the place of TLE per grade:
--        Grade 7  — Journalism I (Basic Print Journalism)  / Advanced English I (Reading to Writing)
--        Grade 8  — Journalism II (Print Journalism)       / Advanced English II (Public Speaking)
--        Grade 9  — Journalism III (Radio Journalism)      / Advanced English III (Technical Writing)
--        Grade 10 — Journalism IV (TV Journalism)          / Advanced English IV (Research)
--      ( journalistic matrix: 240 minutes/week each → 4.0 hours )
--      SPJ learners keep the shared core subjects — these 8 rows are the
--      program's additions, exactly like the STE/SPFL/ALS model.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Program enum extension (idempotent: re-run is a no-op on values+data).
ALTER TABLE enrollments
  MODIFY COLUMN program
    ENUM('regular','ste','spfl','spj','open_high','als_shs','als_jhs')
    NOT NULL DEFAULT 'regular' AFTER school_year_id;

ALTER TABLE subjects
  MODIFY COLUMN program
    ENUM('regular','ste','spfl','spj','open_high','als_shs','als_jhs') NULL DEFAULT NULL
    COMMENT 'Curriculum program this subject belongs to; NULL = shared across all programs';

-- 2. SPJ specialization subjects (only inserted when absent for that grade).
INSERT IGNORE INTO subjects (name, grade_level, hours_per_week, subject_type, subject_group, program, is_active)
SELECT j.name, j.grade_level, 4.0, 'specialized', 'spj', 'spj', 1
FROM (
  SELECT 'Journalism I (Basic Print Journalism)' AS name, 7 AS grade_level UNION ALL
  SELECT 'Advanced English I (Reading to Writing)', 7 UNION ALL
  SELECT 'Journalism II (Print Journalism)', 8 UNION ALL
  SELECT 'Advanced English II (Public Speaking)', 8 UNION ALL
  SELECT 'Journalism III (Radio Journalism)', 9 UNION ALL
  SELECT 'Advanced English III (Technical Writing)', 9 UNION ALL
  SELECT 'Journalism IV (TV Journalism)', 10 UNION ALL
  SELECT 'Advanced English IV (Research)', 10
) j;
