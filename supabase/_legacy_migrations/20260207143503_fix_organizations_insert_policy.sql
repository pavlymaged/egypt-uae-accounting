/*
  # Fix Organizations Insert Policy

  ## Problem
  The previous migration removed the INSERT policy for organizations but didn't recreate it.
  This prevents authenticated users from creating new organizations during onboarding.

  ## Changes
  1. Add back the INSERT policy for authenticated users to create organizations
  
  ## Security
  - Authenticated users can create organizations (needed for onboarding)
  - All other policies remain unchanged
*/

-- Recreate the missing INSERT policy for organizations
DROP POLICY IF EXISTS "enable_insert_for_authenticated_users" ON organizations;
CREATE POLICY "enable_insert_for_authenticated_users"
  ON organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
