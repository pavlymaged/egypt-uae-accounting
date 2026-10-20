/*
  # Allow 'item' entity_type on attachments

  1. Changes
    - Drop and recreate the `attachments_entity_type_check` constraint to include 'item'
  2. Notes
    - Enables attaching files/links to Items (Products & Services)
    - Safe: constraint rebuild preserves existing rows (all current entity_type values remain valid)
*/

ALTER TABLE attachments DROP CONSTRAINT IF EXISTS attachments_entity_type_check;

ALTER TABLE attachments ADD CONSTRAINT attachments_entity_type_check
  CHECK (entity_type IN (
    'general_expense',
    'site_expense',
    'vendor_payment',
    'vendor',
    'employee_advance',
    'project_income',
    'item'
  ));
