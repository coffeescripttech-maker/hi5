-- Migration 025: Editable legal content (Terms / Privacy / Conditions).
-- The login screen renders these documents inside the consent-gate modals.
-- NULL (or empty) means "use the hardcoded defaults baked into Login.tsx",
-- so existing installs show the current text until an admin saves overrides.
-- Values are JSON strings: { intro: string, sections: [{ heading, body }] }.

SET @c1 = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'school_settings' AND COLUMN_NAME = 'terms_of_service_text');
SET @ddl = IF(@c1 = 0,
  'ALTER TABLE school_settings ADD COLUMN terms_of_service_text TEXT NULL AFTER registrar_name',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @c2 = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'school_settings' AND COLUMN_NAME = 'privacy_policy_text');
SET @ddl2 = IF(@c2 = 0,
  'ALTER TABLE school_settings ADD COLUMN privacy_policy_text TEXT NULL AFTER terms_of_service_text',
  'SELECT 1');
PREPARE stmt2 FROM @ddl2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

SET @c3 = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'school_settings' AND COLUMN_NAME = 'conditions_text');
SET @ddl3 = IF(@c3 = 0,
  'ALTER TABLE school_settings ADD COLUMN conditions_text TEXT NULL AFTER privacy_policy_text',
  'SELECT 1');
PREPARE stmt3 FROM @ddl3; EXECUTE stmt3; DEALLOCATE PREPARE stmt3;
