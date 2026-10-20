/*
  # Add Date Range Columns to Period Locks

  1. Changes to `period_locks` table
    - Add `period_start` column (date) for lock start date
    - Add `period_end` column (date) for lock end date
    - Add `reason` column (text) for lock reason/notes
  
  2. Notes
    - Uses `IF NOT EXISTS` checks to ensure safe migration
    - Existing `period_year` and `period_month` columns remain for backward compatibility
*/

-- Add period_start column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'period_locks' AND column_name = 'period_start'
  ) THEN
    ALTER TABLE period_locks ADD COLUMN period_start date;
  END IF;
END $$;

-- Add period_end column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'period_locks' AND column_name = 'period_end'
  ) THEN
    ALTER TABLE period_locks ADD COLUMN period_end date;
  END IF;
END $$;

-- Add reason column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'period_locks' AND column_name = 'reason'
  ) THEN
    ALTER TABLE period_locks ADD COLUMN reason text;
  END IF;
END $$;