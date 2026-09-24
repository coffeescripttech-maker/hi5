-- ============================================================
-- Migration 032: User presence (real-time online / idle / offline)
-- Adds last_seen_at so the admin User Management page can show
-- live presence instead of the account status derived from
-- last_login. The column is stamped by:
--   - successful login               (→ online immediately)
--   - POST /api/presence/heartbeat   (throttled, from the browser)
--   - logout                         (cleared → offline immediately)
-- Presence is computed from recency:
--   online   → last_seen_at within 2 minutes
--   idle     → last_seen_at 2–15 minutes ago
--   offline  → older than 15 minutes, or never seen
-- The account status column (active/idle/inactive) is not touched —
-- it remains the admin-governed lifecycle state (deactivation etc.).
-- Column is added with an information_schema guard so the
-- migration can be re-run safely.
-- ============================================================

SET @c1 = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'last_seen_at');
SET @ddl = IF(@c1 = 0,
  'ALTER TABLE users ADD COLUMN last_seen_at DATETIME NULL DEFAULT NULL AFTER last_login',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;