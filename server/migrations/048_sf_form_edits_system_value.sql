-- Saved School Form Edits, Phase 3 (docs/MAJOR_CHANGES_IN_FORMS.txt rules 11-13):
-- 048_sf_form_edits_system_value.sql
--
-- rule 11/12: each edit records the system value it was taken over from, so
-- the UI can show an Edited marker (saved value != system value) and notice
-- when the underlying record changes after an edit (stored baseline vs the
-- form's freshly derived value at render time).

ALTER TABLE sf_form_edits
  ADD COLUMN system_value TEXT NULL AFTER value;
