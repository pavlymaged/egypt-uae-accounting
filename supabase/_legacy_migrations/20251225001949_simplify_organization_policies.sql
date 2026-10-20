/*
  # Simplify Organization RLS Policies

  ## Changes
  1. Drop all existing policies on organizations
  2. Create simpler, more explicit policies
  3. Ensure authenticated users can create organizations without restrictions

  ## Security
  - Authenticated users can create organizations
  - Users can only view/update organizations they belong to
*/

-- Drop ALL existing policies on organizations table
DROP POLICY IF EXISTS "Allow authenticated users to create organizations" ON organizations;
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON organizations;
DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;
DROP POLICY IF EXISTS "Users can update their organizations" ON organizations;
DROP POLICY IF EXISTS "Owners can delete organizations" ON organizations;

-- Create new, simple policies
CREATE POLICY "enable_insert_for_authenticated_users"
  ON organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "enable_select_for_users_based_on_user_roles"
  ON organizations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.organization_id = organizations.id
      AND user_roles.user_id = auth.uid()
    )
  );

CREATE POLICY "enable_update_for_admins"
  ON organizations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.organization_id = organizations.id
      AND user_roles.user_id = auth.uid()
      AND user_roles.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.organization_id = organizations.id
      AND user_roles.user_id = auth.uid()
      AND user_roles.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "enable_delete_for_owners"
  ON organizations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.organization_id = organizations.id
      AND user_roles.user_id = auth.uid()
      AND user_roles.role = 'owner'
    )
  );