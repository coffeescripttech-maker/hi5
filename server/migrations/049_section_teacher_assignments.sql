-- Migration 049: Subject teachers per section (docs/new_requirement.txt R1-R10)
--
-- Today a teacher's subject grant (teacher_subject_assignments) spans the WHOLE
-- school year: one row grants grading rights for a subject in every section the
-- teacher touches. The client's model is finer: a grade belongs to ONE teacher,
-- ONE subject and ONE section, and the adviser designation alone gives NO
-- grading rights.
--
-- New table: section_teacher_assignments = the (section x subject x teacher)
-- grant, keyed to a school year. Co-teachers are allowed (decide 10.9-2), so
-- uniqueness is per (section, subject, year, teacher) — not per subject.
-- Electives are NEVER assigned here (decide: roster = the learners who picked
-- the elective); they keep their subject-level grants.
--
-- Adviser designation stays on sections.adviser_id. One adviser = one section
-- is enforced in the controller (decide 10.9-5, hard error).
--
-- Rollback: DROP TABLE section_teacher_assignments;

CREATE TABLE IF NOT EXISTS section_teacher_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  section_id INT NOT NULL,
  subject_id INT NOT NULL,
  teacher_id INT NOT NULL,
  school_year_id INT NOT NULL,
  created_at DATETIME DEFAULT NOW(),
  UNIQUE KEY uk_sta_section_subject_sy_teacher
    (section_id, subject_id, school_year_id, teacher_id),
  KEY idx_sta_teacher_sy (teacher_id, school_year_id),
  KEY idx_sta_section_sy (section_id, school_year_id),
  CONSTRAINT fk_sta_section FOREIGN KEY (section_id) REFERENCES sections (id) ON DELETE CASCADE,
  CONSTRAINT fk_sta_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE,
  CONSTRAINT fk_sta_teacher FOREIGN KEY (teacher_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_sta_sy FOREIGN KEY (school_year_id) REFERENCES school_years (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
