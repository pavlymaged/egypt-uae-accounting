/*
  # Consolidate Admin and Owner Roles into Super Administrator
  
  ## Overview
  This migration consolidates the 'admin' and 'owner' roles into a single 'super_admin' role
  with combined authorities from both previous roles.
  
  ## 1. Changes Made
    - Rename 'owner' and 'admin' roles to 'super_admin'
    - Update all references in user_roles table
    - Update check constraints to include new role name
    - Update all RLS policies to recognize super_admin
    - Update triggers and functions
  
  ## 2. Security Impact
    - All existing owners and admins will become super_admins
    - Super admins retain all previous permissions
    - No data loss or access disruption
  
  ## 3. Important Notes
    - This is a one-way migration (no rollback)
    - All existing admin/owner users maintain their access
    - Login access remains enabled for all super_admins
*/

-- Step 1: Drop the existing role check constraint
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;

-- Step 2: Update all 'owner' and 'admin' roles to 'super_admin' in user_roles table
UPDATE user_roles 
SET role = 'super_admin' 
WHERE role IN ('admin', 'owner');

-- Step 3: Add the new role check constraint
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check 
  CHECK (role IN ('super_admin', 'accountant', 'staff'));

-- Step 4: Update user_management_logs action check constraint if exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_management_logs_action_check'
  ) THEN
    ALTER TABLE user_management_logs DROP CONSTRAINT user_management_logs_action_check;
    ALTER TABLE user_management_logs ADD CONSTRAINT user_management_logs_action_check
      CHECK (action IN ('user_created', 'user_invited', 'role_updated', 'login_enabled', 'login_disabled', 'user_removed', 'password_reset'));
  END IF;
END $$;

-- Step 5: Update the auto_enable_login trigger function
CREATE OR REPLACE FUNCTION auto_enable_login_for_admins()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role = 'super_admin' THEN
    NEW.login_enabled := true;
  END IF;
  RETURN NEW;
END;
$$;

-- Step 6: Update all RLS policies to use 'super_admin' instead of 'owner' and 'admin'

-- User management logs policies
DROP POLICY IF EXISTS "Admins can view user management logs" ON user_management_logs;
DROP POLICY IF EXISTS "Super admins can view user management logs" ON user_management_logs;
CREATE POLICY "Super admins can view user management logs"
  ON user_management_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.organization_id = user_management_logs.organization_id
      AND user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "System can insert user management logs" ON user_management_logs;
DROP POLICY IF EXISTS "Super admins can insert user management logs" ON user_management_logs;
CREATE POLICY "Super admins can insert user management logs"
  ON user_management_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.organization_id = user_management_logs.organization_id
      AND user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

-- Update organizations table policies
DROP POLICY IF EXISTS "Organization owners can update their organization" ON organizations;
DROP POLICY IF EXISTS "Super admins can update their organization" ON organizations;
CREATE POLICY "Super admins can update their organization"
  ON organizations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.organization_id = organizations.id
      AND user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.organization_id = organizations.id
      AND user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

-- Update user_roles policies for super admin management
DROP POLICY IF EXISTS "Organization admins can update user roles" ON user_roles;
DROP POLICY IF EXISTS "Super admins can update user roles" ON user_roles;
CREATE POLICY "Super admins can update user roles"
  ON user_roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.organization_id = user_roles.organization_id
      AND ur.user_id = auth.uid()
      AND ur.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.organization_id = user_roles.organization_id
      AND ur.user_id = auth.uid()
      AND ur.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Organization admins can delete user roles" ON user_roles;
DROP POLICY IF EXISTS "Super admins can delete user roles" ON user_roles;
CREATE POLICY "Super admins can delete user roles"
  ON user_roles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.organization_id = user_roles.organization_id
      AND ur.user_id = auth.uid()
      AND ur.role = 'super_admin'
    )
  );

-- Update accounts policies
DROP POLICY IF EXISTS "Admins can update accounts" ON accounts;
DROP POLICY IF EXISTS "Super admins can update accounts" ON accounts;
CREATE POLICY "Super admins can update accounts"
  ON accounts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.organization_id = accounts.organization_id
      AND user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete accounts" ON accounts;
DROP POLICY IF EXISTS "Super admins can delete accounts" ON accounts;
CREATE POLICY "Super admins can delete accounts"
  ON accounts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.organization_id = accounts.organization_id
      AND user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

-- Update tax_rates policies
DROP POLICY IF EXISTS "Admins can update tax rates" ON tax_rates;
DROP POLICY IF EXISTS "Super admins can update tax rates" ON tax_rates;
CREATE POLICY "Super admins can update tax rates"
  ON tax_rates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.organization_id = tax_rates.organization_id
      AND user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete tax rates" ON tax_rates;
DROP POLICY IF EXISTS "Super admins can delete tax rates" ON tax_rates;
CREATE POLICY "Super admins can delete tax rates"
  ON tax_rates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.organization_id = tax_rates.organization_id
      AND user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

-- Step 7: Add comments for documentation
COMMENT ON CONSTRAINT user_roles_role_check ON user_roles IS 'Valid roles: super_admin (full access), accountant (financial access), staff (limited access)';
