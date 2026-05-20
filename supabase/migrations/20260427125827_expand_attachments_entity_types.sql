/*
  # Expand attachments entity_type to support more areas

  1. Changes
    - Drop existing CHECK constraint on attachments.entity_type
    - Add new CHECK constraint allowing: general_expense, site_expense, vendor_payment,
      vendor, employee_advance, project_income

  2. Notes
    - Existing rows are preserved (all current values still valid under new constraint)
    - No data migration required
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'attachments' AND constraint_name = 'attachments_entity_type_check'
  ) THEN
    ALTER TABLE attachments DROP CONSTRAINT attachments_entity_type_check;
  END IF;
END $$;

ALTER TABLE attachments
  ADD CONSTRAINT attachments_entity_type_check
  CHECK (entity_type IN (
    'general_expense',
    'site_expense',
    'vendor_payment',
    'vendor',
    'employee_advance',
    'project_income'
  ));
