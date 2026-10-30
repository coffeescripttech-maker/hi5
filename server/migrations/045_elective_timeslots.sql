-- ============================================================
-- Migration 045: Elective Timeslots (Strengthened SHS)
--
-- Elective classes do not belong to one section: their roster is the
-- learners who picked the elective (student_electives), which cuts across
-- sections. The schedules table, however, requires a NOT NULL section_id,
-- so a Registrar cannot place an elective on the timetable at all.
--
-- Fix: make section_id nullable. A schedule row with section_id NULL is an
-- elective timeslot (teacher + elective subject + room); the controller
-- validates that the subject is an elective type in that case. The
-- uk_section_time unique key keeps working — MySQL allows many NULLs in a
-- unique index, so several electives may share the same timeslot.
--
-- Idempotent-safe to re-run: MODIFY COLUMN is a no-op if already applied.
-- ============================================================

ALTER TABLE schedules
  MODIFY section_id INT NULL
  COMMENT 'NULL for elective timeslots — the roster is the learners who picked the elective, spanning sections';
