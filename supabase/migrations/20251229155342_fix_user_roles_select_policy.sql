/*
  # Fix User Roles SELECT Policy
  
  1. Problem
    - Current policy has circular dependency: to view your roles, you need to already have a role in the organization
    - This prevents users from seeing their own roles during login verification
  
  2. Changes
    - Drop the existing restrictive SELECT policy
    - Add a simpler policy: users can ALWAYS view their own roles
    - This allows login permission checks to work correctly
  
  3. Security
    - Users can only see roles where user_id matches their own auth.uid()
    - Cannot see other users' roles
*/

-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Users can view roles in their organizations" ON user_roles;

-- Create a new, simpler policy that allows users to see their own roles
CREATE POLICY "Users can view their own roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Also allow users to see other users' roles if they're in the same organization and have admin/owner privileges
CREATE POLICY "Admins can view all roles in their organizations"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM user_roles ur
      WHERE ur.organization_id = user_roles.organization_id
        AND ur.user_id = auth.uid()
        AND ur.role IN ('owner', 'admin')
    )
  );
