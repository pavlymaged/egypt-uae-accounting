# Secure Authentication & User Management Implementation
## Admin-Only Access System

---

## Overview

This document describes the complete implementation of a secure authentication and user management system where:
- **Only admin users can log in** to the application
- **All user creation is controlled by administrators** - public registration is disabled
- **Admins have full control** over user accounts, roles, and login permissions
- **Complete audit trail** of all administrative actions

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Changes](#database-changes)
3. [Authentication Flow](#authentication-flow)
4. [Admin User Management](#admin-user-management)
5. [Edge Functions](#edge-functions)
6. [Security Features](#security-features)
7. [Testing & Verification](#testing--verification)
8. [User Guide](#user-guide)

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                     Authentication Layer                         │
│  - Admin-only login enforcement                                 │
│  - Session verification with role checking                      │
│  - Automatic logout for non-admin users                         │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Admin Management Portal                        │
│  - Create new user accounts with passwords                      │
│  - Invite existing registered users                             │
│  - Assign roles (Staff, Accountant, Admin)                      │
│  - Control login permissions                                     │
│  - View and manage all organization users                       │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Database Layer                              │
│  - user_roles table with login_enabled flag                     │
│  - user_management_logs for audit trail                         │
│  - RLS policies for security                                    │
└─────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────┐
│                     Edge Functions                               │
│  - create-user: Create new accounts                             │
│  - invite-user: Add existing users to org                       │
│  - manage-login-access: Control login permissions               │
│  - get-organization-users: Fetch user list                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Changes

### 1. user_roles Table Enhancements

**New Columns:**

```sql
-- Controls whether user can log in (default: false for new users)
login_enabled BOOLEAN DEFAULT false

-- Tracks which admin created the user
created_by UUID
```

**Automatic Behaviors:**
- Owners and Admins always have `login_enabled = true` (enforced by trigger)
- New Staff and Accountant users have `login_enabled = false` by default
- Admins must explicitly grant login access

### 2. user_management_logs Table (NEW)

Complete audit trail of all administrative actions:

```sql
CREATE TABLE user_management_logs (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  admin_user_id UUID NOT NULL,        -- Admin performing action
  target_user_id UUID NOT NULL,       -- User being managed
  action TEXT NOT NULL,               -- Type of action
  details JSONB DEFAULT '{}',         -- Additional context
  ip_address TEXT,                    -- Optional IP tracking
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Action Types:**
- `user_created` - Admin created a new account
- `user_invited` - Admin invited existing user
- `role_updated` - User role was changed
- `login_enabled` - Login access granted
- `login_disabled` - Login access revoked
- `user_removed` - User removed from organization
- `password_reset` - Admin reset user password

### 3. Helper Functions

**get_user_id_by_email(email TEXT)**
- Securely looks up user ID by email
- Used by edge functions to avoid listing all users
- Security: SECURITY DEFINER with proper access control

**can_user_login(user_id UUID)**
- Checks if user has login access in any organization
- Returns boolean
- Used for validation

**auto_enable_login_for_admins()**
- Trigger function that automatically sets `login_enabled = true` for Owners/Admins
- Prevents accidentally locking out administrators

---

## Authentication Flow

### Previous Flow (Insecure)

```
User → Enter credentials → Authenticate → Access granted
```

### New Flow (Secure)

```
User → Enter credentials → Authenticate → Check user_roles
                                              ↓
                            Is user Admin with login_enabled=true?
                                              ↓
                                    YES               NO
                                     ↓                ↓
                              Access granted    Logout + Error message
```

### Implementation Details

**Location:** `src/contexts/AuthContext.tsx`

```typescript
const signIn = async (email: string, password: string) => {
  // 1. Authenticate with Supabase
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return { error };

  // 2. Check user roles and permissions
  if (data.user) {
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role, login_enabled')
      .eq('user_id', data.user.id);

    // 3. Verify user is admin with login access
    const hasLoginAccess = userRoles?.some(
      (role) => role.login_enabled === true && role.role === 'admin'
    );

    // 4. Deny access if not admin
    if (!hasLoginAccess) {
      await supabase.auth.signOut();
      return {
        error: new Error(
          'Access denied. Only administrators can log in. Contact your system administrator for access.'
        )
      };
    }
  }

  return { error: null };
};
```

### Login Page Changes

**Location:** `src/pages/Auth.tsx`

**Changes Made:**
1. Removed public registration option
2. Changed from toggle (login/signup) to login-only
3. Added administrator access warning badge
4. Added informational message directing users to contact admins
5. Removed signup functionality completely

---

## Admin User Management

### Admin Portal Features

**Location:** `src/components/settings/AdminUserManagement.tsx`

### Feature 1: Create New Users

Admins can create completely new user accounts:

**Input Fields:**
- Email address (required)
- Password (required, min 6 characters)
- Role selection (Staff, Accountant, Admin)
- Login access toggle (for Staff/Accountant only)

**Process:**
1. Admin fills out form
2. System creates auth account with email/password
3. User is automatically added to organization with specified role
4. Login access is set based on role:
   - Admin: Always enabled
   - Staff/Accountant: As specified by admin
5. Action is logged in `user_management_logs`

**API Endpoint:** `POST /functions/v1/create-user`

### Feature 2: Invite Existing Users

Admins can add users who already have accounts:

**Input Fields:**
- Email address (must match existing account)
- Role selection

**Process:**
1. Admin enters email of existing user
2. System looks up user by email
3. User is added to organization with specified role
4. Login access:
   - Admin: Enabled
   - Staff/Accountant: Disabled by default
5. User can immediately select organization in dashboard

**API Endpoint:** `POST /functions/v1/invite-user`

### Feature 3: Manage Login Access

Admins can enable/disable login for users:

**Controls:**
- Toggle button next to each user
- Lock icon = Login disabled
- Unlock icon = Login enabled

**Restrictions:**
- Cannot disable login for Owners
- Cannot disable login for Admins
- Only affects Staff and Accountant roles

**API Endpoint:** `POST /functions/v1/manage-login-access`

### Feature 4: Role Management

Admins can change user roles:

**Options:**
- Staff → Accountant
- Staff → Admin (auto-enables login)
- Accountant → Staff
- Accountant → Admin (auto-enables login)
- Admin → Staff/Accountant (allows login disabling)

**Restrictions:**
- Admins cannot change Owner roles (only Owners can)
- Changing to Admin automatically enables login

### Feature 5: Remove Users

Admins can remove users from organization:

**Process:**
1. Click trash icon next to user
2. Confirm removal
3. User's `user_roles` entry is deleted
4. User loses access to organization
5. Action is logged

**Note:** This does NOT delete the user's account, only removes them from the organization.

---

## Edge Functions

### 1. create-user

**Purpose:** Create a new user account and add to organization

**Endpoint:** `POST /functions/v1/create-user`

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "password": "securepassword123",
  "organizationId": "uuid-here",
  "role": "staff",
  "loginEnabled": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "User created successfully",
  "user": {
    "id": "user-uuid",
    "email": "newuser@example.com",
    "role": "staff",
    "login_enabled": false
  }
}
```

**Security Checks:**
1. Verify requestor is authenticated
2. Verify requestor has Owner or Admin role in the organization
3. Create auth user with Supabase Admin API
4. Insert user_role record with specified permissions
5. Log action in user_management_logs
6. Rollback auth user creation if role assignment fails

### 2. invite-user (Enhanced)

**Purpose:** Add existing registered user to organization

**Endpoint:** `POST /functions/v1/invite-user`

**Request Body:**
```json
{
  "email": "existing@example.com",
  "organizationId": "uuid-here",
  "role": "accountant"
}
```

**Enhancements:**
- Now uses `get_user_id_by_email` function instead of listing all users
- Automatically sets `login_enabled` based on role
- Records `created_by` field
- Logs action in audit table

**Response:**
```json
{
  "success": true,
  "message": "User invited successfully"
}
```

### 3. manage-login-access (NEW)

**Purpose:** Enable or disable login access for a user

**Endpoint:** `POST /functions/v1/manage-login-access`

**Request Body:**
```json
{
  "organizationId": "uuid-here",
  "targetUserId": "user-uuid",
  "loginEnabled": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login access enabled successfully"
}
```

**Security Checks:**
1. Verify requestor is Owner or Admin
2. Verify target user exists in organization
3. Prevent disabling login for Owners and Admins
4. Update user_roles record
5. Log action

### 4. get-organization-users (Existing - Enhanced)

**Purpose:** Fetch all users in an organization with their emails

**Enhancements:**
- Now fetches users individually instead of listing all users
- Improved performance
- Returns `login_enabled` status

**Response:**
```json
{
  "users": [
    {
      "id": "role-uuid",
      "user_id": "user-uuid",
      "role": "admin",
      "login_enabled": true,
      "email": "admin@example.com",
      "created_at": "2025-12-29T...",
      "created_by": "creator-uuid"
    }
  ]
}
```

---

## Security Features

### 1. Role-Based Access Control (RBAC)

**Hierarchy:**
```
Owner (Full control)
  ↓
Admin (User management, all features)
  ↓
Accountant (Financial features, no user management)
  ↓
Staff (Limited access)
```

### 2. Login Access Control

**Rules:**
- New users start with `login_enabled = false`
- Only admins can grant login access
- Owners and Admins always have login enabled (enforced by trigger)
- Login check happens AFTER authentication

### 3. Row Level Security (RLS)

**user_roles table:**
- Users can only view roles in organizations they belong to
- Only admins can modify roles
- Cannot escalate own privileges

**user_management_logs table:**
- Only admins can view logs for their organization
- Only admins can insert logs (via edge functions)
- Logs are immutable (no update/delete policies)

### 4. Audit Logging

**Every administrative action is logged with:**
- Who performed the action (admin_user_id)
- Who was affected (target_user_id)
- What happened (action type)
- When it happened (created_at)
- Additional context (details JSONB)
- Optional IP address

**Benefits:**
- Complete accountability
- Security incident investigation
- Compliance requirements
- Activity monitoring

### 5. Edge Function Security

**Authentication:**
- All functions verify JWT token
- Extract user ID from token
- Never trust client-provided user IDs

**Authorization:**
- Check user's role in organization before any action
- Verify permissions match required level
- Return specific error messages

**Input Validation:**
- Validate all required fields present
- Check email format
- Verify password strength
- Sanitize inputs

---

## Testing & Verification

### Manual Testing Steps

#### Test 1: Admin Login

**Steps:**
1. Log in with admin account
2. Verify successful login
3. Navigate to dashboard

**Expected Result:**
- Login successful
- Dashboard displays organization data
- Admin can access all features

#### Test 2: Non-Admin Login Blocked

**Steps:**
1. Create a Staff user with `login_enabled = false`
2. Try to log in with those credentials
3. Observe error message

**Expected Result:**
- Authentication succeeds initially
- System checks user_roles
- Detects user is not admin OR login not enabled
- Automatic logout
- Error message: "Access denied. Only administrators can log in..."

#### Test 3: Create New User

**Steps:**
1. Log in as admin
2. Go to Settings → Admin User Management
3. Click "Add User"
4. Select "Create New" mode
5. Fill in:
   - Email: test@example.com
   - Password: password123
   - Role: Staff
   - Login Enabled: Unchecked
6. Submit form

**Expected Result:**
- User created successfully
- User appears in user list
- Login status shows "Login Disabled"
- Audit log records the action

#### Test 4: Invite Existing User

**Steps:**
1. Create an account (not logged in to admin): testuser@example.com
2. Log in as admin
3. Go to Settings → Admin User Management
4. Click "Add User"
5. Select "Invite Existing" mode
6. Enter: testuser@example.com
7. Select Role: Accountant
8. Submit

**Expected Result:**
- User added to organization
- Login status: Disabled (for Accountant)
- User can now see organization in their dashboard
- Audit log records the action

#### Test 5: Toggle Login Access

**Steps:**
1. Log in as admin
2. Go to user list
3. Find a Staff member with login disabled
4. Click the unlock icon next to their name
5. Confirm change

**Expected Result:**
- Status changes to "Login Enabled"
- Icon changes from lock to unlock
- User can now log in successfully
- Audit log records "login_enabled" action

#### Test 6: Role Update

**Steps:**
1. Find a Staff user
2. Change role dropdown to "Admin"
3. Confirm change

**Expected Result:**
- Role updates to Admin
- Login access automatically enabled (trigger)
- Role badge updates
- User can now access admin features

#### Test 7: Remove User

**Steps:**
1. Select a non-critical user
2. Click trash icon
3. Confirm removal

**Expected Result:**
- User removed from list
- User loses organization access
- User's account still exists (can be re-invited)
- Audit log records "user_removed"

### Database Verification Queries

```sql
-- Check user roles and login status
SELECT
  ur.role,
  ur.login_enabled,
  au.email
FROM user_roles ur
JOIN auth.users au ON au.id = ur.user_id
WHERE ur.organization_id = 'your-org-id';

-- View audit logs
SELECT
  admin_email,
  target_email,
  action,
  details,
  created_at
FROM user_management_logs uml
JOIN auth.users admin ON admin.id = uml.admin_user_id
JOIN auth.users target ON target.id = uml.target_user_id
WHERE uml.organization_id = 'your-org-id'
ORDER BY created_at DESC;

-- Check trigger functionality
INSERT INTO user_roles (organization_id, user_id, role, login_enabled)
VALUES ('org-id', 'user-id', 'admin', false);
-- Should automatically set login_enabled = true

SELECT login_enabled FROM user_roles WHERE user_id = 'user-id';
-- Expected: true
```

---

## User Guide

### For Administrators

#### How to Create a New User

1. **Navigate to User Management**
   - Go to Settings
   - Click "Admin User Management"

2. **Start Creation Process**
   - Click "Add User" button
   - Select "Create New" tab

3. **Fill in User Details**
   - Email: Enter user's email address
   - Password: Set initial password (min 6 characters)
   - Role: Choose appropriate role
     - **Staff**: Basic access
     - **Accountant**: Financial management
     - **Admin**: Full access (can manage users)

4. **Set Login Permission** (for Staff/Accountant only)
   - Check "Allow user to log in" if you want them to access the system immediately
   - Leave unchecked to create the account but prevent login
   - Note: Admin role always has login access

5. **Submit**
   - Click "Create User"
   - User account is created immediately
   - Provide credentials to the user

#### How to Invite Existing User

1. **User Must Register First**
   - User must create their own account at the login page first
   - They should use the "Sign Up" option (if available) or ask you to create their account

2. **Invite Process**
   - Go to Settings → Admin User Management
   - Click "Add User"
   - Select "Invite Existing" tab
   - Enter the exact email they registered with
   - Select their role
   - Click "Send Invite"

3. **User Access**
   - User can now select your organization
   - Login access defaults to disabled for Staff/Accountant
   - Enable login access if needed

#### How to Manage Login Access

**Enable Login:**
1. Find user in list
2. Click unlock icon (🔓)
3. Status changes to "Login Enabled"
4. User can now log in

**Disable Login:**
1. Find user in list
2. Click lock icon (🔒)
3. Status changes to "Login Disabled"
4. User cannot log in (will be kicked out if logged in)

**Note:** Cannot disable login for Owners or Admins

#### How to Change User Roles

1. Find user in user list
2. Click role dropdown next to their name
3. Select new role:
   - Staff → Accountant (no login change)
   - Staff → Admin (login auto-enabled)
   - Accountant → Admin (login auto-enabled)
   - Admin → Staff/Accountant (can disable login)
4. Change applies immediately

#### How to Remove Users

1. Find user to remove
2. Click trash icon (🗑️)
3. Confirm removal
4. User loses access to organization
5. User's account still exists (can be re-invited later)

### For New Users

**Important:** You cannot create your own account in this system. An administrator must create an account for you.

#### Steps to Get Access

1. **Contact Administrator**
   - Ask your organization's admin to create an account for you
   - Provide your email address

2. **Receive Credentials**
   - Admin will provide you with:
     - Email address
     - Initial password
     - Your role

3. **First Login**
   - Go to the login page
   - Enter your email and password
   - If successful, you'll see the dashboard

4. **If Login Fails**
   - Error: "Access denied. Only administrators can log in..."
   - Meaning: Your account exists but login access is disabled
   - Action: Contact your administrator to enable login access

5. **Change Password** (Recommended)
   - After first login, change your password
   - (Feature would need to be implemented if not already available)

---

## Troubleshooting

### Issue 1: "Access denied" Error After Login

**Symptoms:**
- Login credentials are correct
- Error: "Access denied. Only administrators can log in..."

**Cause:**
- User account exists but `login_enabled = false`
- OR user is not assigned Admin role

**Solution:**
1. Admin logs in
2. Goes to Admin User Management
3. Finds the user
4. Either:
   - Enables login access (unlock icon), OR
   - Changes role to Admin

### Issue 2: Cannot Create User - "User already exists"

**Symptoms:**
- Trying to create new user
- Error: "User already exists in this organization"

**Cause:**
- User has already been added to organization

**Solution:**
- Use "Invite Existing" instead of "Create New"
- OR check user list to see if they're already there

### Issue 3: Cannot Invite User - "User must first register"

**Symptoms:**
- Trying to invite user
- Error: "User must first register with this email address"

**Cause:**
- No account exists with that email

**Solution:**
1. Use "Create New" mode instead, OR
2. Have user create their own account first, then invite them

### Issue 4: Staff/Accountant Cannot See Organization

**Symptoms:**
- User was invited
- User cannot log in or see organization

**Cause:**
- Login access is disabled by default for non-admins

**Solution:**
1. Admin enables login access for the user
2. User tries logging in again

### Issue 5: Cannot Disable Login for User

**Symptoms:**
- Lock icon is not available
- Cannot toggle login access

**Cause:**
- User is Owner or Admin (cannot disable)

**Solution:**
- This is by design for security
- To prevent lockout, change role first:
  1. Change Admin → Staff
  2. Then disable login
  3. (Not recommended unless removing user)

---

## API Reference

### POST /functions/v1/create-user

Create a new user account and add to organization.

**Authentication:** Required (Admin/Owner)

**Request:**
```typescript
{
  email: string;           // Valid email address
  password: string;        // Min 6 characters
  organizationId: string;  // UUID
  role: 'admin' | 'accountant' | 'staff';
  loginEnabled: boolean;   // Ignored if role is 'admin'
}
```

**Response 200:**
```typescript
{
  success: true;
  message: string;
  user: {
    id: string;
    email: string;
    role: string;
    login_enabled: boolean;
  };
}
```

**Response 400:**
```typescript
{
  error: string;
  details: string;
}
```

**Errors:**
- Missing authorization header
- User not authenticated
- Insufficient permissions (not admin/owner)
- Missing required fields
- User already exists in organization
- Database error

---

### POST /functions/v1/invite-user

Add existing registered user to organization.

**Authentication:** Required (Admin/Owner)

**Request:**
```typescript
{
  email: string;           // Email of existing user
  organizationId: string;  // UUID
  role: 'admin' | 'accountant' | 'staff';
}
```

**Response 200:**
```typescript
{
  success: true;
  message: 'User invited successfully';
}
```

**Response 400:**
```typescript
{
  error: string;
  details?: string;
}
```

**Errors:**
- User not found with email
- User already in organization
- Insufficient permissions

---

### POST /functions/v1/manage-login-access

Enable or disable login access for a user.

**Authentication:** Required (Admin/Owner)

**Request:**
```typescript
{
  organizationId: string;  // UUID
  targetUserId: string;    // UUID of user to modify
  loginEnabled: boolean;   // true to enable, false to disable
}
```

**Response 200:**
```typescript
{
  success: true;
  message: string;  // "Login access enabled/disabled successfully"
}
```

**Response 400:**
```typescript
{
  error: string;
  details?: string;
}
```

**Errors:**
- Target user not found
- Cannot disable login for owners/admins
- Insufficient permissions

---

### GET /functions/v1/get-organization-users

Fetch all users in an organization.

**Authentication:** Required (Any role in organization)

**Query Parameters:**
- `organizationId`: string (UUID)

**Response 200:**
```typescript
{
  users: Array<{
    id: string;              // user_roles.id
    user_id: string;         // UUID
    role: 'owner' | 'admin' | 'accountant' | 'staff';
    login_enabled: boolean;
    email: string;
    created_at: string;      // ISO timestamp
    created_by?: string;     // UUID of creator
  }>;
}
```

**Response 400:**
```typescript
{
  error: string;
  details?: string;
}
```

---

## Best Practices

### For Security

1. **Regular Audit Reviews**
   - Review `user_management_logs` monthly
   - Look for suspicious activity
   - Verify all user accounts are still needed

2. **Principle of Least Privilege**
   - Start users with Staff role
   - Upgrade only when necessary
   - Disable login when not needed

3. **Role Assignment**
   - Limit Admin role to 2-3 trusted users
   - Have at least 2 Owners (redundancy)
   - Document why each user has admin access

4. **Regular Access Review**
   - Quarterly review of all users
   - Remove inactive users
   - Verify roles are still appropriate

5. **Password Management**
   - Set strong initial passwords
   - Require users to change password on first login (implement if not available)
   - Consider password expiration policy

### For Administration

1. **User Onboarding**
   - Create account first
   - Test login access
   - Walk user through their features
   - Document their responsibilities

2. **User Offboarding**
   - Disable login immediately
   - Review their data access
   - Remove from organization after transition
   - Keep audit logs

3. **Backup Admins**
   - Always have at least 2 admin accounts
   - Never have only 1 owner
   - Document admin contact information

4. **Change Management**
   - Document major role changes
   - Notify affected users
   - Update access documentation

---

## Summary of Changes

### Database Migrations

**File:** `supabase/migrations/add_user_management_system.sql`

- Added `login_enabled` column to `user_roles`
- Added `created_by` column to `user_roles`
- Created `user_management_logs` table
- Created `can_user_login` function
- Created `auto_enable_login_for_admins` trigger
- Updated RLS policies

**File:** `supabase/migrations/add_user_lookup_function.sql`

- Created `get_user_id_by_email` function

### Frontend Changes

**Modified Files:**
1. `src/contexts/AuthContext.tsx`
   - Enhanced `signIn` with admin-only check
   - Removed `signUp` usage

2. `src/pages/Auth.tsx`
   - Removed signup toggle
   - Added admin-only warning
   - Removed registration form

3. `src/components/settings/SettingsPage.tsx`
   - Updated to use AdminUserManagement component
   - Changed section title

**New Files:**
1. `src/components/settings/AdminUserManagement.tsx`
   - Complete admin portal for user management
   - Create/Invite modes
   - Login access controls
   - Role management
   - User removal

### Edge Functions

**New:**
1. `supabase/functions/create-user/index.ts`
2. `supabase/functions/manage-login-access/index.ts`

**Modified:**
1. `supabase/functions/invite-user/index.ts`
   - Uses get_user_id_by_email function
   - Sets login_enabled based on role
   - Records created_by
   - Logs to audit table

2. `supabase/functions/get-organization-users/index.ts`
   - Returns login_enabled status
   - Improved performance

### Documentation

**Created:**
1. `SECURE_AUTH_IMPLEMENTATION.md` (this file)
2. `USERS_ROLES_TROUBLESHOOTING.md` (previously created)

---

## Maintenance & Support

### Regular Maintenance Tasks

**Weekly:**
- Check for failed login attempts
- Review new user creation log

**Monthly:**
- Full audit log review
- User access verification
- Remove inactive users

**Quarterly:**
- Security policy review
- Role assignment audit
- Update documentation

### Monitoring Queries

**Check all login-enabled users:**
```sql
SELECT
  au.email,
  ur.role,
  ur.login_enabled,
  ur.created_at
FROM user_roles ur
JOIN auth.users au ON au.id = ur.user_id
WHERE ur.organization_id = 'your-org-id'
AND ur.login_enabled = true
ORDER BY ur.created_at DESC;
```

**Recent administrative actions:**
```sql
SELECT
  admin.email as admin,
  target.email as target_user,
  uml.action,
  uml.details,
  uml.created_at
FROM user_management_logs uml
JOIN auth.users admin ON admin.id = uml.admin_user_id
JOIN auth.users target ON target.id = uml.target_user_id
WHERE uml.organization_id = 'your-org-id'
AND uml.created_at > NOW() - INTERVAL '30 days'
ORDER BY uml.created_at DESC;
```

**Users without login access:**
```sql
SELECT
  au.email,
  ur.role,
  ur.created_at
FROM user_roles ur
JOIN auth.users au ON au.id = ur.user_id
WHERE ur.organization_id = 'your-org-id'
AND ur.login_enabled = false
AND ur.role != 'owner'
ORDER BY ur.created_at DESC;
```

---

## Contact & Support

For issues, questions, or feature requests related to this implementation, please refer to:
- **Troubleshooting Guide:** See issues section above
- **User Guide:** USERS_ROLES_TROUBLESHOOTING.md
- **Database Reference:** Check migration files in `supabase/migrations/`

---

*Last Updated: 2025-12-29*
*Version: 1.0.0*
