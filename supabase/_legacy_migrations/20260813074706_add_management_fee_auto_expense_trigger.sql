/*
  # Management Fee Auto-Deduction as Expense

  1. Changes
    - Expand `project_expenses.expense_type` CHECK to include 'management_fee'
    - Add columns to `project_expenses` for tracking the source income payment:
      - `management_fee_percent` (numeric) — the fee % applied
      - `source_income_id` (uuid, nullable) — FK to project_income, for
        cascading updates/deletes so the auto-expense stays in sync with its
        parent income record
    - Create a DB function `auto_create_management_fee_expense()` that runs
      AFTER INSERT or UPDATE on `project_income`:
      - Computes fee = amount * management_fee_on_income_percent / 100
      - On INSERT: creates a matching project_expenses row with
        expense_type='management_fee', status='confirmed', linked via
        source_income_id
      - On UPDATE: updates the matching expense row (amount, date, notes) or
        creates one if it doesn't exist
    - Create a DB function `auto_delete_management_fee_expense()` that runs
      AFTER DELETE on `project_income` to remove the linked expense
    - Create triggers on `project_income` calling these functions
    - Backfill: create expense rows for existing income records that have
      management_fee_amount > 0 but no linked expense yet

  2. Security
    - The trigger function runs with SECURITY DEFINER as the postgres owner
      so it can insert into project_expenses regardless of the caller's RLS.
      This is safe because it only creates rows derived from the income data
      the user already had permission to write.
    - RLS policies on project_expenses already exist for org members; the
      new 'management_fee' expense_type is covered by the existing
      organization_id-scoped policies.
    - Client portal users already have SELECT on project_expenses scoped to
      their projects — they will see these auto-generated expenses.

  3. Notes
    - Idempotent: trigger/function creation uses DROP IF EXISTS first.
    - The backfill uses ON CONFLICT DO NOTHING to avoid duplicates.
    - source_income_id FK uses ON DELETE CASCADE so deleting income removes
      the auto-expense (the trigger also handles this, but the FK is a
      safety net).
*/

-- 1. Expand expense_type CHECK to include 'management_fee'
ALTER TABLE project_expenses DROP CONSTRAINT IF EXISTS project_expenses_expense_type_check;
ALTER TABLE project_expenses ADD CONSTRAINT project_expenses_expense_type_check
  CHECK (expense_type IN ('general', 'site', 'management_fee'));

-- 2. Add tracking columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_expenses' AND column_name = 'management_fee_percent') THEN
    ALTER TABLE project_expenses ADD COLUMN management_fee_percent numeric(7,4) DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_expenses' AND column_name = 'source_income_id') THEN
    ALTER TABLE project_expenses ADD COLUMN source_income_id uuid REFERENCES project_income(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_project_expenses_source_income ON project_expenses(source_income_id);

-- 3. Function: auto-create or update management fee expense on income insert/update
CREATE OR REPLACE FUNCTION auto_create_management_fee_expense()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project RECORD;
  v_fee numeric(15,2);
  v_existing uuid;
  v_expense_num text;
  v_latest_num text;
  v_next_num int;
BEGIN
  -- Fetch the project to get management_fee_on_income_percent
  SELECT management_fee_on_income_percent, organization_id
    INTO v_project
    FROM projects WHERE id = NEW.project_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_fee := round((NEW.amount * COALESCE(v_project.management_fee_on_income_percent, 0)) / 100, 2);

  -- Check if a linked expense already exists
  SELECT id INTO v_existing FROM project_expenses WHERE source_income_id = NEW.id;

  IF v_fee > 0 THEN
    IF v_existing IS NOT NULL THEN
      -- Update existing auto-expense
      UPDATE project_expenses
        SET amount = v_fee,
            expense_date = NEW.payment_date,
            management_fee_percent = COALESCE(v_project.management_fee_on_income_percent, 0),
            notes = 'Auto-deducted management fee for ' || NEW.income_number,
            updated_at = now()
        WHERE id = v_existing;
    ELSE
      -- Generate next expense number (EXP-####)
      SELECT expense_number INTO v_latest_num
        FROM project_expenses
        WHERE organization_id = NEW.organization_id
        ORDER BY created_at DESC
        LIMIT 1;

      v_next_num := 1;
      IF v_latest_num IS NOT NULL THEN
        BEGIN
          v_next_num := CAST(regexp_replace(v_latest_num, '[^0-9]', '', 'g') AS int) + 1;
        EXCEPTION WHEN OTHERS THEN
          v_next_num := 1;
        END;
      END IF;
      v_expense_num := 'EXP-' || lpad(v_next_num::text, 4, '0');

      -- Insert the auto-expense
      INSERT INTO project_expenses (
        organization_id, expense_number, project_id, expense_type,
        expense_date, description, amount, payment_method, notes,
        category, status, management_fee_percent, source_income_id, created_by
      ) VALUES (
        NEW.organization_id, v_expense_num, NEW.project_id, 'management_fee',
        NEW.payment_date, 'Management Fee - ' || NEW.income_number, v_fee,
        NEW.payment_method, 'Auto-deducted management fee for ' || NEW.income_number,
        'management_fee', 'confirmed', COALESCE(v_project.management_fee_on_income_percent, 0),
        NEW.id, NEW.created_by
      );
    END IF;
  ELSE
    -- Fee is 0: remove existing auto-expense if any
    IF v_existing IS NOT NULL THEN
      DELETE FROM project_expenses WHERE id = v_existing;
    END IF;
  END IF;

  -- Also update the management_fee_amount on the income row itself
  IF NEW.management_fee_amount IS DISTINCT FROM v_fee THEN
    UPDATE project_income SET management_fee_amount = v_fee WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Function: auto-delete management fee expense on income delete
CREATE OR REPLACE FUNCTION auto_delete_management_fee_expense()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM project_expenses WHERE source_income_id = OLD.id;
  RETURN OLD;
END;
$$;

-- 5. Create triggers
DROP TRIGGER IF EXISTS trg_income_auto_mf_expense ON project_income;
CREATE TRIGGER trg_income_auto_mf_expense
  AFTER INSERT OR UPDATE ON project_income
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_management_fee_expense();

DROP TRIGGER IF EXISTS trg_income_delete_mf_expense ON project_income;
CREATE TRIGGER trg_income_delete_mf_expense
  AFTER DELETE ON project_income
  FOR EACH ROW
  EXECUTE FUNCTION auto_delete_management_fee_expense();

-- 6. Backfill: create expense rows for existing income records with management_fee_amount > 0
--    that don't already have a linked expense
INSERT INTO project_expenses (
  organization_id, expense_number, project_id, expense_type,
  expense_date, description, amount, payment_method, notes,
  category, status, management_fee_percent, source_income_id, created_by
)
SELECT
  pi.organization_id,
  'EXP-MF-' || pi.income_number,
  pi.project_id,
  'management_fee',
  pi.payment_date,
  'Management Fee - ' || pi.income_number,
  pi.management_fee_amount,
  pi.payment_method,
  'Auto-deducted management fee for ' || pi.income_number,
  'management_fee',
  'confirmed',
  COALESCE(p.management_fee_on_income_percent, 0),
  pi.id,
  pi.created_by
FROM project_income pi
LEFT JOIN projects p ON p.id = pi.project_id
WHERE pi.management_fee_amount > 0
  AND NOT EXISTS (
    SELECT 1 FROM project_expenses pe WHERE pe.source_income_id = pi.id
  )
ON CONFLICT DO NOTHING;
