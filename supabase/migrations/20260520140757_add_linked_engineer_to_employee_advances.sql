/*
  # Link Site Engineers to Employee Advances

  1. Modified Tables
    - `employee_advances`
      - Add `linked_engineer_id` (uuid, nullable, FK to site_engineers) 
        Links an employee advance record to a specific site engineer

  2. Notes
    - Nullable so existing records are unaffected
    - ON DELETE SET NULL preserves advance history if engineer is removed
    - Index for efficient lookups when navigating from engineer to their advances
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_advances' AND column_name = 'linked_engineer_id'
  ) THEN
    ALTER TABLE employee_advances
      ADD COLUMN linked_engineer_id uuid REFERENCES site_engineers(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_employee_advances_linked_engineer ON employee_advances(linked_engineer_id);
  END IF;
END $$;
