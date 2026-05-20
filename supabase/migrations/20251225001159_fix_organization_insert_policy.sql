/*
  # Fix Organization Creation Policy

  ## Changes
  1. Drop existing restrictive INSERT policy
  2. Create new permissive INSERT policy for authenticated users
  3. Ensure users can create organizations without needing existing roles

  ## Security
  - Only authenticated users can create organizations
  - After creation, user_roles table will establish access
*/

-- Drop the existing INSERT policy if it exists
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON organizations;

-- Create a new, more permissive INSERT policy
CREATE POLICY "Allow authenticated users to create organizations"
  ON organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Also ensure the DELETE policy exists for owners
DROP POLICY IF EXISTS "Owners can delete organizations" ON organizations;

CREATE POLICY "Owners can delete organizations"
  ON organizations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE organization_id = organizations.id
      AND user_id = auth.uid()
      AND role = 'owner'
    )
  );