-- ============================================================
-- Migration 011: Class Schedules / Timetable
-- Manages weekly class schedules for teachers, sections, and subjects.
-- ============================================================

-- 1. Create schedules table
CREATE TABLE IF NOT EXISTS schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  teacher_id INT NOT NULL,
  section_id INT NOT NULL,
  subject_id INT NOT NULL,
  school_year_id INT NOT NULL,
  day_of_week TINYINT NOT NULL COMMENT '1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday',
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room VARCHAR(50) NULL,
  created_at DATETIME DEFAULT NOW(),
  updated_at DATETIME DEFAULT NOW() ON UPDATE NOW(),
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
  FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE CASCADE,
  UNIQUE KEY uk_teacher_time (teacher_id, day_of_week, start_time, end_time, school_year_id),
  UNIQUE KEY uk_section_time (section_id, day_of_week, start_time, end_time, school_year_id),
  UNIQUE KEY uk_room_time (room, day_of_week, start_time, end_time, school_year_id),
  INDEX idx_teacher_sy (teacher_id, school_year_id),
  INDEX idx_section_sy (section_id, school_year_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Insert sample schedule entries for existing teacher-section-subject assignments
-- (INSERT IGNORE — safe to re-run; unique keys prevent duplicates)
-- Teacher 2 (Mr. Ramon Dela Cruz) → Section 1 (7-Mabini) → Subject 3 (Mathematics G7)
INSERT IGNORE INTO schedules (teacher_id, section_id, subject_id, school_year_id, day_of_week, start_time, end_time, room)
VALUES
  (2, 1, 3, 1, 1, '07:30:00', '08:30:00', 'Room 101'),
  (2, 1, 3, 1, 3, '07:30:00', '08:30:00', 'Room 101'),
  (2, 1, 3, 1, 5, '09:00:00', '10:00:00', 'Room 101'),
  (3, 2, 2, 1, 2, '08:00:00', '09:00:00', 'Room 102'),
  (3, 2, 2, 1, 4, '08:00:00', '09:00:00', 'Room 102'),
  (4, 5, 4, 1, 1, '10:00:00', '11:00:00', 'Lab 1'),
  (4, 5, 4, 1, 3, '10:00:00', '11:00:00', 'Lab 1');
