# Organization Creation Troubleshooting Guide

## Overview
This guide provides comprehensive troubleshooting steps for resolving organization creation failures in the accounting system.

---

## Root Cause Analysis

### Most Common Reasons for "Failed to create organization" Error:

1. **Authentication Issues**
   - Expired or invalid session token
   - User not properly authenticated
   - Session not refreshed after login

2. **Database Permission Issues**
   - Row Level Security (RLS) policies blocking insert operations
   - Missing or incorrect foreign key relationships
   - Database constraints preventing data insertion

3. **Edge Function Errors**
   - Edge function deployment issues
   - Missing environment variables
   - Runtime errors in the function code

4. **Data Validation Failures**
   - Missing required fields
   - Invalid country or currency codes
   - Constraint violations (e.g., duplicate organization names)

5. **Network/CORS Issues**
   - CORS headers not properly configured
   - Network timeout or connectivity problems
   - API endpoint not accessible

---

## Systematic Troubleshooting Steps

### Step 1: Check Edge Function Logs

**How to View Logs:**
1. Open your browser's Developer Console (F12 or Right-click → Inspect → Console)
2. Attempt to create an organization
3. Look for log messages prefixed with `[create-organization]`

**What to Look For:**
```
[create-organization] Request received
[create-organization] Token extracted, length: [number]
[create-organization] Verifying user token...
[create-organization] User verified: [user-id]
[create-organization] Form data received: {name, country, currency}
[create-organization] Inserting organization...
[create-organization] Organization created: [org-id]
[create-organization] Assigning user role...
[create-organization] Success! Organization: [org-id]
```

**If You See Error Messages:**
- `Missing authorization header` → Session expired, sign out and sign back in
- `Auth error` → Token is invalid, clear browser cache and sign in again
- `No user found` → Authentication system issue, contact support
- `Organization insert error` → Database constraint or RLS policy issue
- `Role assignment error` → User roles table has a problem

### Step 2: Verify Your Session

**Quick Test:**
1. Sign out completely
2. Clear your browser cache (Ctrl+Shift+Delete)
3. Close all browser tabs
4. Open a new browser window
5. Sign in again
6. Try creating the organization immediately after signing in

**Why This Works:**
Session tokens can expire or become corrupted. Fresh authentication ensures you have a valid token.

### Step 3: Check Browser Console for JavaScript Errors

**Look for:**
- Network errors (failed to fetch)
- CORS errors (blocked by CORS policy)
- JSON parsing errors
- 400/401/403/500 status codes

**Common Fixes:**
- **Network Error:** Check your internet connection
- **CORS Error:** Edge function CORS headers need updating (already configured)
- **401 Unauthorized:** Session expired, sign in again
- **500 Server Error:** Edge function has a bug (check logs above)

### Step 4: Verify Required Fields

**Organization Creation Requires:**
- ✅ Company Name (cannot be empty)
- ✅ Country (must be "Egypt" or "UAE")
- ✅ Base Currency (auto-set based on country)
- ✅ Fiscal Year Start Month (1-12)
- ✅ Default VAT Rate (0-100)

**Optional Fields:**
- Address, Phone, Email, Website
- Tax Registration Number
- VAT Registration Number

### Step 5: Database Health Check

If you have database access, run these queries to verify system health:

```sql
-- Check if organizations table exists and is accessible
SELECT COUNT(*) FROM organizations;

-- Check if user_roles table exists and is accessible
SELECT COUNT(*) FROM user_roles;

-- Check if your user has any existing roles
SELECT * FROM user_roles WHERE user_id = auth.uid();

-- Verify RLS is properly configured
SELECT tablename, policyname, permissive, cmd
FROM pg_policies
WHERE tablename IN ('organizations', 'user_roles');
```

---

## Platform-Specific Solutions

### Supabase Edge Functions

**Edge Function Status:**
The `create-organization` edge function has been deployed with comprehensive error logging.

**How It Works:**
1. Validates your authentication token
2. Creates the organization record
3. Assigns you as the "super_admin" role
4. Creates default accounts and tax rates
5. Returns success with organization ID

**Security:**
- Uses Supabase service role to bypass RLS (after validating your token)
- Transaction-like behavior: if role assignment fails, organization is deleted
- All operations are logged for debugging

---

## Verification Steps

### After Each Troubleshooting Action:

1. **Clear Browser Cache**
   ```
   Chrome/Edge: Ctrl+Shift+Delete → Clear cache
   Firefox: Ctrl+Shift+Delete → Clear cache
   Safari: Develop → Empty Caches
   ```

2. **Sign Out and Sign Back In**
   - Ensures fresh authentication token
   - Clears any stale session data

3. **Check Developer Console**
   - Look for `[create-organization]` log messages
   - Verify each step completes successfully

4. **Try Creating Organization**
   - Fill in all required fields
   - Use simple organization name (e.g., "Test Company")
   - Submit and wait for response

### Success Indicators:
- ✅ No error message appears
- ✅ You're redirected to the dashboard
- ✅ Dashboard shows your organization in the dropdown
- ✅ Console shows success message

---

## Alternative Methods

### If Standard Creation Continues to Fail:

**Method 1: Direct Database Insertion (Advanced Users)**

If you have direct database access, you can manually create an organization:

```sql
-- 1. Create organization
INSERT INTO organizations (name, country, base_currency, fiscal_year_start_month, default_vat_rate)
VALUES ('Your Company Name', 'Egypt', 'EGP', 1, 14)
RETURNING id;

-- 2. Assign yourself as super admin (replace with your user ID and org ID from above)
INSERT INTO user_roles (organization_id, user_id, role, login_enabled)
VALUES ('[org-id-from-above]', '[your-user-id]', 'super_admin', true);
```

**Note:** This bypasses validation and should only be used as a last resort.

---

## Prevention Measures

### To Avoid This Issue in the Future:

1. **Always Use Fresh Sessions**
   - Don't stay logged in for extended periods
   - Sign out when not actively using the system
   - Refresh your browser if you leave it idle

2. **Complete Organization Creation Immediately**
   - Fill out the form as soon as you log in
   - Don't leave the page open for long periods
   - Have all information ready before starting

3. **Use Supported Browsers**
   - Chrome (recommended)
   - Firefox
   - Edge
   - Safari (may have session issues)

4. **Ensure Stable Internet Connection**
   - Use wired connection if possible
   - Avoid public WiFi for initial setup
   - Disable VPN if experiencing issues

5. **Monitor Browser Console**
   - Keep Developer Console open during setup
   - Watch for any error messages
   - Save log messages if issues occur

---

## Diagnostic Information to Collect

If the issue persists after all troubleshooting steps, collect this information:

### Browser Console Output:
```
1. All [create-organization] log messages
2. Any error messages (in red)
3. Network tab showing the API request/response
4. Status code of the failed request
```

### System Information:
```
- Browser name and version
- Operating system
- Time when error occurred
- Whether you're using VPN
- Any browser extensions that might interfere
```

### Steps to Reproduce:
```
1. What you did before the error
2. Exact error message shown
3. Whether this is first attempt or repeated failure
4. Any patterns noticed (e.g., always fails at same point)
```

---

## Quick Checklist

Before creating an organization, verify:

- [ ] I am signed in with a valid account
- [ ] My browser console is open to see logs
- [ ] I have filled in the required fields (name, country)
- [ ] My internet connection is stable
- [ ] I have cleared my browser cache recently
- [ ] I am using a supported browser
- [ ] No VPN or proxy is interfering

During creation:

- [ ] I can see `[create-organization]` logs in console
- [ ] No errors appear in red in the console
- [ ] The form submits without JavaScript errors
- [ ] The loading state appears (button shows "Creating...")

After creation:

- [ ] I see a success message or am redirected
- [ ] My organization appears in the dashboard
- [ ] I can access organization settings
- [ ] Default accounts and tax rates are created

---

## Current System Status

### Edge Function: ✅ DEPLOYED
The `create-organization` edge function has been deployed with:
- Comprehensive error logging at each step
- Service role authentication (bypasses RLS after token validation)
- Automatic rollback if any step fails
- Detailed error messages for debugging

### Database: ✅ CONFIGURED
- Organizations table with proper constraints
- User roles table with RLS policies
- Service role bypass enabled for edge functions
- All required indexes in place

### Frontend: ✅ READY
- Form validation in place
- Error handling implemented
- Loading states configured
- Session management active

---

## Next Steps

1. **Try creating an organization now with the browser console open**
2. **Copy all log messages from the console**
3. **If it still fails, share the exact error message and logs**

The enhanced logging will now show exactly where the process fails, making it much easier to identify and fix the root cause.
