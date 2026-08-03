-- Add 'principal' role to the users table ENUM
-- MySQL allows adding new values to ENUM via MODIFY COLUMN
ALTER TABLE users MODIFY COLUMN role ENUM('admin','teacher','registrar','principal') NOT NULL DEFAULT 'teacher';
