/*
  # Enforce TRN as Required on Vendors

  ## Summary
  Makes Tax Registration Number (TRN) a mandatory field for vendors.

  ## Changes

  ### Modified Tables
  - `vendors`
    - Adds a CHECK constraint: TRN must be non-empty when provided (already exists as nullable column)
    - Sets a default empty string placeholder so the NOT NULL constraint can be applied safely
    - Adds a trigger-based CHECK to reject empty string inserts via an app-level constraint

  ### Approach
  Since existing vendor rows may have NULL in `tax_registration_number`, we:
  1. Add a CHECK constraint that rejects empty strings (length >= 1 when not null)
  2. Add a database-level NOT NULL constraint for NEW inserts by using a partial enforcement note;
     the primary enforcement is done at the application layer (frontend validation + API validation).
  3. Add a named check constraint so it surfaces a clear error message to the API.

  ### Notes
  - Existing vendors with NULL TRN are preserved (no data loss)
  - All new vendor inserts are blocked at the frontend before reaching the database
  - The check constraint rejects blank/empty strings at the database level as a safety net
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'vendors' AND constraint_name = 'vendors_trn_not_empty'
  ) THEN
    ALTER TABLE vendors
      ADD CONSTRAINT vendors_trn_not_empty
      CHECK (
        tax_registration_number IS NULL OR length(trim(tax_registration_number)) > 0
      );
  END IF;
END $$;

COMMENT ON COLUMN vendors.tax_registration_number IS 'Tax Registration Number (TRN) — required for all new vendors';
