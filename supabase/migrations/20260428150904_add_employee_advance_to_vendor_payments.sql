/*
  # Link vendor payments to employee advances

  1. Changes
    - Add employee_advance_id column to vendor_project_payments. When a vendor payment
      is made out of funds previously advanced to an employee, the payment is linked
      back to the originating advance so the advance's remaining balance can be drawn down.

  2. Notes
    - Nullable; existing rows are unaffected.
    - Foreign key to employee_advances with ON DELETE SET NULL to preserve payment history.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendor_project_payments' AND column_name = 'employee_advance_id'
  ) THEN
    ALTER TABLE vendor_project_payments
      ADD COLUMN employee_advance_id uuid REFERENCES employee_advances(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_vendor_payments_employee_advance ON vendor_project_payments(employee_advance_id);
  END IF;
END $$;
