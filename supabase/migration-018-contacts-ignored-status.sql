-- Migration 018: Add 'ignored' status to scanned_contacts
-- Allows users to permanently dismiss contacts from triage

-- Drop the existing check constraint and re-create with 'ignored'
ALTER TABLE scanned_contacts DROP CONSTRAINT IF EXISTS scanned_contacts_status_check;
ALTER TABLE scanned_contacts ADD CONSTRAINT scanned_contacts_status_check
  CHECK (status IN ('new', 'existing', 'synced', 'ignored'));
