/*
  # Add title column to site_engineers and source column to project_expenses

  1. Modified Tables
    - `site_engineers`
      - Add `title` (text, nullable) - Employee job title/role (Accountant, Site Engineer, Senior Execution Engineer, Procurement Employee)
    - `project_expenses`
      - Add `source` (text, default 'direct') - Identifies which module created the expense record

  2. Notes
    - Both columns are nullable/have defaults so existing records are unaffected
    - The `source` column helps distinguish site expenses from general expenses and other sources
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'site_engineers' AND column_name = 'title'
  ) THEN
    ALTER TABLE site_engineers ADD COLUMN title text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_expenses' AND column_name = 'source'
  ) THEN
    ALTER TABLE project_expenses ADD COLUMN source text DEFAULT 'direct';
  END IF;
END $$;
