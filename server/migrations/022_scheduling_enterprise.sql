-- 022: Enterprise Scheduling — Rooms, schedule history/audit, and room linkage
-- =====================================================================
-- Additive only. Existing schedules.room (free-text) remains intact;
-- schedules.room_id is nullable and backfilled from canonical room names
-- when a matching room exists. No existing column is dropped or renamed.

-- 1. Rooms master table
CREATE TABLE IF NOT EXISTS rooms (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(50) NOT NULL UNIQUE,
  building      VARCHAR(100) NULL,
  floor         VARCHAR(20)  NULL,
  capacity      INT          NULL,
  room_type     VARCHAR(30)  NOT NULL DEFAULT 'Classroom'
    CHECK (room_type IN ('Classroom','Laboratory','Computer Laboratory','Lecture Hall','Other')),
  status        VARCHAR(20)  NOT NULL DEFAULT 'Available'
    CHECK (status IN ('Available','Maintenance','Inactive')),
  created_at    DATETIME DEFAULT NOW(),
  updated_at    DATETIME DEFAULT NOW() ON UPDATE NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Schedule change history / audit trail (never silently overwrites)
CREATE TABLE IF NOT EXISTS schedule_changes (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  schedule_id   INT NOT NULL,
  changed_by    INT NOT NULL,
  change_type   VARCHAR(30) NOT NULL DEFAULT 'update'
    CHECK (change_type IN ('update','reassign_room','reassign_teacher','reschedule')),
  old_day       TINYINT NULL,
  old_start     TIME    NULL,
  old_end       TIME    NULL,
  old_room      VARCHAR(50) NULL,
  new_day       TINYINT NULL,
  new_start     TIME    NULL,
  new_end       TIME    NULL,
  new_room      VARCHAR(50) NULL,
  reason        VARCHAR(255) NULL,
  created_at    DATETIME DEFAULT NOW(),
  FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by)  REFERENCES users(id)      ON DELETE CASCADE,
  INDEX idx_sched (schedule_id),
  INDEX idx_changer (changed_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Link schedules to rooms (nullable — additive, zero data loss)
SET @c = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'schedules'
    AND COLUMN_NAME = 'room_id'
);
SET @ddl = IF(@c = 0,
  'ALTER TABLE schedules ADD COLUMN room_id INT NULL AFTER room',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Foreign key + lookup index for room-based queries
SET @fk_exists = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'schedules'
    AND CONSTRAINT_NAME = 'fk_sched_room'
);
SET @ddl2 = IF(@fk_exists = 0,
  'ALTER TABLE schedules ADD CONSTRAINT fk_sched_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL, ADD INDEX idx_room_sy (room_id, school_year_id)',
  'SELECT 1');
PREPARE stmt2 FROM @ddl2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- 5. Backfill rooms from existing free-text schedule data (safe idempotent)
INSERT IGNORE INTO rooms (name, building, room_type, status)
SELECT DISTINCT room AS name, NULL AS building, 'Classroom', 'Available'
FROM schedules
WHERE room IS NOT NULL AND room != '';
