/*
  # Fix Database Performance and Security Issues

  ## Changes Made

  ### 1. Add Missing Foreign Key Indexes
  - Add indexes for all foreign keys that were missing covering indexes
  - This improves JOIN performance and foreign key constraint checking

  ### 2. Optimize RLS Policies (Auth Initialization Plan)
  - Replace `auth.uid()` with `(select auth.uid())` in all RLS policies
  - This prevents re-evaluation of auth functions for each row, significantly improving query performance

  ### 3. Remove Unused Indexes
  - Drop indexes that have never been used
  - Reduces storage overhead and improves write performance

  ### 4. Fix Function Search Paths
  - Set explicit search_path for all functions to prevent security issues

  ## Performance Impact
  - Foreign key indexes: Dramatically improves JOIN performance
  - RLS optimization: Reduces CPU usage for queries with many rows
  - Removing unused indexes: Improves INSERT/UPDATE/DELETE performance
*/

-- =====================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_accounts_parent_account_id ON accounts(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_attachments_organization_id ON attachments(organization_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_gl_account_id ON bank_accounts(gl_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_organization_id ON bank_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_bank_matches_bank_transaction_id ON bank_matches(bank_transaction_id);
CREATE INDEX IF NOT EXISTS idx_bank_matches_organization_id ON bank_matches(organization_id);
CREATE INDEX IF NOT EXISTS idx_bill_lines_account_id ON bill_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_bill_lines_bill_id ON bill_lines(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_lines_item_id ON bill_lines(item_id);
CREATE INDEX IF NOT EXISTS idx_bill_lines_tax_rate_id ON bill_lines(tax_rate_id);
CREATE INDEX IF NOT EXISTS idx_bill_payment_allocations_bill_id ON bill_payment_allocations(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_payment_allocations_payment_id ON bill_payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_compliance_payloads_organization_id ON compliance_payloads(organization_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_customer_id ON credit_notes(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice_id ON credit_notes(invoice_id);
CREATE INDEX IF NOT EXISTS idx_expenses_account_id ON expenses(account_id);
CREATE INDEX IF NOT EXISTS idx_expenses_vendor_id ON expenses(vendor_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_account_id ON invoice_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice_id ON invoice_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_item_id ON invoice_lines(item_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_tax_rate_id ON invoice_lines(tax_rate_id);
CREATE INDEX IF NOT EXISTS idx_items_expense_account_id ON items(expense_account_id);
CREATE INDEX IF NOT EXISTS idx_items_income_account_id ON items(income_account_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_journal_entry_id ON journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_invoice_id ON payment_allocations(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment_id ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_made_vendor_id ON payments_made(vendor_id);
CREATE INDEX IF NOT EXISTS idx_payments_received_customer_id ON payments_received(customer_id);
CREATE INDEX IF NOT EXISTS idx_tax_rates_organization_id ON tax_rates(organization_id);
CREATE INDEX IF NOT EXISTS idx_vendor_credits_bill_id ON vendor_credits(bill_id);
CREATE INDEX IF NOT EXISTS idx_vendor_credits_vendor_id ON vendor_credits(vendor_id);

-- =====================================================
-- 2. DROP UNUSED INDEXES
-- =====================================================

DROP INDEX IF EXISTS idx_accounts_org;
DROP INDEX IF EXISTS idx_items_org;
DROP INDEX IF EXISTS idx_invoices_customer;
DROP INDEX IF EXISTS idx_invoices_status;
DROP INDEX IF EXISTS idx_bills_vendor;
DROP INDEX IF EXISTS idx_bills_status;
DROP INDEX IF EXISTS idx_expenses_org;
DROP INDEX IF EXISTS idx_bank_transactions_org;
DROP INDEX IF EXISTS idx_bank_transactions_account;
DROP INDEX IF EXISTS idx_journal_entries_org;
DROP INDEX IF EXISTS idx_journal_entries_date;
DROP INDEX IF EXISTS idx_journal_lines_account;
DROP INDEX IF EXISTS idx_audit_logs_org;
DROP INDEX IF EXISTS idx_audit_logs_entity;
DROP INDEX IF EXISTS idx_user_management_logs_org_id;
DROP INDEX IF EXISTS idx_user_management_logs_admin_user;
DROP INDEX IF EXISTS idx_user_management_logs_target_user;
DROP INDEX IF EXISTS idx_user_roles_login_enabled;

-- =====================================================
-- 3. OPTIMIZE RLS POLICIES - Replace auth.uid() with (select auth.uid())
-- =====================================================

DROP POLICY IF EXISTS "Users can create their own initial role" ON user_roles;
CREATE POLICY "Users can create their own initial role"
  ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid()) AND
    NOT EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can update user roles" ON user_roles;
CREATE POLICY "Admins can update user roles"
  ON user_roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (select auth.uid())
      AND organization_id = user_roles.organization_id
      AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins can delete user roles" ON user_roles;
CREATE POLICY "Admins can delete user roles"
  ON user_roles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (select auth.uid())
      AND organization_id = user_roles.organization_id
      AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins can invite users" ON user_roles;
CREATE POLICY "Admins can invite users"
  ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (select auth.uid())
      AND organization_id = user_roles.organization_id
      AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
CREATE POLICY "Users can view their own roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert accounts in their organization" ON accounts;
CREATE POLICY "Users can insert accounts in their organization"
  ON accounts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (select auth.uid())
      AND organization_id = accounts.organization_id
    )
  );

DROP POLICY IF EXISTS "Admins and accountants can update accounts" ON accounts;
CREATE POLICY "Admins and accountants can update accounts"
  ON accounts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (select auth.uid())
      AND organization_id = accounts.organization_id
      AND role IN ('owner', 'admin', 'accountant')
    )
  );

DROP POLICY IF EXISTS "Admins and accountants can delete accounts" ON accounts;
CREATE POLICY "Admins and accountants can delete accounts"
  ON accounts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (select auth.uid())
      AND organization_id = accounts.organization_id
      AND role IN ('owner', 'admin', 'accountant')
    )
  );

DROP POLICY IF EXISTS "Users can insert tax rates in their organization" ON tax_rates;
CREATE POLICY "Users can insert tax rates in their organization"
  ON tax_rates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (select auth.uid())
      AND organization_id = tax_rates.organization_id
    )
  );

DROP POLICY IF EXISTS "Admins and accountants can update tax rates" ON tax_rates;
CREATE POLICY "Admins and accountants can update tax rates"
  ON tax_rates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (select auth.uid())
      AND organization_id = tax_rates.organization_id
      AND role IN ('owner', 'admin', 'accountant')
    )
  );

DROP POLICY IF EXISTS "Admins and accountants can delete tax rates" ON tax_rates;
CREATE POLICY "Admins and accountants can delete tax rates"
  ON tax_rates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (select auth.uid())
      AND organization_id = tax_rates.organization_id
      AND role IN ('owner', 'admin', 'accountant')
    )
  );

DROP POLICY IF EXISTS "enable_select_for_users_based_on_user_roles" ON organizations;
CREATE POLICY "enable_select_for_users_based_on_user_roles"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM user_roles
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "enable_update_for_admins" ON organizations;
CREATE POLICY "enable_update_for_admins"
  ON organizations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (select auth.uid())
      AND organization_id = organizations.id
      AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "enable_delete_for_owners" ON organizations;
CREATE POLICY "enable_delete_for_owners"
  ON organizations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (select auth.uid())
      AND organization_id = organizations.id
      AND role = 'owner'
    )
  );

DROP POLICY IF EXISTS "Admins and accountants can manage bank accounts" ON bank_accounts;
CREATE POLICY "Admins and accountants can manage bank accounts"
  ON bank_accounts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (select auth.uid())
      AND organization_id = bank_accounts.organization_id
      AND role IN ('owner', 'admin', 'accountant')
    )
  );

DROP POLICY IF EXISTS "Admins and accountants can manage bank transactions" ON bank_transactions;
CREATE POLICY "Admins and accountants can manage bank transactions"
  ON bank_transactions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (select auth.uid())
      AND organization_id = bank_transactions.organization_id
      AND role IN ('owner', 'admin', 'accountant')
    )
  );

DROP POLICY IF EXISTS "Admins and accountants can manage bank matches" ON bank_matches;
CREATE POLICY "Admins and accountants can manage bank matches"
  ON bank_matches FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (select auth.uid())
      AND organization_id = bank_matches.organization_id
      AND role IN ('owner', 'admin', 'accountant')
    )
  );

DROP POLICY IF EXISTS "Accountants can manage journal entries" ON journal_entries;
CREATE POLICY "Accountants can manage journal entries"
  ON journal_entries FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (select auth.uid())
      AND organization_id = journal_entries.organization_id
      AND role IN ('owner', 'admin', 'accountant')
    )
  );

DROP POLICY IF EXISTS "Accountants can manage journal lines" ON journal_lines;
CREATE POLICY "Accountants can manage journal lines"
  ON journal_lines FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries je
      INNER JOIN user_roles ur ON ur.organization_id = je.organization_id
      WHERE je.id = journal_lines.journal_entry_id
      AND ur.user_id = (select auth.uid())
      AND ur.role IN ('owner', 'admin', 'accountant')
    )
  );

DROP POLICY IF EXISTS "Admins and accountants can manage period locks" ON period_locks;
CREATE POLICY "Admins and accountants can manage period locks"
  ON period_locks FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (select auth.uid())
      AND organization_id = period_locks.organization_id
      AND role IN ('owner', 'admin', 'accountant')
    )
  );

DROP POLICY IF EXISTS "Admins can view user management logs" ON user_management_logs;
CREATE POLICY "Admins can view user management logs"
  ON user_management_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (select auth.uid())
      AND organization_id = user_management_logs.organization_id
      AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "System can insert user management logs" ON user_management_logs;
CREATE POLICY "System can insert user management logs"
  ON user_management_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    admin_user_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = (select auth.uid())
      AND organization_id = user_management_logs.organization_id
      AND role IN ('owner', 'admin')
    )
  );

-- =====================================================
-- 4. FIX FUNCTION SEARCH PATHS
-- =====================================================

DROP TRIGGER IF EXISTS trigger_auto_enable_login ON user_roles;

DROP FUNCTION IF EXISTS can_user_login(uuid, uuid);
CREATE FUNCTION can_user_login(user_id_input uuid, organization_id_input uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  user_role_record RECORD;
BEGIN
  SELECT role, login_enabled INTO user_role_record
  FROM user_roles
  WHERE user_id = user_id_input
    AND organization_id = organization_id_input;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF user_role_record.role IN ('owner', 'admin') THEN
    RETURN true;
  END IF;

  RETURN user_role_record.login_enabled;
END;
$$;

DROP FUNCTION IF EXISTS auto_enable_login_for_admins();
CREATE FUNCTION auto_enable_login_for_admins()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.role = 'admin' THEN
    NEW.login_enabled := true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_enable_login
  BEFORE INSERT OR UPDATE ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION auto_enable_login_for_admins();

DROP FUNCTION IF EXISTS get_user_id_by_email(text);
CREATE FUNCTION get_user_id_by_email(user_email text)
RETURNS TABLE(id uuid, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT au.id, au.email::text
  FROM auth.users au
  WHERE au.email = user_email;
END;
$$;

DROP FUNCTION IF EXISTS user_has_org_access(uuid, uuid);
CREATE FUNCTION user_has_org_access(user_id_input uuid, organization_id_input uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_id = user_id_input
      AND organization_id = organization_id_input
  );
END;
$$;
