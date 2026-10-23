-- 043: Persist SF9 Observed Values (and related editable sheet fields).
--
-- The SF9 screen held observed-value dropdown selections (AO/SO/RO/NO per
-- core value / behavior statement / quarter) only in React state: they
-- vanished on student switch and refresh, so exports and print previews
-- produced empty sheets. This table stores one JSON payload per learner per
-- school year; the payload shape mirrors the frontend keys
-- ("cvIdx-stIdx-Qq" -> "AO"|"SO"|"RO"|"NO").

CREATE TABLE IF NOT EXISTS sf9_form_data (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  school_year_id INT NOT NULL,
  observed_values JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_sf9_form_data (student_id, school_year_id),
  CONSTRAINT fk_sf9_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE,
  CONSTRAINT fk_sf9_sy FOREIGN KEY (school_year_id) REFERENCES school_years (id) ON DELETE CASCADE
);
