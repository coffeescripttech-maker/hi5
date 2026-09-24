-- ============================================================
-- Migration 033: Graduated students' enrollment records → Completed
-- After a student graduates, every enrollment record they hold
-- should read "Completed", not "Enrolled" (they completed each
-- school year). The graduation flows (single completer + batch
-- "Mark as Completers") now flip all rows automatically; this
-- migration fixes the rows that existed before that change.
-- Idempotent: re-running it updates nothing.
-- ============================================================

UPDATE enrollments e
JOIN students s ON s.id = e.student_id
SET e.status = 'completed',
    e.remarks = COALESCE(NULLIF(e.remarks, ''), 'Grade 12 completed')
WHERE s.status = 'graduated'
  AND e.status <> 'completed';