/*
  # Site Engineer Expense Management System

  1. New Tables
    - `site_engineers` - Engineer profiles created by the accountant
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `user_id` (uuid, references auth.users - the engineer's login)
      - `name` (text)
      - `email` (text)
      - `phone` (text)
      - `project_id` (uuid, references projects, nullable)
      - `is_active` (boolean, default true)
      - `created_by` (uuid, references auth.users - the accountant)
      - `created_at` (timestamptz)

    - `engineer_advances` - Advances sent to engineers by accountant
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `engineer_id` (uuid, references site_engineers)
      - `amount` (numeric)
      - `payment_source` (text: 'cash' or 'bank')
      - `notes` (text)
      - `created_by` (uuid, references auth.users)
      - `created_at` (timestamptz)

    - `engineer_expenses` - Expenses submitted by engineers
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `engineer_id` (uuid, references site_engineers)
      - `expense_date` (date)
      - `amount` (numeric)
      - `tax` (numeric, default 0)
      - `description` (text)
      - `category` (text: Material/Labour/Indirect)
      - `profession` (text)
      - `project_id` (uuid, references projects)
      - `payment_method` (text, default 'employee_advance')
      - `receipt_photo_url` (text)
      - `status` (text: Pending/Approved/Rejected/Amended)
      - `accountant_notes` (text)
      - `submitted_at` (timestamptz)
      - `reviewed_at` (timestamptz)
      - `reviewed_by` (uuid)
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled on all tables
    - Accountants (org members) can manage all records in their org
    - Engineers can only view/manage their own records
    - Engineers can only insert/update their own expenses

  3. Notes
    - The engineer_advance_balance is computed as: sum(advances) - sum(approved expenses) for each engineer
    - A 'site_engineer' role is added to user_roles for engineer accounts
*/

-- Site Engineers table
CREATE TABLE IF NOT EXISTS site_engineers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  name text NOT NULL,
  email text NOT NULL,
  phone text DEFAULT '',
  project_id uuid REFERENCES projects(id),
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE site_engineers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view site engineers"
  ON site_engineers FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert site engineers"
  ON site_engineers FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update site engineers"
  ON site_engineers FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- Engineer can see their own profile
CREATE POLICY "Engineers can view own profile"
  ON site_engineers FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Engineer Advances table
CREATE TABLE IF NOT EXISTS engineer_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  engineer_id uuid NOT NULL REFERENCES site_engineers(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_source text NOT NULL CHECK (payment_source IN ('cash', 'bank')),
  notes text DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE engineer_advances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view engineer advances"
  ON engineer_advances FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert engineer advances"
  ON engineer_advances FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- Engineers can view their own advances
CREATE POLICY "Engineers can view own advances"
  ON engineer_advances FOR SELECT
  TO authenticated
  USING (
    engineer_id IN (
      SELECT id FROM site_engineers WHERE user_id = auth.uid()
    )
  );

-- Engineer Expenses table
CREATE TABLE IF NOT EXISTS engineer_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  engineer_id uuid NOT NULL REFERENCES site_engineers(id) ON DELETE CASCADE,
  expense_date date NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  tax numeric DEFAULT 0,
  description text NOT NULL,
  category text NOT NULL CHECK (category IN ('Material', 'Labour', 'Indirect')),
  profession text DEFAULT '',
  project_id uuid REFERENCES projects(id),
  payment_method text DEFAULT 'employee_advance',
  receipt_photo_url text DEFAULT '',
  status text DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Amended')),
  accountant_notes text DEFAULT '',
  submitted_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE engineer_expenses ENABLE ROW LEVEL SECURITY;

-- Accountants/org members can see all expenses in their org
CREATE POLICY "Org members can view engineer expenses"
  ON engineer_expenses FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- Accountants/org members can update expenses (for approve/reject/amend)
CREATE POLICY "Org members can update engineer expenses"
  ON engineer_expenses FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
    )
  );

-- Engineers can view their own expenses
CREATE POLICY "Engineers can view own expenses"
  ON engineer_expenses FOR SELECT
  TO authenticated
  USING (
    engineer_id IN (
      SELECT id FROM site_engineers WHERE user_id = auth.uid()
    )
  );

-- Engineers can insert their own expenses
CREATE POLICY "Engineers can insert own expenses"
  ON engineer_expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    engineer_id IN (
      SELECT id FROM site_engineers WHERE user_id = auth.uid()
    )
  );

-- Engineers can update their own expenses (only Pending or Amended)
CREATE POLICY "Engineers can update own pending expenses"
  ON engineer_expenses FOR UPDATE
  TO authenticated
  USING (
    engineer_id IN (
      SELECT id FROM site_engineers WHERE user_id = auth.uid()
    )
    AND status IN ('Pending', 'Amended')
  )
  WITH CHECK (
    engineer_id IN (
      SELECT id FROM site_engineers WHERE user_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_site_engineers_org ON site_engineers(organization_id);
CREATE INDEX IF NOT EXISTS idx_site_engineers_user ON site_engineers(user_id);
CREATE INDEX IF NOT EXISTS idx_engineer_advances_engineer ON engineer_advances(engineer_id);
CREATE INDEX IF NOT EXISTS idx_engineer_advances_org ON engineer_advances(organization_id);
CREATE INDEX IF NOT EXISTS idx_engineer_expenses_engineer ON engineer_expenses(engineer_id);
CREATE INDEX IF NOT EXISTS idx_engineer_expenses_org ON engineer_expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_engineer_expenses_status ON engineer_expenses(status);
