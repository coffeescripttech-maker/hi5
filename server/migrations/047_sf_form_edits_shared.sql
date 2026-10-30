-- Saved School Form Edits, Phase 2 (docs/MAJOR_CHANGES_IN_FORMS.txt rules 8 + 15):
-- 047_sf_form_edits_shared.sql
--
-- Rule 8: fields printed by more than one school form (school-identity
-- header, learner identity SF1<->SF10) are stored ONCE under form='SHARED'
-- and translated into each requesting form's namespace when read.
-- Rule 15 carries learner-level details from the previous school year.

ALTER TABLE sf_form_edits
  MODIFY COLUMN form ENUM('SF1','SF5','SF9','SF10','SHARED') NOT NULL;
