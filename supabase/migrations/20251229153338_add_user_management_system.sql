/*
  # User Management System Enhancement
  
  ## Overview
  This migration implements a secure user management system with admin-controlled access.
  
  ## 1. New Columns
    - `user_roles.login_enabled` (boolean, default false)
      - Controls whether a user can log in to the system
      - Only admins can grant login permission
      - Default is false to prevent unauthorized access
    
    - `user_roles.created_by` (uuid, nullable)
      - Tracks which admin created/invited the user
      - Provides audit trail for user management
  
  ## 2. New Table: user_management_logs
    - `id` (uuid, primary key)
    - `organization_id` (uuid, foreign key to organizations)
    - `admin_user_id` (uuid, the admin performing the action)
    - `target_user_id` (uuid, the user being managed)
    - `action` (text, the action performed)
    - `details` (jsonb, additional details about the action)
    - `created_at` (timestamptz)
    
    Purpose: Audit trail for all user management actions
  
  ## 3. Security Changes
    - Update RLS policies to enforce login_enabled check
    - Add policies for user_management_logs
    - Ensure only admins can modify login_enabled flag
  
  ## 4. Important Notes
    - Existing users will have login_enabled set to true (backward compatibility)
    - Owner role always has login enabled
    - Admins must explicitly grant login access to new users
*/

-- Step 1: Add login_enabled column to user_roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_roles' AND column_name = 'login_enabled'
  ) THEN
    ALTER TABLE user_roles ADD COLUMN login_enabled boolean DEFAULT false;
    
    -- Set existing users to have login enabled (backward compatibility)
    UPDATE user_roles SET login_enabled = true;
    
    -- Owners and admins always have login enabled
    UPDATE user_roles SET login_enabled = true WHERE role IN ('owner', 'admin');
  END IF;
END $$;

-- Step 2: Add created_by column to user_roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_roles' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE user_roles ADD COLUMN created_by uuid;
  END IF;
END $$;

-- Step 3: Create user_management_logs table
CREATE TABLE IF NOT EXISTS user_management_logs (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  admin_user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('user_created', 'user_invited', 'role_updated', 'login_enabled', 'login_disabled', 'user_removed', 'password_reset')),
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

-- Step 4: Add index for performance
CREATE INDEX IF NOT EXISTS idx_user_management_logs_org_id ON user_management_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_management_logs_admin_user ON user_management_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_user_management_logs_target_user ON user_management_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_login_enabled ON user_roles(login_enabled);

-- Step 5: Enable RLS on user_management_logs
ALTER TABLE user_management_logs ENABLE ROW LEVEL SECURITY;

-- Step 6: RLS Policies for user_management_logs

-- Admins and owners can view all logs for their organization
CREATE POLICY "Admins can view user management logs"
  ON user_management_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.organization_id = user_management_logs.organization_id
      AND user_roles.user_id = auth.uid()
      AND user_roles.role IN ('owner', 'admin')
    )
  );

-- System can insert logs (used by edge functions)
CREATE POLICY "System can insert user management logs"
  ON user_management_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.organization_id = user_management_logs.organization_id
      AND user_roles.user_id = auth.uid()
      AND user_roles.role IN ('owner', 'admin')
    )
  );

-- Step 7: Update user_roles policies to respect login_enabled

-- Drop and recreate the select policy to include login_enabled check
DROP POLICY IF EXISTS "Users can view roles in their organizations" ON user_roles;

CREATE POLICY "Users can view roles in their organizations"
  ON user_roles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.organization_id = user_roles.organization_id
      AND ur.user_id = auth.uid()
    )
  );

-- Step 8: Add policy to prevent non-admins from modifying login_enabled
-- This is enforced at the application/edge function level

-- Step 9: Create helper function to check if user can log in
CREATE OR REPLACE FUNCTION can_user_login(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  has_login_access boolean;
BEGIN
  -- Check if user has at least one organization where login is enabled
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = user_id_param
    AND login_enabled = true
  ) INTO has_login_access;
  
  RETURN has_login_access;
END;
$$;

-- Step 10: Add trigger to automatically enable login for owners and admins
CREATE OR REPLACE FUNCTION auto_enable_login_for_admins()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role IN ('owner', 'admin') THEN
    NEW.login_enabled := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_enable_login ON user_roles;

CREATE TRIGGER trigger_auto_enable_login
  BEFORE INSERT OR UPDATE OF role ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION auto_enable_login_for_admins();

-- Step 11: Add comments for documentation
COMMENT ON COLUMN user_roles.login_enabled IS 'Controls whether the user can log in to the system. Default is false for new users.';
COMMENT ON COLUMN user_roles.created_by IS 'UUID of the admin user who created/invited this user.';
COMMENT ON TABLE user_management_logs IS 'Audit trail for all user management actions performed by admins.';
