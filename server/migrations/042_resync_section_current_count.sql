-- 042: Re-sync the denormalized sections.current_count column to live truth.
--
-- The stored column has drifted far off-screen (e.g. section "7-Pogi": stored 26
-- vs 11 actually-enrolled) because every historical test/promotion/transfer run
-- incremented it, while tests that reset the DB did not roll it back. It is
-- read for capacity checks (promotions, transfers, enrollments) and section
-- detail views, so a stale value breaks "section full" logic and demo numbers.
-- The dashboard/section-list queries compute live counts and ignore this
-- column, so this fix only affects consumers of the stored value.
--
-- Idempotent: sets the column to the same definition the list endpoints use —
-- distinct students with an ENROLLED enrollment in the CURRENT school year.

UPDATE sections s
SET s.current_count = (
  SELECT COUNT(DISTINCT e.student_id)
  FROM enrollments e
  JOIN school_years sy ON e.school_year_id = sy.id
  WHERE e.section_id = s.id
    AND sy.is_current = 1
    AND e.status = 'enrolled'
);
