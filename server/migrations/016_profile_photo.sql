-- ============================================================
-- Migration 016: Widen users.profile_photo_url for photo persistence
--
-- Profile photos are stored as base64 data URLs (saved via the
-- profile page and loaded through /auth/me). A data URL for a small
-- thumbnail far exceeds the original VARCHAR(255), so widen the
-- column to MEDIUMTEXT (~16MB) to allow the photo to survive reloads.
-- ============================================================

ALTER TABLE users
  MODIFY COLUMN profile_photo_url MEDIUMTEXT NULL;
