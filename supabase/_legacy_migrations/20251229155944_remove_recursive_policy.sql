/*
  # Remove Recursive Policy from User Roles
  
  1. Problem
    - The "Admins can view all roles in their organizations" policy causes infinite recursion
    - When checking if a user is an admin, it queries user_roles, which triggers the same policy again
    - This creates an infinite loop
  
  2. Solution
    - Remove the recursive policy
    - Keep only "Users can view their own roles" policy
    - Users can always see their own roles (needed for login)
    - For admin functions that need to see other users' roles, we'll use edge functions with service role
  
  3. Security
    - Users can only see their own roles
    - Admin operations (viewing all users) will be handled by edge functions
*/

-- Drop the recursive policy
DROP POLICY IF EXISTS "Admins can view all roles in their organizations" ON user_roles;
