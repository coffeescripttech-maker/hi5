-- 029: Room status `Occupied`
-- =============================
-- The schedule <-> room sync marks rooms as `Occupied` while a class is in
-- session and back to `Available` when it ends. This widens the rooms.status
-- CHECK constraint (added in 022) to accept the new value. Additive -- the
-- column and all existing values are untouched.

SET @chk := (
  SELECT CONSTRAINT_NAME
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'rooms'
    AND CONSTRAINT_TYPE = 'CHECK'
  ORDER BY CONSTRAINT_NAME
  LIMIT 1
);

SET @sql := IF(@chk IS NULL,
  'SELECT 1',
  CONCAT('ALTER TABLE rooms DROP CHECK ', @chk));
PREPARE s FROM @sql;
EXECUTE s;
DEALLOCATE PREPARE s;

ALTER TABLE rooms
  ADD CONSTRAINT rooms_status_chk
  CHECK (status IN ('Available','Maintenance','Inactive','Occupied'));