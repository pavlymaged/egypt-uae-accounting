/*
  # Align attachments table with AttachmentsManager component

  1. Changes
    - Add `kind` column (text) to distinguish 'file' vs 'link' attachments
    - Add `file_path` column (text, nullable) for Supabase Storage object path
    - Add `external_url` column (text, nullable) for link-type attachments
    - Backfill `kind` as 'file' for existing rows
    - Backfill `file_path` from legacy `file_url` where possible
    - Make `file_url` nullable to accommodate link-only rows going forward
  2. Security
    - No RLS changes; existing policies remain intact
  3. Notes
    - Non-destructive: existing columns (`file_url`) are preserved
    - Idempotent via IF NOT EXISTS guards
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attachments' AND column_name = 'kind'
  ) THEN
    ALTER TABLE attachments ADD COLUMN kind text NOT NULL DEFAULT 'file';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attachments' AND column_name = 'file_path'
  ) THEN
    ALTER TABLE attachments ADD COLUMN file_path text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attachments' AND column_name = 'external_url'
  ) THEN
    ALTER TABLE attachments ADD COLUMN external_url text;
  END IF;
END $$;

UPDATE attachments SET file_path = file_url WHERE file_path IS NULL AND file_url IS NOT NULL;

ALTER TABLE attachments ALTER COLUMN file_url DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'attachments' AND constraint_name = 'attachments_kind_check'
  ) THEN
    ALTER TABLE attachments ADD CONSTRAINT attachments_kind_check CHECK (kind IN ('file', 'link'));
  END IF;
END $$;
