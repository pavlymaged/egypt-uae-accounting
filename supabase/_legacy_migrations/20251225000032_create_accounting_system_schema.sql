/*
  # Accounting System Database Schema - Egypt & UAE MVP

  ## Overview
  Complete database schema for multi-tenant accounting system supporting Egypt and UAE markets.
  Includes full AR/AP, banking, GL, reporting, and compliance readiness.

  ## 1. Organizations and Users
  
  ### Tables Created:
  - `organizations` - Company profiles with country-specific settings
  - `user_roles` - Role assignments (Owner/Admin, Accountant, Staff)
  
  ### Fields Include:
  - Organization: name, country (Egypt/UAE), base_currency, VAT settings, fiscal year
  - User roles: role type, permissions scope
  
  ## 2. Master Data
  
  ### Tables Created:
  - `customers` - Customer master with billing details
  - `vendors` - Vendor master with payment details
  - `items` - Products/Services catalog
  - `accounts` - Chart of Accounts
  - `tax_rates` - VAT and tax rate definitions
  
  ## 3. Sales (Accounts Receivable)
  
  ### Tables Created:
  - `invoices` - Sales invoices and quotes
  - `invoice_lines` - Invoice line items
  - `payments_received` - Customer payments
  - `credit_notes` - Sales returns/adjustments
  
  ## 4. Purchases (Accounts Payable)
  
  ### Tables Created:
  - `bills` - Purchase bills
  - `bill_lines` - Bill line items
  - `payments_made` - Vendor payments
  - `vendor_credits` - Purchase returns/adjustments
  
  ## 5. Expenses and Banking
  
  ### Tables Created:
  - `expenses` - Business expenses
  - `bank_accounts` - Bank account registry
  - `bank_transactions` - Imported bank transactions
  - `bank_matches` - Reconciliation matches
  
  ## 6. Accounting Core
  
  ### Tables Created:
  - `journal_entries` - Manual journal entries
  - `journal_lines` - Journal entry lines (complete GL)
  - `period_locks` - Month-end closing locks
  
  ## 7. Compliance and Audit
  
  ### Tables Created:
  - `compliance_payloads` - E-invoicing structured data (Egypt ETA, UAE)
  - `attachments` - Document storage references
  - `audit_logs` - Complete audit trail
  
  ## 8. Security
  
  - RLS enabled on ALL tables
  - Policies enforce organization isolation
  - Role-based access control via user_roles
  - All policies check auth.uid() and organization membership
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. ORGANIZATIONS AND USERS
-- ============================================================================

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  country text NOT NULL CHECK (country IN ('Egypt', 'UAE')),
  base_currency text NOT NULL DEFAULT 'EGP',
  address text,
  phone text,
  email text,
  website text,
  vat_registration_number text,
  tax_registration_number text,
  fiscal_year_start_month int DEFAULT 1 CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
  default_vat_rate numeric(5,2) DEFAULT 0,
  logo_url text,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User roles table
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'accountant', 'staff')),
  permissions jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- ============================================================================
-- 2. MASTER DATA
-- ============================================================================

-- Chart of Accounts
CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense', 'cogs')),
  account_subtype text,
  parent_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  is_system boolean DEFAULT false,
  is_active boolean DEFAULT true,
  currency text,
  opening_balance numeric(15,2) DEFAULT 0,
  current_balance numeric(15,2) DEFAULT 0,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, code)
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  customer_number text NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  billing_address text,
  shipping_address text,
  vat_number text,
  tax_registration_number text,
  currency text DEFAULT 'EGP',
  payment_terms int DEFAULT 30,
  credit_limit numeric(15,2) DEFAULT 0,
  opening_balance numeric(15,2) DEFAULT 0,
  current_balance numeric(15,2) DEFAULT 0,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, customer_number)
);

-- Vendors
CREATE TABLE IF NOT EXISTS vendors (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  vendor_number text NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  billing_address text,
  vat_number text,
  tax_registration_number text,
  currency text DEFAULT 'EGP',
  payment_terms int DEFAULT 30,
  opening_balance numeric(15,2) DEFAULT 0,
  current_balance numeric(15,2) DEFAULT 0,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, vendor_number)
);

-- Items (Products/Services)
CREATE TABLE IF NOT EXISTS items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('service', 'product')),
  sku text,
  name text NOT NULL,
  description text,
  unit text DEFAULT 'unit',
  sales_price numeric(15,2) DEFAULT 0,
  purchase_price numeric(15,2) DEFAULT 0,
  income_account_id uuid REFERENCES accounts(id),
  expense_account_id uuid REFERENCES accounts(id),
  default_tax_rate_id uuid,
  track_inventory boolean DEFAULT false,
  quantity_on_hand numeric(15,3) DEFAULT 0,
  reorder_level numeric(15,3) DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tax Rates
CREATE TABLE IF NOT EXISTS tax_rates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  rate numeric(5,2) NOT NULL,
  tax_type text NOT NULL CHECK (tax_type IN ('vat', 'sales_tax', 'withholding')),
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 3. SALES (ACCOUNTS RECEIVABLE)
-- ============================================================================

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  invoice_type text NOT NULL CHECK (invoice_type IN ('invoice', 'quote')),
  invoice_number text NOT NULL,
  customer_id uuid REFERENCES customers(id) NOT NULL,
  invoice_date date NOT NULL,
  due_date date,
  reference text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'void')),
  currency text NOT NULL DEFAULT 'EGP',
  exchange_rate numeric(10,4) DEFAULT 1,
  subtotal numeric(15,2) DEFAULT 0,
  discount_amount numeric(15,2) DEFAULT 0,
  tax_amount numeric(15,2) DEFAULT 0,
  total_amount numeric(15,2) DEFAULT 0,
  amount_paid numeric(15,2) DEFAULT 0,
  amount_due numeric(15,2) DEFAULT 0,
  notes text,
  terms_and_conditions text,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, invoice_number)
);

-- Invoice Lines
CREATE TABLE IF NOT EXISTS invoice_lines (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  item_id uuid REFERENCES items(id),
  description text NOT NULL,
  quantity numeric(15,3) NOT NULL DEFAULT 1,
  unit_price numeric(15,2) NOT NULL,
  discount_percent numeric(5,2) DEFAULT 0,
  discount_amount numeric(15,2) DEFAULT 0,
  tax_rate_id uuid REFERENCES tax_rates(id),
  tax_amount numeric(15,2) DEFAULT 0,
  line_total numeric(15,2) NOT NULL,
  account_id uuid REFERENCES accounts(id),
  created_at timestamptz DEFAULT now()
);

-- Payments Received
CREATE TABLE IF NOT EXISTS payments_received (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  payment_number text NOT NULL,
  customer_id uuid REFERENCES customers(id) NOT NULL,
  payment_date date NOT NULL,
  amount numeric(15,2) NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer', 'check', 'card', 'other')),
  bank_account_id uuid,
  reference text,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, payment_number)
);

-- Payment Allocations (links payments to invoices)
CREATE TABLE IF NOT EXISTS payment_allocations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id uuid REFERENCES payments_received(id) ON DELETE CASCADE NOT NULL,
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  amount_allocated numeric(15,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Credit Notes
CREATE TABLE IF NOT EXISTS credit_notes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  credit_note_number text NOT NULL,
  customer_id uuid REFERENCES customers(id) NOT NULL,
  invoice_id uuid REFERENCES invoices(id),
  credit_date date NOT NULL,
  amount numeric(15,2) NOT NULL,
  reason text,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'applied')),
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, credit_note_number)
);

-- ============================================================================
-- 4. PURCHASES (ACCOUNTS PAYABLE)
-- ============================================================================

-- Bills
CREATE TABLE IF NOT EXISTS bills (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  bill_number text NOT NULL,
  vendor_id uuid REFERENCES vendors(id) NOT NULL,
  bill_date date NOT NULL,
  due_date date,
  reference text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'partially_paid', 'paid', 'void')),
  currency text NOT NULL DEFAULT 'EGP',
  exchange_rate numeric(10,4) DEFAULT 1,
  subtotal numeric(15,2) DEFAULT 0,
  discount_amount numeric(15,2) DEFAULT 0,
  tax_amount numeric(15,2) DEFAULT 0,
  total_amount numeric(15,2) DEFAULT 0,
  amount_paid numeric(15,2) DEFAULT 0,
  amount_due numeric(15,2) DEFAULT 0,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, bill_number)
);

-- Bill Lines
CREATE TABLE IF NOT EXISTS bill_lines (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  bill_id uuid REFERENCES bills(id) ON DELETE CASCADE NOT NULL,
  item_id uuid REFERENCES items(id),
  description text NOT NULL,
  quantity numeric(15,3) NOT NULL DEFAULT 1,
  unit_price numeric(15,2) NOT NULL,
  discount_percent numeric(5,2) DEFAULT 0,
  discount_amount numeric(15,2) DEFAULT 0,
  tax_rate_id uuid REFERENCES tax_rates(id),
  tax_amount numeric(15,2) DEFAULT 0,
  line_total numeric(15,2) NOT NULL,
  account_id uuid REFERENCES accounts(id),
  created_at timestamptz DEFAULT now()
);

-- Payments Made
CREATE TABLE IF NOT EXISTS payments_made (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  payment_number text NOT NULL,
  vendor_id uuid REFERENCES vendors(id) NOT NULL,
  payment_date date NOT NULL,
  amount numeric(15,2) NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer', 'check', 'card', 'other')),
  bank_account_id uuid,
  reference text,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, payment_number)
);

-- Payment Allocations for Bills
CREATE TABLE IF NOT EXISTS bill_payment_allocations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id uuid REFERENCES payments_made(id) ON DELETE CASCADE NOT NULL,
  bill_id uuid REFERENCES bills(id) ON DELETE CASCADE NOT NULL,
  amount_allocated numeric(15,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Vendor Credits
CREATE TABLE IF NOT EXISTS vendor_credits (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  credit_number text NOT NULL,
  vendor_id uuid REFERENCES vendors(id) NOT NULL,
  bill_id uuid REFERENCES bills(id),
  credit_date date NOT NULL,
  amount numeric(15,2) NOT NULL,
  reason text,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'applied')),
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, credit_number)
);

-- ============================================================================
-- 5. EXPENSES AND BANKING
-- ============================================================================

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  expense_number text NOT NULL,
  expense_date date NOT NULL,
  vendor_id uuid REFERENCES vendors(id),
  account_id uuid REFERENCES accounts(id) NOT NULL,
  amount numeric(15,2) NOT NULL,
  tax_amount numeric(15,2) DEFAULT 0,
  payment_method text CHECK (payment_method IN ('cash', 'bank_transfer', 'card', 'other')),
  reference text,
  description text,
  is_billable boolean DEFAULT false,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, expense_number)
);

-- Bank Accounts
CREATE TABLE IF NOT EXISTS bank_accounts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  account_name text NOT NULL,
  account_number text,
  bank_name text,
  currency text NOT NULL DEFAULT 'EGP',
  opening_balance numeric(15,2) DEFAULT 0,
  current_balance numeric(15,2) DEFAULT 0,
  gl_account_id uuid REFERENCES accounts(id),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Bank Transactions
CREATE TABLE IF NOT EXISTS bank_transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  bank_account_id uuid REFERENCES bank_accounts(id) ON DELETE CASCADE NOT NULL,
  transaction_date date NOT NULL,
  description text,
  reference text,
  debit_amount numeric(15,2) DEFAULT 0,
  credit_amount numeric(15,2) DEFAULT 0,
  balance numeric(15,2),
  status text DEFAULT 'unmatched' CHECK (status IN ('unmatched', 'matched', 'excluded')),
  imported_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Bank Matches (Reconciliation)
CREATE TABLE IF NOT EXISTS bank_matches (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  bank_transaction_id uuid REFERENCES bank_transactions(id) ON DELETE CASCADE NOT NULL,
  matched_type text NOT NULL CHECK (matched_type IN ('invoice', 'bill', 'expense', 'journal', 'manual')),
  matched_id uuid,
  matched_at timestamptz DEFAULT now(),
  matched_by uuid NOT NULL,
  notes text
);

-- ============================================================================
-- 6. ACCOUNTING CORE
-- ============================================================================

-- Journal Entries
CREATE TABLE IF NOT EXISTS journal_entries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  entry_number text NOT NULL,
  entry_date date NOT NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('manual', 'invoice', 'bill', 'payment', 'expense', 'opening_balance', 'adjustment')),
  reference_type text,
  reference_id uuid,
  description text,
  total_debit numeric(15,2) DEFAULT 0,
  total_credit numeric(15,2) DEFAULT 0,
  is_posted boolean DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, entry_number)
);

-- Journal Lines (General Ledger)
CREATE TABLE IF NOT EXISTS journal_lines (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_entry_id uuid REFERENCES journal_entries(id) ON DELETE CASCADE NOT NULL,
  account_id uuid REFERENCES accounts(id) NOT NULL,
  description text,
  debit_amount numeric(15,2) DEFAULT 0,
  credit_amount numeric(15,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Period Locks
CREATE TABLE IF NOT EXISTS period_locks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  period_year int NOT NULL,
  period_month int NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  is_locked boolean DEFAULT false,
  locked_by uuid,
  locked_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, period_year, period_month)
);

-- ============================================================================
-- 7. COMPLIANCE AND AUDIT
-- ============================================================================

-- Compliance Payloads (E-Invoicing for Egypt ETA & UAE)
CREATE TABLE IF NOT EXISTS compliance_payloads (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  document_type text NOT NULL CHECK (document_type IN ('invoice', 'credit_note', 'receipt')),
  document_id uuid NOT NULL,
  country text NOT NULL CHECK (country IN ('Egypt', 'UAE')),
  payload_data jsonb NOT NULL,
  submission_status text DEFAULT 'pending' CHECK (submission_status IN ('pending', 'submitted', 'accepted', 'rejected')),
  submission_response jsonb,
  submitted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Attachments
CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size int,
  mime_type text,
  uploaded_by uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete', 'approve', 'void')),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  changes jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 8. INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_roles_org ON user_roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_org ON accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_customers_org ON customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_vendors_org ON vendors(organization_id);
CREATE INDEX IF NOT EXISTS idx_items_org ON items(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_bills_org ON bills(organization_id);
CREATE INDEX IF NOT EXISTS idx_bills_vendor ON bills(vendor_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
CREATE INDEX IF NOT EXISTS idx_expenses_org ON expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_org ON bank_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_account ON bank_transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_org ON journal_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- ============================================================================
-- 9. ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments_received ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments_made ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE period_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_payloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to check user organization membership
CREATE OR REPLACE FUNCTION user_has_org_access(org_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE organization_id = org_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Organizations policies
CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (user_has_org_access(id));

CREATE POLICY "Users can update their organizations"
  ON organizations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE organization_id = id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Authenticated users can create organizations"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- User roles policies
CREATE POLICY "Users can view roles in their organizations"
  ON user_roles FOR SELECT
  TO authenticated
  USING (user_has_org_access(organization_id));

CREATE POLICY "Admins can manage user roles"
  ON user_roles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.organization_id = user_roles.organization_id
      AND ur.user_id = auth.uid()
      AND ur.role IN ('owner', 'admin')
    )
  );

-- Generic policies for all organization-scoped tables
-- Accounts
CREATE POLICY "Users can view accounts in their organization"
  ON accounts FOR SELECT
  TO authenticated
  USING (user_has_org_access(organization_id));

CREATE POLICY "Admins and accountants can manage accounts"
  ON accounts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE organization_id = accounts.organization_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'accountant')
    )
  );

-- Customers
CREATE POLICY "Users can view customers in their organization"
  ON customers FOR SELECT
  TO authenticated
  USING (user_has_org_access(organization_id));

CREATE POLICY "Users can manage customers in their organization"
  ON customers FOR ALL
  TO authenticated
  USING (user_has_org_access(organization_id))
  WITH CHECK (user_has_org_access(organization_id));

-- Vendors
CREATE POLICY "Users can view vendors in their organization"
  ON vendors FOR SELECT
  TO authenticated
  USING (user_has_org_access(organization_id));

CREATE POLICY "Users can manage vendors in their organization"
  ON vendors FOR ALL
  TO authenticated
  USING (user_has_org_access(organization_id))
  WITH CHECK (user_has_org_access(organization_id));

-- Items
CREATE POLICY "Users can view items in their organization"
  ON items FOR SELECT
  TO authenticated
  USING (user_has_org_access(organization_id));

CREATE POLICY "Users can manage items in their organization"
  ON items FOR ALL
  TO authenticated
  USING (user_has_org_access(organization_id))
  WITH CHECK (user_has_org_access(organization_id));

-- Tax rates
CREATE POLICY "Users can view tax rates in their organization"
  ON tax_rates FOR SELECT
  TO authenticated
  USING (user_has_org_access(organization_id));

CREATE POLICY "Admins and accountants can manage tax rates"
  ON tax_rates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE organization_id = tax_rates.organization_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'accountant')
    )
  );

-- Invoices
CREATE POLICY "Users can view invoices in their organization"
  ON invoices FOR SELECT
  TO authenticated
  USING (user_has_org_access(organization_id));

CREATE POLICY "Users can manage invoices in their organization"
  ON invoices FOR ALL
  TO authenticated
  USING (user_has_org_access(organization_id))
  WITH CHECK (user_has_org_access(organization_id));

-- Invoice lines
CREATE POLICY "Users can view invoice lines in their organization"
  ON invoice_lines FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_lines.invoice_id
      AND user_has_org_access(invoices.organization_id)
    )
  );

CREATE POLICY "Users can manage invoice lines in their organization"
  ON invoice_lines FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_lines.invoice_id
      AND user_has_org_access(invoices.organization_id)
    )
  );

-- Payments received
CREATE POLICY "Users can view payments in their organization"
  ON payments_received FOR SELECT
  TO authenticated
  USING (user_has_org_access(organization_id));

CREATE POLICY "Users can manage payments in their organization"
  ON payments_received FOR ALL
  TO authenticated
  USING (user_has_org_access(organization_id))
  WITH CHECK (user_has_org_access(organization_id));

-- Payment allocations
CREATE POLICY "Users can view payment allocations in their organization"
  ON payment_allocations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM payments_received
      WHERE payments_received.id = payment_allocations.payment_id
      AND user_has_org_access(payments_received.organization_id)
    )
  );

CREATE POLICY "Users can manage payment allocations in their organization"
  ON payment_allocations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM payments_received
      WHERE payments_received.id = payment_allocations.payment_id
      AND user_has_org_access(payments_received.organization_id)
    )
  );

-- Credit notes
CREATE POLICY "Users can view credit notes in their organization"
  ON credit_notes FOR SELECT
  TO authenticated
  USING (user_has_org_access(organization_id));

CREATE POLICY "Users can manage credit notes in their organization"
  ON credit_notes FOR ALL
  TO authenticated
  USING (user_has_org_access(organization_id))
  WITH CHECK (user_has_org_access(organization_id));

-- Bills
CREATE POLICY "Users can view bills in their organization"
  ON bills FOR SELECT
  TO authenticated
  USING (user_has_org_access(organization_id));

CREATE POLICY "Users can manage bills in their organization"
  ON bills FOR ALL
  TO authenticated
  USING (user_has_org_access(organization_id))
  WITH CHECK (user_has_org_access(organization_id));

-- Bill lines
CREATE POLICY "Users can view bill lines in their organization"
  ON bill_lines FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bills
      WHERE bills.id = bill_lines.bill_id
      AND user_has_org_access(bills.organization_id)
    )
  );

CREATE POLICY "Users can manage bill lines in their organization"
  ON bill_lines FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bills
      WHERE bills.id = bill_lines.bill_id
      AND user_has_org_access(bills.organization_id)
    )
  );

-- Payments made
CREATE POLICY "Users can view vendor payments in their organization"
  ON payments_made FOR SELECT
  TO authenticated
  USING (user_has_org_access(organization_id));

CREATE POLICY "Users can manage vendor payments in their organization"
  ON payments_made FOR ALL
  TO authenticated
  USING (user_has_org_access(organization_id))
  WITH CHECK (user_has_org_access(organization_id));

-- Bill payment allocations
CREATE POLICY "Users can view bill payment allocations in their organization"
  ON bill_payment_allocations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM payments_made
      WHERE payments_made.id = bill_payment_allocations.payment_id
      AND user_has_org_access(payments_made.organization_id)
    )
  );

CREATE POLICY "Users can manage bill payment allocations in their organization"
  ON bill_payment_allocations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM payments_made
      WHERE payments_made.id = bill_payment_allocations.payment_id
      AND user_has_org_access(payments_made.organization_id)
    )
  );

-- Vendor credits
CREATE POLICY "Users can view vendor credits in their organization"
  ON vendor_credits FOR SELECT
  TO authenticated
  USING (user_has_org_access(organization_id));

CREATE POLICY "Users can manage vendor credits in their organization"
  ON vendor_credits FOR ALL
  TO authenticated
  USING (user_has_org_access(organization_id))
  WITH CHECK (user_has_org_access(organization_id));

-- Expenses
CREATE POLICY "Users can view expenses in their organization"
  ON expenses FOR SELECT
  TO authenticated
  USING (user_has_org_access(organization_id));

CREATE POLICY "Users can manage expenses in their organization"
  ON expenses FOR ALL
  TO authenticated
  USING (user_has_org_access(organization_id))
  WITH CHECK (user_has_org_access(organization_id));

-- Bank accounts
CREATE POLICY "Users can view bank accounts in their organization"
  ON bank_accounts FOR SELECT
  TO authenticated
  USING (user_has_org_access(organization_id));

CREATE POLICY "Admins and accountants can manage bank accounts"
  ON bank_accounts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE organization_id = bank_accounts.organization_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'accountant')
    )
  );

-- Bank transactions
CREATE POLICY "Users can view bank transactions in their organization"
  ON bank_transactions FOR SELECT
  TO authenticated
  USING (user_has_org_access(organization_id));

CREATE POLICY "Admins and accountants can manage bank transactions"
  ON bank_transactions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE organization_id = bank_transactions.organization_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'accountant')
    )
  );

-- Bank matches
CREATE POLICY "Users can view bank matches in their organization"
  ON bank_matches FOR SELECT
  TO authenticated
  USING (user_has_org_access(organization_id));

CREATE POLICY "Admins and accountants can manage bank matches"
  ON bank_matches FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE organization_id = bank_matches.organization_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'accountant')
    )
  );

-- Journal entries
CREATE POLICY "Users can view journal entries in their organization"
  ON journal_entries FOR SELECT
  TO authenticated
  USING (user_has_org_access(organization_id));

CREATE POLICY "Accountants can manage journal entries"
  ON journal_entries FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE organization_id = journal_entries.organization_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'accountant')
    )
  );

-- Journal lines
CREATE POLICY "Users can view journal lines in their organization"
  ON journal_lines FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries
      WHERE journal_entries.id = journal_lines.journal_entry_id
      AND user_has_org_access(journal_entries.organization_id)
    )
  );

CREATE POLICY "Accountants can manage journal lines"
  ON journal_lines FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries je
      JOIN user_roles ur ON ur.organization_id = je.organization_id
      WHERE je.id = journal_lines.journal_entry_id
      AND ur.user_id = auth.uid()
      AND ur.role IN ('owner', 'admin', 'accountant')
    )
  );

-- Period locks
CREATE POLICY "Users can view period locks in their organization"
  ON period_locks FOR SELECT
  TO authenticated
  USING (user_has_org_access(organization_id));

CREATE POLICY "Admins and accountants can manage period locks"
  ON period_locks FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE organization_id = period_locks.organization_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'accountant')
    )
  );

-- Compliance payloads
CREATE POLICY "Users can view compliance payloads in their organization"
  ON compliance_payloads FOR SELECT
  TO authenticated
  USING (user_has_org_access(organization_id));

CREATE POLICY "System can manage compliance payloads"
  ON compliance_payloads FOR ALL
  TO authenticated
  USING (user_has_org_access(organization_id))
  WITH CHECK (user_has_org_access(organization_id));

-- Attachments
CREATE POLICY "Users can view attachments in their organization"
  ON attachments FOR SELECT
  TO authenticated
  USING (user_has_org_access(organization_id));

CREATE POLICY "Users can manage attachments in their organization"
  ON attachments FOR ALL
  TO authenticated
  USING (user_has_org_access(organization_id))
  WITH CHECK (user_has_org_access(organization_id));

-- Audit logs
CREATE POLICY "Users can view audit logs in their organization"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (user_has_org_access(organization_id));

CREATE POLICY "System can create audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_has_org_access(organization_id));