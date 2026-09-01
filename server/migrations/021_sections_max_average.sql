-- 021: Per-section grade threshold ranges
-- =====================================================================
-- Adds an optional max_average to each section so admins can configure a
-- full per-section grade threshold range (e.g. STE: 90–100, Regular: 75–89)
-- instead of relying only on the global section_type_config defaults.
-- Backward compatible: the column is nullable; existing rows are unaffected.

SET @c = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sections'
    AND COLUMN_NAME = 'max_average'
);
SET @ddl = IF(@c = 0,
  'ALTER TABLE sections ADD COLUMN max_average DECIMAL(5,2) NULL AFTER min_average',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;