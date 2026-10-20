/*
  # Allow negative amounts in engineer_advances for balance deductions

  1. Changes
    - Remove the CHECK constraint on `amount` column in `engineer_advances` that required amount > 0
    - This allows recording negative advances (e.g., when an employee returns money via cash transfer)
    - The advance_balance is still computed as sum(advances) - sum(approved expenses)

  2. Notes
    - Negative advance entries represent money returned by the employee
    - Positive advance entries represent money given to the employee
    - This enables the cash transfer system to sync balances in both directions
*/

ALTER TABLE engineer_advances DROP CONSTRAINT IF EXISTS engineer_advances_amount_check;
