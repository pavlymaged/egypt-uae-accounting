/*
  # Add Admin User Invite Policy
  
  1. Changes
    - Add policy allowing admins and owners to insert user roles for other users
    - This enables the invite-user edge function to work properly
  
  2. Security
    - Only users with 'owner' or 'admin' role can invite others
    - The invited user will be added to the same organization
*/

-- Add policy for admins/owners to invite users
CREATE POLICY "Admins can invite users"
  ON user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.organization_id = user_roles.organization_id
      AND ur.user_id = auth.uid()
      AND ur.role IN ('owner', 'admin')
    )
  );
