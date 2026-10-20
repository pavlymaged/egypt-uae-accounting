/*
  # Fix can_login Column Reference Bug

  ## Issue
  The previous migration referenced a column called `can_login` but the actual column 
  in the database is `login_enabled` (from migration 20251229153338).

  ## Changes Applied
  - Update can_user_login function to use `login_enabled` instead of `can_login`
  - Update auto_enable_login_for_admins trigger function to use `login_enabled`
  - Fix both function definitions to use the correct column name
*/

-- Fix can_user_login function to use login_enabled instead of can_login
CREATE OR REPLACE FUNCTION can_user_login(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  user_id uuid;
  has_login_enabled boolean;
BEGIN
  -- Get user ID from auth.users
  SELECT id INTO user_id
  FROM auth.users
  WHERE email = user_email;

  IF user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check if user has login enabled in any organization (using login_enabled, not can_login)
  SELECT COALESCE(bool_or(login_enabled), false) INTO has_login_enabled
  FROM user_roles
  WHERE user_roles.user_id = can_user_login.user_id;

  RETURN COALESCE(has_login_enabled, false);
END;
$$;

-- Fix auto_enable_login_for_admins function to use login_enabled instead of can_login
CREATE OR REPLACE FUNCTION auto_enable_login_for_admins()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.role = 'super_admin' THEN
    NEW.login_enabled := true;
  END IF;
  RETURN NEW;
END;
$$;