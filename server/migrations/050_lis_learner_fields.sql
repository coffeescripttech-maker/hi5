-- 050: LIS import foundations — new nullable learner detail columns
-- (docs/Hi5_Portal_LIS_Import_Expected_Behavior.md §7 "New learner columns")
-- Additive only: every column is NULL-able and no existing column is altered.
-- These stay unwired until Phase 2 (SF1) / Phase 3 (LIS import) use them.

ALTER TABLE students
  ADD COLUMN mother_tongue       VARCHAR(50)  NULL,
  ADD COLUMN ip_ethnic_group     VARCHAR(80)  NULL,
  ADD COLUMN religion            VARCHAR(60)  NULL,
  ADD COLUMN father_name         VARCHAR(150) NULL,
  ADD COLUMN mother_name         VARCHAR(150) NULL,
  ADD COLUMN guardian_relationship VARCHAR(40) NULL,
  ADD COLUMN house_street        VARCHAR(150) NULL,
  ADD COLUMN barangay            VARCHAR(80)  NULL,
  ADD COLUMN city_municipality   VARCHAR(80)  NULL,
  ADD COLUMN province            VARCHAR(80)  NULL,
  ADD COLUMN zip_code            VARCHAR(10)  NULL;

-- Shared name formatter (docs §7): separate name parts so comparison and
-- suffix handling work consistently across every form. Parts are backfilled
-- from `name` once (scripts/backfill-name-parts.ts) and kept in sync by the
-- student create/update write path.
ALTER TABLE students
  ADD COLUMN last_name    VARCHAR(75) NULL,
  ADD COLUMN first_name   VARCHAR(75) NULL,
  ADD COLUMN middle_name  VARCHAR(75) NULL,
  ADD COLUMN name_ext     VARCHAR(20) NULL;

-- LRN is the LIS match key; index it for the import matcher.
ALTER TABLE students ADD INDEX idx_students_lrn (lrn);
