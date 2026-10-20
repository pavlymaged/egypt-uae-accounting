/*
  # Allow 'employee_advance' as a payment method

  1. Problem
    - The payment_method CHECK constraints on project_expenses and vendor_project_payments
      only permit: cash, bank_transfer, check, card, other.
    - The UI now offers "Employee Advance" as a payment method. Saving such a record
      fails with a check-constraint violation ("Failed to save expense.").

  2. Fix
    - Drop and re-add the CHECK constraints on both tables to include 'employee_advance'.

  3. Notes
    - No data migration needed; existing rows remain valid.
*/

ALTER TABLE project_expenses DROP CONSTRAINT IF EXISTS project_expenses_payment_method_check;
ALTER TABLE project_expenses
  ADD CONSTRAINT project_expenses_payment_method_check
  CHECK (payment_method IN ('cash', 'bank_transfer', 'check', 'card', 'employee_advance', 'other'));

ALTER TABLE vendor_project_payments DROP CONSTRAINT IF EXISTS vendor_project_payments_payment_method_check;
ALTER TABLE vendor_project_payments
  ADD CONSTRAINT vendor_project_payments_payment_method_check
  CHECK (payment_method IN ('cash', 'bank_transfer', 'check', 'card', 'employee_advance', 'other'));
