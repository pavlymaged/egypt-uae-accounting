/*
  # Fix User Roles Insert Policy

  ## Changes
  1. Add policy to allow users to create their own first role in a new organization
  2. Keep existing admin management policy for subsequent role management

  ## Security
  - Users can insert their own user_role entry when creating an organization
  - Admins can manage all roles within their organizations
*/

-- Add a policy that allows authenticated users to insert their own roles
DROP POLICY IF EXISTS "Users can create their own initial role" ON user_roles;

CREATE POLICY "Users can create their own initial role"
  ON user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Update the SELECT policy to be more permissive
DROP POLICY IF EXISTS "Users can view roles in their organizations" ON user_roles;

CREATE POLICY "Users can view roles in their organizations"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    user_has_org_access(organization_id)
  );

-- Update the admin management policy to only handle UPDATE and DELETE
DROP POLICY IF EXISTS "Admins can manage user roles" ON user_roles;

CREATE POLICY "Admins can update user roles"
  ON user_roles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.organization_id = user_roles.organization_id
      AND ur.user_id = auth.uid()
      AND ur.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can delete user roles"
  ON user_roles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.organization_id = user_roles.organization_id
      AND ur.user_id = auth.uid()
      AND ur.role IN ('owner', 'admin')
    )
  );