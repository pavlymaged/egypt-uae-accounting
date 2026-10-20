/*
  # Fix Security and Performance Issues

  1. Performance Improvements
    - Add missing indexes on foreign key columns for better query performance
    - Fix RLS policies to use `(select auth.uid())` pattern to avoid re-evaluation
  
  2. Security Improvements
    - Remove duplicate permissive policies that create confusion
    - Fix function search paths to prevent SQL injection
  
  3. Changes Applied
    - Add indexes on unindexed foreign keys
    - Optimize RLS policies with subquery pattern
    - Set immutable search_path on functions
    - Remove redundant duplicate policies
*/

-- ============================================================================
-- PART 1: Add Missing Indexes on Foreign Keys
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_bank_account_id ON bank_transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_organization_id ON bank_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_bills_vendor_id ON bills(vendor_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_items_organization_id ON items(organization_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account_id ON journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_user_management_logs_organization_id ON user_management_logs(organization_id);

-- ============================================================================
-- PART 2: Fix RLS Policies - Wrap auth.uid() with SELECT
-- ============================================================================

-- Fix organizations table policies
DROP POLICY IF EXISTS "Super admins can update their organization" ON organizations;
CREATE POLICY "Super admins can update their organization"
  ON organizations
  FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT organization_id 
      FROM user_roles 
      WHERE user_id = (select auth.uid()) 
      AND role = 'super_admin'
    )
  )
  WITH CHECK (
    id IN (
      SELECT organization_id 
      FROM user_roles 
      WHERE user_id = (select auth.uid()) 
      AND role = 'super_admin'
    )
  );

-- Fix user_roles table policies
DROP POLICY IF EXISTS "Super admins can delete user roles" ON user_roles;
CREATE POLICY "Super admins can delete user roles"
  ON user_roles
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM user_roles 
      WHERE user_id = (select auth.uid()) 
      AND role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Super admins can update user roles" ON user_roles;
CREATE POLICY "Super admins can update user roles"
  ON user_roles
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM user_roles 
      WHERE user_id = (select auth.uid()) 
      AND role = 'super_admin'
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM user_roles 
      WHERE user_id = (select auth.uid()) 
      AND role = 'super_admin'
    )
  );

-- Fix accounts table policies
DROP POLICY IF EXISTS "Super admins can delete accounts" ON accounts;
CREATE POLICY "Super admins can delete accounts"
  ON accounts
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM user_roles 
      WHERE user_id = (select auth.uid()) 
      AND role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Super admins can update accounts" ON accounts;
CREATE POLICY "Super admins can update accounts"
  ON accounts
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM user_roles 
      WHERE user_id = (select auth.uid()) 
      AND role = 'super_admin'
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM user_roles 
      WHERE user_id = (select auth.uid()) 
      AND role = 'super_admin'
    )
  );

-- Fix tax_rates table policies
DROP POLICY IF EXISTS "Super admins can delete tax rates" ON tax_rates;
CREATE POLICY "Super admins can delete tax rates"
  ON tax_rates
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM user_roles 
      WHERE user_id = (select auth.uid()) 
      AND role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Super admins can update tax rates" ON tax_rates;
CREATE POLICY "Super admins can update tax rates"
  ON tax_rates
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM user_roles 
      WHERE user_id = (select auth.uid()) 
      AND role = 'super_admin'
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM user_roles 
      WHERE user_id = (select auth.uid()) 
      AND role = 'super_admin'
    )
  );

-- Fix user_management_logs table policies
DROP POLICY IF EXISTS "Super admins can insert user management logs" ON user_management_logs;
CREATE POLICY "Super admins can insert user management logs"
  ON user_management_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM user_roles 
      WHERE user_id = (select auth.uid()) 
      AND role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Super admins can view user management logs" ON user_management_logs;
CREATE POLICY "Super admins can view user management logs"
  ON user_management_logs
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM user_roles 
      WHERE user_id = (select auth.uid()) 
      AND role = 'super_admin'
    )
  );

-- ============================================================================
-- PART 3: Remove Duplicate Policies (Keep Most Specific Ones)
-- ============================================================================

-- Accounts: Remove old admin/accountant policies, keep super_admin
DROP POLICY IF EXISTS "Admins and accountants can delete accounts" ON accounts;
DROP POLICY IF EXISTS "Admins and accountants can update accounts" ON accounts;

-- Tax rates: Remove old admin/accountant policies, keep super_admin
DROP POLICY IF EXISTS "Admins and accountants can delete tax rates" ON tax_rates;
DROP POLICY IF EXISTS "Admins and accountants can update tax rates" ON tax_rates;

-- User roles: Remove old admin policies, keep super_admin
DROP POLICY IF EXISTS "Admins can delete user roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can update user roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can invite users" ON user_roles;

-- Organizations: Remove old enable_update_for_admins policy
DROP POLICY IF EXISTS "enable_update_for_admins" ON organizations;

-- For tables with duplicate view/manage policies, keep only the broader "manage" policies
-- These tables have separate view and manage policies which is redundant

DROP POLICY IF EXISTS "Users can view attachments in their organization" ON attachments;
DROP POLICY IF EXISTS "Users can view bank accounts in their organization" ON bank_accounts;
DROP POLICY IF EXISTS "Users can view bank matches in their organization" ON bank_matches;
DROP POLICY IF EXISTS "Users can view bank transactions in their organization" ON bank_transactions;
DROP POLICY IF EXISTS "Users can view bill lines in their organization" ON bill_lines;
DROP POLICY IF EXISTS "Users can view bill payment allocations in their organization" ON bill_payment_allocations;
DROP POLICY IF EXISTS "Users can view bills in their organization" ON bills;
DROP POLICY IF EXISTS "Users can view compliance payloads in their organization" ON compliance_payloads;
DROP POLICY IF EXISTS "Users can view credit notes in their organization" ON credit_notes;
DROP POLICY IF EXISTS "Users can view customers in their organization" ON customers;
DROP POLICY IF EXISTS "Users can view expenses in their organization" ON expenses;
DROP POLICY IF EXISTS "Users can view invoice lines in their organization" ON invoice_lines;
DROP POLICY IF EXISTS "Users can view invoices in their organization" ON invoices;
DROP POLICY IF EXISTS "Users can view items in their organization" ON items;
DROP POLICY IF EXISTS "Users can view journal entries in their organization" ON journal_entries;
DROP POLICY IF EXISTS "Users can view journal lines in their organization" ON journal_lines;
DROP POLICY IF EXISTS "Users can view payment allocations in their organization" ON payment_allocations;
DROP POLICY IF EXISTS "Users can view vendor payments in their organization" ON payments_made;
DROP POLICY IF EXISTS "Users can view payments in their organization" ON payments_received;
DROP POLICY IF EXISTS "Users can view period locks in their organization" ON period_locks;
DROP POLICY IF EXISTS "Users can view vendor credits in their organization" ON vendor_credits;
DROP POLICY IF EXISTS "Users can view vendors in their organization" ON vendors;

-- ============================================================================
-- PART 4: Fix Function Search Paths
-- ============================================================================

-- Fix can_user_login function
CREATE OR REPLACE FUNCTION can_user_login(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  user_id uuid;
  has_login_enabled boolean;
BEGIN
  -- Get user ID from auth.users
  SELECT id INTO user_id
  FROM auth.users
  WHERE email = user_email;

  IF user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check if user has login enabled in any organization
  SELECT COALESCE(bool_or(can_login), false) INTO has_login_enabled
  FROM user_roles
  WHERE user_roles.user_id = can_user_login.user_id;

  RETURN COALESCE(has_login_enabled, false);
END;
$$;

-- Fix auto_enable_login_for_admins function
CREATE OR REPLACE FUNCTION auto_enable_login_for_admins()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.role = 'super_admin' THEN
    NEW.can_login := true;
  END IF;
  RETURN NEW;
END;
$$;

-- Fix user_has_org_access function
CREATE OR REPLACE FUNCTION user_has_org_access(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.organization_id = org_id
  );
END;
$$;