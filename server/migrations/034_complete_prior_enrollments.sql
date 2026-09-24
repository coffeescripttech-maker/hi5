-- ============================================================
-- Migration 034: Prior sections of enrolled students → Completed
-- A student's only CURRENT enrollment is the newest 'enrolled' row
-- (their active section this school year). Every OLDER row with
-- status 'enrolled' belongs to a section they have already been
-- promoted from / completed, so those rows should read "Completed",
-- not "Enrolled". Graduated students' rows were already flipped by
-- migration 033 (they have no 'enrolled' rows left, so this leaves
-- them untouched).
-- Idempotent: re-running it updates nothing on a second pass.
-- ============================================================

UPDATE enrollments e
JOIN (
  SELECT x.student_id, MAX(x.school_year_id) AS current_sy
  FROM (SELECT student_id, school_year_id FROM enrollments WHERE status = 'enrolled') x
  GROUP BY x.student_id
) cur ON cur.student_id = e.student_id
SET e.status = 'completed'
WHERE e.status = 'enrolled'
  AND e.school_year_id < cur.current_sy;