/*
  # Project Management System Tables

  1. New Tables
    - `projects` - Core entity linking clients to project work
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `project_code` (text, auto-generated like PRJ-0001)
      - `project_name` (text, mandatory)
      - `client_id` (uuid, references customers)
      - `project_type` (text: design, fit_out, consultancy)
      - `project_status` (text: active, inactive)
      - `management_fee_percent` (numeric, the fee percentage)
      - `management_fee_on_income_percent` (numeric, derived: mf/(100+mf)*100)
      - `project_address` (text, optional)
      - `notes` (text, optional)
      - `created_by` (uuid)

    - `service_types` - Types of services offered (Data Validation)
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `name` (text, unique per org)
      - `description` (text, optional)
      - `is_active` (boolean, default true)

    - `project_income` - Income records tied to projects
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `income_number` (text, auto-generated like INC-0001)
      - `project_id` (uuid, references projects)
      - `payment_date` (date, mandatory)
      - `amount` (numeric, mandatory)
      - `payment_method` (text, mandatory)
      - `received_by` (text, optional)
      - `notes` (text, optional)
      - `management_fee_amount` (numeric, auto-calculated)

    - `project_expenses` - General and site expenses
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `expense_number` (text, auto-generated)
      - `project_id` (uuid, references projects, nullable for general)
      - `expense_type` (text: general, site)
      - `expense_date` (date, mandatory)
      - `description` (text, mandatory)
      - `amount` (numeric, mandatory)
      - `payment_method` (text)
      - `vendor_id` (uuid, references vendors, optional)
      - `notes` (text, optional)

    - `vendor_quotations` - Quotations from vendors
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `quotation_number` (text, auto-generated)
      - `vendor_id` (uuid, references vendors)
      - `project_id` (uuid, references projects, optional)
      - `quotation_date` (date, mandatory)
      - `description` (text, optional)
      - `total_amount` (numeric, mandatory)
      - `status` (text: pending, approved, rejected, expired)
      - `valid_until` (date, optional)
      - `notes` (text, optional)

    - `vendor_project_payments` - Payments to vendors
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `payment_number` (text, auto-generated)
      - `vendor_id` (uuid, references vendors)
      - `project_id` (uuid, references projects, optional)
      - `quotation_id` (uuid, references vendor_quotations, optional)
      - `payment_date` (date, mandatory)
      - `amount` (numeric, mandatory)
      - `payment_method` (text, mandatory)
      - `reference` (text, optional)
      - `notes` (text, optional)

    - `cash_transfers` - Cash movement between accounts
      - `id` (uuid, primary key)
      - `organization_id` (uuid, references organizations)
      - `transfer_number` (text, auto-generated)
      - `transfer_date` (date, mandatory)
      - `from_account` (text, mandatory)
      - `to_account` (text, mandatory)
      - `amount` (numeric, mandatory)
      - `reference` (text, optional)
      - `notes` (text, optional)

  2. Modified Tables
    - `customers` - Added `contact_person` column for mandatory contact field

  3. Security
    - RLS enabled on all new tables
    - Policies restrict access to authenticated users within their organization
    - Uses existing `user_has_org_access()` helper function

  4. Indexes
    - All tables indexed on `organization_id`
    - `projects` indexed on `client_id` and `project_code`
    - `project_income` indexed on `project_id`
    - `project_expenses` indexed on `project_id`
    - `vendor_quotations` indexed on `vendor_id` and `project_id`
    - `vendor_project_payments` indexed on `vendor_id` and `project_id`
*/

-- Add contact_person to customers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'contact_person'
  ) THEN
    ALTER TABLE customers ADD COLUMN contact_person text DEFAULT '';
  END IF;
END $$;

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  project_code text NOT NULL,
  project_name text NOT NULL,
  client_id uuid REFERENCES customers(id) NOT NULL,
  project_type text NOT NULL CHECK (project_type IN ('design', 'fit_out', 'consultancy')),
  project_status text NOT NULL DEFAULT 'active' CHECK (project_status IN ('active', 'inactive')),
  management_fee_percent numeric(5,2) NOT NULL DEFAULT 0,
  management_fee_on_income_percent numeric(7,4) NOT NULL DEFAULT 0,
  project_address text DEFAULT '',
  notes text DEFAULT '',
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, project_code)
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view projects in their org"
  ON projects FOR SELECT TO authenticated
  USING (organization_id IN (SELECT ur.organization_id FROM user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "Users can insert projects in their org"
  ON projects FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT ur.organization_id FROM user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "Users can update projects in their org"
  ON projects FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT ur.organization_id FROM user_roles ur WHERE ur.user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT ur.organization_id FROM user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "Users can delete projects in their org"
  ON projects FOR DELETE TO authenticated
  USING (organization_id IN (SELECT ur.organization_id FROM user_roles ur WHERE ur.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_code ON projects(organization_id, project_code);

-- Service types table
CREATE TABLE IF NOT EXISTS service_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, name)
);

ALTER TABLE service_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view service types in their org"
  ON service_types FOR SELECT TO authenticated
  USING (organization_id IN (SELECT ur.organization_id FROM user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "Users can insert service types in their org"
  ON service_types FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT ur.organization_id FROM user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "Users can update service types in their org"
  ON service_types FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT ur.organization_id FROM user_roles ur WHERE ur.user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT ur.organization_id FROM user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "Users can delete service types in their org"
  ON service_types FOR DELETE TO authenticated
  USING (organization_id IN (SELECT ur.organization_id FROM user_roles ur WHERE ur.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_service_types_org ON service_types(organization_id);

-- Project income table
CREATE TABLE IF NOT EXISTS project_income (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  income_number text NOT NULL,
  project_id uuid REFERENCES projects(id) NOT NULL,
  payment_date date NOT NULL,
  amount numeric(15,2) NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer', 'check', 'card', 'other')),
  received_by text DEFAULT '',
  notes text DEFAULT '',
  management_fee_amount numeric(15,2) NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, income_number)
);

ALTER TABLE project_income ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view income in their org"
  ON project_income FOR SELECT TO authenticated
  USING (organization_id IN (SELECT ur.organization_id FROM user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "Users can insert income in their org"
  ON project_income FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT ur.organization_id FROM user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "Users can update income in their org"
  ON project_income FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT ur.organization_id FROM user_roles ur WHERE ur.user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT ur.organization_id FROM user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "Users can delete income in their org"
  ON project_income FOR DELETE TO authenticated
  USING (organization_id IN (SELECT ur.organization_id FROM user_roles ur WHERE ur.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_project_income_org ON project_income(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_income_project ON project_income(project_id);

-- Project expenses table
CREATE TABLE IF NOT EXISTS project_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  expense_number text NOT NULL,
  project_id uuid REFERENCES projects(id),
  expense_type text NOT NULL CHECK (expense_type IN ('general', 'site')),
  expense_date date NOT NULL,
  description text NOT NULL,
  amount numeric(15,2) NOT NULL,
  payment_method text CHECK (payment_method IN ('cash', 'bank_transfer', 'check', 'card', 'other')),
  vendor_id uuid REFERENCES vendors(id),
  notes text DEFAULT '',
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, expense_number)
);

ALTER TABLE project_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view expenses in their org"
  ON project_expenses FOR SELECT TO authenticated
  USING (organization_id IN (SELECT ur.organization_id FROM user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "Users can insert expenses in their org"
  ON project_expenses FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT ur.organization_id FROM user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "Users can update expenses in their org"
  ON project_expenses FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT ur.organization_id FROM user_roles ur WHERE ur.user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT ur.organization_id FROM user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "Users can delete expenses in their org"
  ON project_expenses FOR DELETE TO authenticated
  USING (organization_id IN (SELECT ur.organization_id FROM user_roles ur WHERE ur.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_project_expenses_org ON project_expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_expenses_project ON project_expenses(project_id);

-- Vendor quotations table
CREATE TABLE IF NOT EXISTS vendor_quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  quotation_number text NOT NULL,
  vendor_id uuid REFERENCES vendors(id) NOT NULL,
  project_id uuid REFERENCES projects(id),
  quotation_date date NOT NULL,
  description text DEFAULT '',
  total_amount numeric(15,2) NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  valid_until date,
  notes text DEFAULT '',
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, quotation_number)
);

ALTER TABLE vendor_quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view quotations in their org"
  ON vendor_quotations FOR SELECT TO authenticated
  USING (organization_id IN (SELECT ur.organization_id FROM user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "Users can insert quotations in their org"
  ON vendor_quotations FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT ur.organization_id FROM user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "Users can update quotations in their org"
  ON vendor_quotations FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT ur.organization_id FROM user_roles ur WHERE ur.user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT ur.organization_id FROM user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "Users can delete quotations in their org"
  ON vendor_quotations FOR DELETE TO authenticated
  USING (organization_id IN (SELECT ur.organization_id FROM user_roles ur WHERE ur.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_vendor_quotations_org ON vendor_quotations(organization_id);
CREATE INDEX IF NOT EXISTS idx_vendor_quotations_vendor ON vendor_quotations(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_quotations_project ON vendor_quotations(project_id);

-- Vendor project payments table
CREATE TABLE IF NOT EXISTS vendor_project_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  payment_number text NOT NULL,
  vendor_id uuid REFERENCES vendors(id) NOT NULL,
  project_id uuid REFERENCES projects(id),
  quotation_id uuid REFERENCES vendor_quotations(id),
  payment_date date NOT NULL,
  amount numeric(15,2) NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer', 'check', 'card', 'other')),
  reference text DEFAULT '',
  notes text DEFAULT '',
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, payment_number)
);

ALTER TABLE vendor_project_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view vendor payments in their org"
  ON vendor_project_payments FOR SELECT TO authenticated
  USING (organization_id IN (SELECT ur.organization_id FROM user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "Users can insert vendor payments in their org"
  ON vendor_project_payments FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT ur.organization_id FROM user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "Users can update vendor payments in their org"
  ON vendor_project_payments FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT ur.organization_id FROM user_roles ur WHERE ur.user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT ur.organization_id FROM user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "Users can delete vendor payments in their org"
  ON vendor_project_payments FOR DELETE TO authenticated
  USING (organization_id IN (SELECT ur.organization_id FROM user_roles ur WHERE ur.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_vendor_payments_org ON vendor_project_payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payments_vendor ON vendor_project_payments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payments_project ON vendor_project_payments(project_id);

-- Cash transfers table
CREATE TABLE IF NOT EXISTS cash_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  transfer_number text NOT NULL,
  transfer_date date NOT NULL,
  from_account text NOT NULL,
  to_account text NOT NULL,
  amount numeric(15,2) NOT NULL,
  reference text DEFAULT '',
  notes text DEFAULT '',
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, transfer_number)
);

ALTER TABLE cash_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transfers in their org"
  ON cash_transfers FOR SELECT TO authenticated
  USING (organization_id IN (SELECT ur.organization_id FROM user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "Users can insert transfers in their org"
  ON cash_transfers FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT ur.organization_id FROM user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "Users can update transfers in their org"
  ON cash_transfers FOR UPDATE TO authenticated
  USING (organization_id IN (SELECT ur.organization_id FROM user_roles ur WHERE ur.user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT ur.organization_id FROM user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "Users can delete transfers in their org"
  ON cash_transfers FOR DELETE TO authenticated
  USING (organization_id IN (SELECT ur.organization_id FROM user_roles ur WHERE ur.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_cash_transfers_org ON cash_transfers(organization_id);
