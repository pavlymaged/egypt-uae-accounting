/*
  # Reset Organizations Table Policies - Comprehensive Fix

  ## Problem
  Users cannot create organizations during onboarding despite having an INSERT policy.
  This migration completely resets all policies to ensure proper access.

  ## Changes
  1. Drop ALL existing policies on organizations table
  2. Recreate all policies from scratch with correct permissions
  
  ## Security
  - Authenticated users can INSERT organizations (for onboarding)
  - Users can SELECT organizations they belong to (via user_roles)
  - Super admins can UPDATE organizations they belong to
  - Owners can DELETE organizations they own
*/

-- Drop ALL existing policies on organizations table
DROP POLICY IF EXISTS "enable_insert_for_authenticated_users" ON organizations;
DROP POLICY IF EXISTS "enable_select_for_users_based_on_user_roles" ON organizations;
DROP POLICY IF EXISTS "Super admins can update their organization" ON organizations;
DROP POLICY IF EXISTS "enable_update_for_admins" ON organizations;
DROP POLICY IF EXISTS "enable_delete_for_owners" ON organizations;
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON organizations;
DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;

-- Recreate INSERT policy for authenticated users
CREATE POLICY "Authenticated users can create organizations"
  ON organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Recreate SELECT policy for organization members
CREATE POLICY "Users can view their organizations"
  ON organizations
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id 
      FROM user_roles 
      WHERE user_id = (select auth.uid())
    )
  );

-- Recreate UPDATE policy for super admins
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

-- Recreate DELETE policy for owners
CREATE POLICY "Owners can delete organizations"
  ON organizations
  FOR DELETE
  TO authenticated
  USING (
    id IN (
      SELECT organization_id 
      FROM user_roles 
      WHERE user_id = (select auth.uid()) 
      AND role = 'owner'
    )
  );
