-- Track whether a promoted student had complete grades (all 4 quarters, every subject)
ALTER TABLE promotion_students
  ADD COLUMN grade_complete TINYINT(1) NOT NULL DEFAULT 1
    COMMENT '0 = blocked from promotion due to incomplete grades';
