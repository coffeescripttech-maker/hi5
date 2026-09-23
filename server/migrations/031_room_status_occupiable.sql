-- 031: Fix rooms.status CHECK so Room Management can mark rooms Occupied
-- ==========================================================================
-- 029 (room_occupied) only widened the CHECK on databases where it had run.
-- If it was never applied (environment drift), the original status CHECK
-- still forbids 'Occupied', so every schedule save that syncs the room
-- (create/update/delete) fails with ER_CHECK_CONSTRAINT_VIOLATED.
--
-- This migration is idempotent and safe no matter which CHECK variants exist:
-- it drops every known rooms CHECK and recreates both modern ones
-- (room_type + status with 'Occupied').

-- Drop known legacy CHECKs (each guarded; no-op when absent).
SET @c1 := (
  SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rooms'
    AND CONSTRAINT_NAME = 'rooms_chk_1' LIMIT 1
);
SET @s1 := IF(@c1 IS NULL, 'SELECT 1', 'ALTER TABLE rooms DROP CHECK rooms_chk_1');
PREPARE p1 FROM @s1; EXECUTE p1; DEALLOCATE PREPARE p1;

SET @c2 := (
  SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rooms'
    AND CONSTRAINT_NAME = 'rooms_chk_2' LIMIT 1
);
SET @s2 := IF(@c2 IS NULL, 'SELECT 1', 'ALTER TABLE rooms DROP CHECK rooms_chk_2');
PREPARE p2 FROM @s2; EXECUTE p2; DEALLOCATE PREPARE p2;

SET @c3 := (
  SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rooms'
    AND CONSTRAINT_NAME = 'rooms_status_chk' LIMIT 1
);
SET @s3 := IF(@c3 IS NULL, 'SELECT 1', 'ALTER TABLE rooms DROP CHECK rooms_status_chk');
PREPARE p3 FROM @s3; EXECUTE p3; DEALLOCATE PREPARE p3;

-- Recreate the modern constraints.
ALTER TABLE rooms
  ADD CONSTRAINT rooms_chk_1 CHECK (room_type IN ('Classroom','Laboratory','Computer Laboratory','Lecture Hall','Other')),
  ADD CONSTRAINT rooms_chk_2 CHECK (status IN ('Available','Maintenance','Inactive','Occupied'));