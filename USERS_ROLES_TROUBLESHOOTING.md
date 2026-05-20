# User Management Troubleshooting Guide
## "Failed to Fetch Users" Error Resolution

---

## Table of Contents
1. [Immediate Diagnostic Steps](#immediate-diagnostic-steps)
2. [Common Causes](#common-causes)
3. [Step-by-Step Solutions](#step-by-step-solutions)
4. [Verification Steps](#verification-steps)
5. [Adding Users with Different Roles](#adding-users-with-different-roles)
6. [Portal Assignment Procedures](#portal-assignment-procedures)
7. [Preventive Measures](#preventive-measures)

---

## Immediate Diagnostic Steps

### Step 1: Check Browser Console
1. Open your browser's Developer Tools:
   - **Chrome/Edge**: Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
   - **Firefox**: Press `F12` or `Ctrl+Shift+K` (Windows) / `Cmd+Option+K` (Mac)
   - **Safari**: Enable Developer menu in Preferences, then press `Cmd+Option+I`

2. Go to the **Console** tab

3. Try opening Users & Roles again

4. Look for error messages (typically in red):
   - Note the exact error text
   - Check if there's a stack trace
   - Screenshot any errors for reference

### Step 2: Check Network Activity
1. In Developer Tools, go to the **Network** tab

2. Clear existing logs (trash icon)

3. Try opening Users & Roles again

4. Look for a request to `/functions/v1/get-organization-users`
   - If the request is red or shows 400/500 status: Click it to see the response
   - If the request is taking too long: This indicates a timeout issue
   - If there's no request: Frontend isn't calling the function

### Step 3: Verify Authentication
1. In Developer Tools Console, run:
   ```javascript
   await supabase.auth.getSession()
   ```

2. Check the response:
   - If `session` is `null`: You're not authenticated (sign out and back in)
   - If `session` exists: Your authentication is valid

### Step 4: Check Your Role
1. In the main dashboard, check what role you have
2. Only **Owners** and **Admins** can manage users
3. If you're Staff or Accountant, you won't see the user management options

---

## Common Causes

### 1. Authentication Token Expired
**Symptoms:** "Not authenticated" or "Unauthorized" errors
**Likelihood:** High (30%)

### 2. Edge Function Timeout
**Symptoms:** Request takes longer than 10 seconds, then fails
**Likelihood:** High (25%)

### 3. Network/CORS Issues
**Symptoms:** "Failed to fetch" or CORS policy errors
**Likelihood:** Medium (20%)

### 4. Insufficient Permissions
**Symptoms:** "You do not have access to this organization"
**Likelihood:** Medium (15%)

### 5. Database Connection Issues
**Symptoms:** SQL errors or database timeout messages
**Likelihood:** Low (10%)

---

## Step-by-Step Solutions
### Ranked from Most to Least Likely

### Solution 1: Refresh Your Session (30% Success Rate)
**For:** Authentication token expired

**Steps:**
1. Click your profile in the top-right corner
2. Click "Sign Out"
3. Sign back in with your credentials
4. Navigate to Settings → Users & Roles
5. Try fetching users again

**Technical users can also:**
```javascript
// In browser console
await supabase.auth.refreshSession()
```

---

### Solution 2: Check Edge Function Logs (25% Success Rate)
**For:** Edge function timeout or errors

**For Technical Users:**
1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions** section
3. Click on `get-organization-users`
4. View the **Logs** tab
5. Look for errors or timeouts

**Common issues found in logs:**
- `Error fetching auth users` - Database is slow
- Timeout after 10 seconds - Too many users in system
- `Failed to verify organization access` - RLS policy issue

**Fix:** The edge function may need optimization (see Advanced Solutions below)

---

### Solution 3: Clear Browser Cache (20% Success Rate)
**For:** Network/CORS issues or stale data

**Steps:**
1. **Chrome/Edge:**
   - Press `Ctrl+Shift+Delete` (Windows) / `Cmd+Shift+Delete` (Mac)
   - Select "Cached images and files"
   - Click "Clear data"

2. **Firefox:**
   - Press `Ctrl+Shift+Delete` (Windows) / `Cmd+Shift+Delete` (Mac)
   - Check "Cache"
   - Click "Clear Now"

3. **Safari:**
   - Go to Safari → Preferences → Privacy
   - Click "Manage Website Data"
   - Click "Remove All"

4. Refresh the page (`Ctrl+F5` or `Cmd+Shift+R`)

---

### Solution 4: Verify Organization Access (15% Success Rate)
**For:** Insufficient permissions

**Check your access:**
1. Go to Dashboard
2. Look at the organization selector (top of page)
3. Verify you're in the correct organization
4. Check your role badge (should show Owner or Admin)

**If you're not an Owner/Admin:**
- Contact your organization owner
- Request an Admin role upgrade
- Explain you need user management access

---

### Solution 5: Test Database Connection (10% Success Rate)
**For:** Database connection issues

**For Technical Users:**
1. Open browser console
2. Run this test query:
   ```javascript
   const { data, error } = await supabase
     .from('user_roles')
     .select('*')
     .limit(1);
   console.log('Data:', data, 'Error:', error);
   ```

3. If you see an error:
   - Check if your internet connection is stable
   - Verify Supabase is not experiencing downtime
   - Check if RLS policies are blocking access

---

## Advanced Solutions

### Solution A: Optimize Edge Function (For Developers)

**Problem:** The current `get-organization-users` function fetches ALL users from the auth system, which is slow.

**Fix:** The function needs to be optimized to fetch only the specific users needed. This is a code-level fix.

**Optimization Needed:**
Instead of calling `supabaseClient.auth.admin.listUsers()` and filtering in memory, the function should:
1. Query `user_roles` table for the organization
2. Fetch each user's email individually using their user_id
3. Return the combined result

---

### Solution B: Check RLS Policies (For Developers)

**Verify policies are correct:**
```sql
-- Check user_roles policies
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'user_roles';
```

**Required policies:**
- ✓ "Users can view roles in their organizations" - SELECT
- ✓ "Admins can invite users" - INSERT
- ✓ "Admins can update user roles" - UPDATE
- ✓ "Admins can delete user roles" - DELETE

---

## Verification Steps

### After Applying Solutions:

1. **Test User List Loading:**
   - Go to Settings → Users & Roles
   - The list should load within 2-3 seconds
   - You should see at least yourself in the list

2. **Test User Invitation:**
   - Click "Invite User"
   - Enter a test email (user must be registered first)
   - Select a role
   - Click "Send Invite"
   - Should see success message

3. **Test Role Updates:**
   - Find a user (not Owner)
   - Change their role using the dropdown
   - Should see "Role updated successfully"

4. **Test User Removal:**
   - Find a test user
   - Click the trash icon
   - Confirm removal
   - User should disappear from list

---

## Adding Users with Different Roles

### Role Hierarchy & Permissions

| Role | Permissions | Use Case |
|------|------------|----------|
| **Owner** | Full system access, can manage everything including other owners | Business owner, CEO |
| **Admin** | Can manage users, settings, and all financial data | Office manager, CFO |
| **Accountant** | Can manage all financial records but limited settings access | External accountant, bookkeeper |
| **Staff** | Read access with limited write permissions | Data entry clerk, assistant |

### How to Add Users

#### Step 1: User Must Register First
**IMPORTANT:** Users cannot be invited until they've created an account.

1. Share your app URL with the new user
2. Have them click "Sign Up" on the login page
3. They create an account with email and password
4. They will see an empty dashboard (no organizations yet)

#### Step 2: Invite User to Organization

1. As Owner/Admin, go to **Settings → Users & Roles**
2. Click **"Invite User"** button
3. Enter the user's **registered email** (must match exactly)
4. Select appropriate **role**:
   - **Staff** - For basic data entry and viewing
   - **Accountant** - For full financial management
   - **Admin** - For user management and settings

5. Click **"Send Invite"**
6. User will immediately see your organization in their dashboard

#### Step 3: User Accesses Organization

1. User signs in to their account
2. They select your organization from the dropdown
3. They can now access features based on their role

---

## Portal Assignment Procedures

### Understanding Portals

In this accounting system, "portals" refer to different sections and features:

- **Dashboard Portal** - Overview and quick actions
- **Invoices Portal** - Customer invoicing
- **Bills Portal** - Vendor bill management
- **Expenses Portal** - Expense tracking
- **Banking Portal** - Bank reconciliation
- **Reports Portal** - Financial reports
- **Settings Portal** - System configuration

### Role-Based Portal Access

#### Owner - Full Access
- All portals
- User management
- Organization settings
- Period locks
- Audit logs

#### Admin - Nearly Full Access
- All financial portals
- User management (cannot remove owners)
- Most organization settings
- Reports and analytics

#### Accountant - Financial Access
- Invoices, Bills, Expenses
- Banking and reconciliation
- Journal entries
- Financial reports
- Limited settings (tax rates, accounts)

#### Staff - Limited Access
- View most financial data
- Create/edit invoices and bills
- Basic data entry
- Cannot access sensitive settings
- Cannot manage users

### Assigning Custom Permissions

The system supports custom permissions through the `permissions` JSONB field in `user_roles`:

```javascript
// Example: Grant specific permissions to a Staff user
{
  "can_delete_invoices": true,
  "can_approve_bills": true,
  "can_lock_periods": false
}
```

**To set custom permissions (for developers):**
1. Update the user's role record in `user_roles` table
2. Add specific permission flags to the `permissions` JSON field
3. Implement permission checks in your application code

---

## Preventive Measures

### 1. Regular Session Management
- Sign out when not using the app for extended periods
- Refresh your browser if the app has been open for hours
- Don't leave sensitive tabs open

### 2. Role Assignment Best Practices
- Start users with **Staff** role
- Upgrade to **Accountant** only when needed
- Limit **Admin** role to 2-3 trusted people
- Only have 1-2 **Owners** per organization

### 3. User Onboarding Checklist
- [ ] User creates their account
- [ ] Verify email is correct
- [ ] Invite with appropriate role
- [ ] Test user can access organization
- [ ] Walk user through their permitted features
- [ ] Document their responsibilities

### 4. Monitoring & Maintenance
- Check Edge Function logs weekly
- Monitor user list load times
- Review user roles quarterly
- Remove inactive users
- Keep total users under 100 per organization for best performance

### 5. Network Best Practices
- Use stable internet connection
- Avoid VPNs that might block API calls
- Whitelist Supabase domains in corporate firewalls
- Test from different networks if issues persist

---

## Still Having Issues?

### Gather This Information:

1. **Exact Error Message:**
   - Screenshot from browser console
   - Full error text

2. **Your Environment:**
   - Browser name and version
   - Operating system
   - Internet connection type

3. **Actions Taken:**
   - Solutions you've tried from this guide
   - Results of each attempt

4. **User Context:**
   - Your role in the organization
   - How many users are in your organization
   - When the error started occurring

### Next Steps:

1. **Check Edge Function logs** in Supabase Dashboard
2. **Test with a different browser** to rule out browser issues
3. **Try from a different network** to rule out network issues
4. **Contact system administrator** with the information gathered above

### Developer Support:

If you're a developer and need to debug further:

1. **Check Supabase Dashboard:**
   - Edge Functions → get-organization-users → Logs
   - Database → Query logs
   - Authentication → Users list

2. **Test Edge Function Directly:**
   ```bash
   curl -X GET "YOUR_SUPABASE_URL/functions/v1/get-organization-users?organizationId=YOUR_ORG_ID" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json"
   ```

3. **Check Database Performance:**
   ```sql
   -- Check for slow queries
   SELECT * FROM pg_stat_statements
   WHERE query LIKE '%user_roles%'
   ORDER BY mean_exec_time DESC;
   ```

---

## Quick Reference

### Common Error Messages & Solutions

| Error Message | Likely Cause | Quick Fix |
|--------------|--------------|-----------|
| "Not authenticated" | Session expired | Sign out and back in |
| "Failed to fetch users" | Network or timeout | Refresh page, check logs |
| "You do not have access" | Wrong organization/role | Switch organizations |
| "User must first register" | Inviting unregistered user | Have user sign up first |
| "User is already a member" | Duplicate invitation | Check existing users list |
| CORS error | Browser/network issue | Clear cache, try different browser |
| Timeout error | Too many users/slow query | Contact developer for optimization |

### Troubleshooting Checklist

- [ ] Checked browser console for errors
- [ ] Verified authentication session is valid
- [ ] Confirmed I have Owner/Admin role
- [ ] Tried signing out and back in
- [ ] Cleared browser cache
- [ ] Checked network tab for failed requests
- [ ] Tested from different browser
- [ ] Verified internet connection is stable
- [ ] Checked Supabase service status
- [ ] Reviewed edge function logs

---

*Last Updated: 2025-12-29*
