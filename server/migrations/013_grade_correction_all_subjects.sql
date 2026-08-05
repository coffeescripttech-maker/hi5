-- Allow subject_id to be NULL => "All subjects" grade correction requests
ALTER TABLE grade_correction_requests MODIFY subject_id INT NULL;
