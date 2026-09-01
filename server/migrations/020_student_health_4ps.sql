-- Migration 020: Student health info + guardian 4Ps flag
-- Backward-compatible: nullable columns with defaults, no data changes
ALTER TABLE students
  ADD COLUMN height_cm DECIMAL(5,1) NULL AFTER contact,
  ADD COLUMN weight_kg DECIMAL(5,1) NULL AFTER height_cm,
  ADD COLUMN guardian_4ps TINYINT(1) NOT NULL DEFAULT 0 AFTER weight_kg;
