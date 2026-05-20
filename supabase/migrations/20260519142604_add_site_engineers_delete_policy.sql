/*
  # Add DELETE policy for site_engineers

  1. Security Changes
    - Add DELETE policy on `site_engineers` for organization members
    - Allows any authenticated user with a role in the same organization to delete engineer records
    - This enables accountants, staff, and super_admins to remove engineers

  2. Notes
    - SELECT, INSERT, and UPDATE policies already exist for org members
    - This completes full CRUD access for org members on the site_engineers table
*/

CREATE POLICY "Org members can delete site engineers"
  ON site_engineers FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
    )
  );
