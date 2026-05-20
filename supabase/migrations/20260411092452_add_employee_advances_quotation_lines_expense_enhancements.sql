/*
  # Employee Advances, Quotation Line Items, and Expense Enhancements

  1. New Tables
    - `employee_advances`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, FK to organizations)
      - `advance_number` (text) - auto-generated
      - `advance_date` (date)
      - `employee_name` (text)
      - `amount` (numeric)
      - `source_account` (text) - bank or cash
      - `remaining_balance` (numeric) - tracks unspent amount
      - `notes` (text)
      - `created_by` (uuid)

    - `quotation_lines`
      - `id` (uuid, primary key)
      - `quotation_id` (uuid, FK to vendor_quotations)
      - `item_description` (text)
      - `profession` (text)
      - `quantity` (numeric)
      - `measurement_unit` (text)
      - `rate_for_client` (numeric)
      - `rate_for_office` (numeric)
      - `tax_percent` (numeric)
      - `total_amount_client` (numeric) - auto: qty * rate_for_client
      - `total_amount_office` (numeric) - auto: qty * rate_for_office
      - `line_order` (integer)

  2. Modified Tables
    - `project_expenses` - add category, profession, vendor_name_text, trn_text, tax_included, receipt_url, status, reviewed_by, reviewed_at, employee_advance_id
    - `vendors` - add contact_person, default_tax_rate_id

  3. Security
    - Enable RLS on new tables
    - Policies for authenticated users based on org membership
*/

-- Employee Advances table
CREATE TABLE IF NOT EXISTS employee_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  advance_number text NOT NULL,
  advance_date date NOT NULL,
  employee_name text NOT NULL,
  amount numeric NOT NULL,
  source_account text NOT NULL,
  remaining_balance numeric NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE employee_advances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view employee advances in their org"
  ON employee_advances FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.organization_id = employee_advances.organization_id
      AND user_roles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert employee advances in their org"
  ON employee_advances FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.organization_id = employee_advances.organization_id
      AND user_roles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update employee advances in their org"
  ON employee_advances FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.organization_id = employee_advances.organization_id
      AND user_roles.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.organization_id = employee_advances.organization_id
      AND user_roles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete employee advances in their org"
  ON employee_advances FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.organization_id = employee_advances.organization_id
      AND user_roles.user_id = auth.uid()
    )
  );

-- Quotation Lines table
CREATE TABLE IF NOT EXISTS quotation_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES vendor_quotations(id) ON DELETE CASCADE,
  item_description text NOT NULL,
  profession text DEFAULT '',
  quantity numeric NOT NULL DEFAULT 1,
  measurement_unit text DEFAULT 'unit',
  rate_for_client numeric NOT NULL DEFAULT 0,
  rate_for_office numeric NOT NULL DEFAULT 0,
  tax_percent numeric NOT NULL DEFAULT 0,
  total_amount_client numeric NOT NULL DEFAULT 0,
  total_amount_office numeric NOT NULL DEFAULT 0,
  line_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE quotation_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view quotation lines via quotation org"
  ON quotation_lines FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vendor_quotations vq
      JOIN user_roles ur ON ur.organization_id = vq.organization_id
      WHERE vq.id = quotation_lines.quotation_id
      AND ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert quotation lines via quotation org"
  ON quotation_lines FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vendor_quotations vq
      JOIN user_roles ur ON ur.organization_id = vq.organization_id
      WHERE vq.id = quotation_lines.quotation_id
      AND ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update quotation lines via quotation org"
  ON quotation_lines FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vendor_quotations vq
      JOIN user_roles ur ON ur.organization_id = vq.organization_id
      WHERE vq.id = quotation_lines.quotation_id
      AND ur.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vendor_quotations vq
      JOIN user_roles ur ON ur.organization_id = vq.organization_id
      WHERE vq.id = quotation_lines.quotation_id
      AND ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete quotation lines via quotation org"
  ON quotation_lines FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vendor_quotations vq
      JOIN user_roles ur ON ur.organization_id = vq.organization_id
      WHERE vq.id = quotation_lines.quotation_id
      AND ur.user_id = auth.uid()
    )
  );

-- Add missing columns to project_expenses
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_expenses' AND column_name = 'category') THEN
    ALTER TABLE project_expenses ADD COLUMN category text DEFAULT 'material';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_expenses' AND column_name = 'profession') THEN
    ALTER TABLE project_expenses ADD COLUMN profession text DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_expenses' AND column_name = 'vendor_name_text') THEN
    ALTER TABLE project_expenses ADD COLUMN vendor_name_text text DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_expenses' AND column_name = 'trn_text') THEN
    ALTER TABLE project_expenses ADD COLUMN trn_text text DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_expenses' AND column_name = 'tax_included') THEN
    ALTER TABLE project_expenses ADD COLUMN tax_included boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_expenses' AND column_name = 'receipt_url') THEN
    ALTER TABLE project_expenses ADD COLUMN receipt_url text DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_expenses' AND column_name = 'status') THEN
    ALTER TABLE project_expenses ADD COLUMN status text DEFAULT 'confirmed';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_expenses' AND column_name = 'reviewed_by') THEN
    ALTER TABLE project_expenses ADD COLUMN reviewed_by uuid;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_expenses' AND column_name = 'reviewed_at') THEN
    ALTER TABLE project_expenses ADD COLUMN reviewed_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_expenses' AND column_name = 'employee_advance_id') THEN
    ALTER TABLE project_expenses ADD COLUMN employee_advance_id uuid REFERENCES employee_advances(id);
  END IF;
END $$;

-- Add missing columns to vendors
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'contact_person') THEN
    ALTER TABLE vendors ADD COLUMN contact_person text DEFAULT '';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'default_tax_rate_id') THEN
    ALTER TABLE vendors ADD COLUMN default_tax_rate_id uuid REFERENCES tax_rates(id);
  END IF;
END $$;
