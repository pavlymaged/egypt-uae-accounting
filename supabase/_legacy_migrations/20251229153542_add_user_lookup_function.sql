/*
  # User Lookup Function
  
  ## Overview
  Creates a secure function to look up user IDs by email address.
  This is used by edge functions to find users without listing all users.
  
  ## Function: get_user_id_by_email
  - Input: user_email (text)
  - Output: table of (id uuid)
  - Security: SECURITY DEFINER (runs with elevated privileges)
  - Purpose: Look up user ID by email from auth.users table
*/

-- Create function to look up user by email
CREATE OR REPLACE FUNCTION get_user_id_by_email(user_email text)
RETURNS TABLE (id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT au.id
  FROM auth.users au
  WHERE au.email = user_email
  LIMIT 1;
END;
$$;

-- Add comment
COMMENT ON FUNCTION get_user_id_by_email IS 'Looks up a user ID by email address. Used by edge functions for user management.';
