/*
  # Fix Accounts and Tax Rates Insert Policies

  ## Problem
  During organization onboarding, default accounts and tax rates need to be created,
  but the user doesn't have an established role yet in the same transaction.

  ## Solution
  1. Split the "ALL" policies into separate INSERT, UPDATE, DELETE policies
  2. Allow INSERT if user has ANY role in the organization (including newly created owner role)
  3. Restrict UPDATE/DELETE to admin/accountant only

  ## Security
  - Users can insert accounts/tax rates for organizations they belong to
  - Only admins and accountants can modify or delete
*/

-- ==== ACCOUNTS TABLE ====

-- Drop the existing "ALL" policy
DROP POLICY IF EXISTS "Admins and accountants can manage accounts" ON accounts;

-- Create separate policies for different operations
CREATE POLICY "Users can insert accounts in their organization"
  ON accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE organization_id = accounts.organization_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and accountants can update accounts"
  ON accounts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE organization_id = accounts.organization_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'accountant')
    )
  );

CREATE POLICY "Admins and accountants can delete accounts"
  ON accounts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE organization_id = accounts.organization_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'accountant')
    )
  );

-- ==== TAX RATES TABLE ====

-- Drop the existing "ALL" policy
DROP POLICY IF EXISTS "Admins and accountants can manage tax rates" ON tax_rates;

-- Create separate policies for different operations
CREATE POLICY "Users can insert tax rates in their organization"
  ON tax_rates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE organization_id = tax_rates.organization_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and accountants can update tax rates"
  ON tax_rates
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE organization_id = tax_rates.organization_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'accountant')
    )
  );

CREATE POLICY "Admins and accountants can delete tax rates"
  ON tax_rates
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE organization_id = tax_rates.organization_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'accountant')
    )
  );