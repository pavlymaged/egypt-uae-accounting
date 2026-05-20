# User Invitation & Role Assignment Troubleshooting Guide

## Quick Diagnostic Checklist

### 1. Edge Functions Status
Both functions are deployed and active:
- `invite-user` - For inviting users to organizations
- `get-organization-users` - For fetching organization members

### 2. Common Error Messages

#### "User must first register with this email address before being invited"
**Cause:** The email you're trying to invite hasn't signed up yet.

**Solution:**
1. The user must first create an account at your sign-in page
2. After they sign up, you can invite them to your organization

#### "User is already a member of this organization"
**Cause:** The user already has a role assigned in this organization.

**Solution:**
- If you need to change their role, use the role dropdown next to their name instead of re-inviting

#### "You do not have permission to invite users"
**Cause:** Only owners and admins can invite users.

**Solution:**
- Verify your role is 'owner' or 'admin'
- Contact the organization owner if you need elevated permissions

### 3. Testing the Invitation Flow

**Step-by-step test:**

1. **Create a test user account:**
   - Open an incognito/private browser window
   - Go to your app's sign-in page
   - Click "Sign up" and create an account with: test@example.com
   - Sign out from that account

2. **Invite the test user:**
   - In your main account (as owner/admin)
   - Go to Settings → Users & Roles
   - Click "Invite User"
   - Enter: test@example.com
   - Select a role (Staff, Accountant, or Admin)
   - Click "Send Invite"

3. **Verify the invitation:**
   - You should see a success message
   - The user should appear in your users list immediately
   - Sign in as test@example.com to verify they can access the organization

### 4. Browser Console Debugging

If invitations are failing, check the browser console:

1. Open Developer Tools (F12 or Cmd+Option+I)
2. Go to the Console tab
3. Try inviting a user
4. Look for error messages in red

Common console errors and solutions:

**Error: "Failed to fetch" or CORS error**
- Solution: Edge functions may not be responding. Check Supabase dashboard for function logs.

**Error: "Not authenticated"**
- Solution: Sign out and sign back in to refresh your session.

**Error: 400 Bad Request**
- Solution: Check the error details in the response. Usually indicates missing data or validation failure.

### 5. Verify Your Permissions

Check your current role:
1. Go to Dashboard
2. Your role is shown in the organization context
3. You need 'owner' or 'admin' role to invite users

### 6. Database-Level Verification

If issues persist, verify the database state:

**Check if user exists in auth:**
- The user must have an account in `auth.users` table
- Email must match exactly (case-sensitive in some systems)

**Check existing roles:**
- Verify the user doesn't already have a role
- Check the `user_roles` table for duplicates

### 7. Role Assignment Issues

**Cannot update user role:**
- Only owners can modify other owners
- Admins can modify staff, accountant, and other admins
- Staff and accountants cannot modify any roles

**Cannot remove user:**
- Cannot remove owners (only owner can transfer ownership)
- Only owners and admins can remove users
- Cannot remove yourself

## System Architecture

### How Invitations Work:

1. **Inviter clicks "Invite User"**
   - Frontend calls `invite-user` edge function
   - Passes: email, organizationId, role

2. **Edge Function Validates:**
   - Checks if inviter is authenticated
   - Verifies inviter has owner/admin role
   - Confirms user exists in auth.users
   - Checks user isn't already in organization

3. **Edge Function Inserts Role:**
   - Creates entry in `user_roles` table
   - Links user to organization with specified role

4. **User Gains Access:**
   - User can now select this organization
   - Permissions apply based on assigned role

### Role Hierarchy:

- **Owner:** Full control, can do everything
- **Admin:** Can invite/remove users, manage most settings
- **Accountant:** Can manage financial records, limited settings access
- **Staff:** Read access, limited write permissions

## Still Having Issues?

If you've tried all the above and still experiencing problems:

1. Check Supabase dashboard logs:
   - Go to Edge Functions section
   - View logs for `invite-user` and `get-organization-users`
   - Look for error messages

2. Verify environment variables:
   - `VITE_SUPABASE_URL` is set correctly
   - `VITE_SUPABASE_ANON_KEY` is set correctly

3. Check RLS policies:
   - Policies should allow owners/admins to insert user_roles
   - Service role key (used by edge functions) bypasses RLS

4. Check network requests:
   - Open Network tab in Developer Tools
   - Look for requests to `/functions/v1/invite-user`
   - Check request payload and response

## Contact Support

If all else fails, provide this information:
- Exact error message from console
- Steps you took to reproduce the issue
- Your role in the organization
- Email address you're trying to invite
- Whether the user has registered or not
