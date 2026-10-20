-- 039: Widen section_types.color_code so a section type can be created with a colour
-- ==========================================================================
-- The admin "Manage Section Types" form stores a Tailwind colour triple in
-- color_code, e.g. 'bg-emerald-100 text-emerald-700 border-emerald-200' (50
-- chars), and every section badge renders that value directly as classes.
-- The column, however, was VARCHAR(30) -- inherited from the seeded short
-- names ('amber', 'blue', ...) -- so MySQL rejected the INSERT with
-- "Data too long for column 'color_code'". The controller surfaced that as a
-- generic 500 {"error":"Failed to create section type."}, which is why adding
-- a section type failed whenever a colour was picked.
--
-- Widening only; existing short names stay valid and NULL still means
-- "no colour". The app also validates the length and returns a clear 400 now.

ALTER TABLE section_types
  MODIFY COLUMN color_code VARCHAR(80) NULL DEFAULT NULL;
