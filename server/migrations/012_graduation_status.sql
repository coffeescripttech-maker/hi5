-- ============================================================
-- Migration 012: Graduation Status
-- Adds 'completed' to enrollments.status for Grade 12 completers
-- ============================================================

ALTER TABLE enrollments
  MODIFY COLUMN status ENUM('enrolled', 'dropped', 'transferred', 'completed') NOT NULL DEFAULT 'enrolled';
