-- Migration 019: Add end_of_contract to users (paired with date_hired)
-- Backward-compatible: nullable column, no data changes
ALTER TABLE users
  ADD COLUMN end_of_contract DATE NULL AFTER date_hired;
