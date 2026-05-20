import { useState, useEffect } from 'react';
import { X, Users, Mail, UserPlus, Trash2, Shield, Lock, Unlock, Key } from 'lucide-react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { supabase } from '../../lib/supabase';

interface AdminUserManagementProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UserWithRole {
  id: string;
  user_id: string;
  role: 'super_admin' | 'accountant' | 'staff';
  login_enabled: boolean;
  email?: string;
  created_at: string;
  created_by?: string;
}

type CreateMode = 'create' | 'invite';

export default function AdminUserManagement({ isOpen, onClose }: AdminUserManagementProps) {
  const { currentOrganization, currentRole } = useOrganization();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showUserForm, setShowUserForm] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>('create');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'staff' as 'super_admin' | 'accountant' | 'staff',
    loginEnabled: false,
  });

  useEffect(() => {
    if (isOpen && currentOrganization) {
      fetchUsers();
    }
  }, [isOpen, currentOrganization]);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      console.log('Fetching users for organization:', currentOrganization?.id);

      const { data, error: functionError } = await supabase.functions.invoke(
        'get-organization-users',
        {
          body: { organizationId: currentOrganization?.id },
        }
      );

      console.log('Function response:', { data, error: functionError });

      if (functionError) {
        console.error('Function error details:', functionError);
        throw new Error(`Function error: ${functionError.message}`);
      }

      if (data?.error) {
        console.error('Data error:', data.error);
        if (data.details) {
          console.error('Error details:', data.details);
        }
        throw new Error(data.error);
      }

      console.log('Successfully fetched users:', data?.users);
      setUsers(data?.users || []);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { data, error: functionError } = await supabase.functions.invoke('create-user', {
        body: {
          email: formData.email,
          password: formData.password,
          organizationId: currentOrganization?.id,
          role: formData.role,
          loginEnabled: formData.role === 'super_admin' ? true : formData.loginEnabled,
        },
      });

      if (functionError) {
        throw functionError;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setSuccess('User created successfully!');
      setFormData({ email: '', password: '', role: 'staff', loginEnabled: false });
      setShowUserForm(false);
      await fetchUsers();
    } catch (err: any) {
      console.error('Error creating user:', err);
      setError(err.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { data, error: functionError } = await supabase.functions.invoke('invite-user', {
        body: {
          email: formData.email,
          organizationId: currentOrganization?.id,
          role: formData.role,
        },
      });

      if (functionError) {
        throw functionError;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setSuccess('User invited successfully!');
      setFormData({ email: '', password: '', role: 'staff', loginEnabled: false });
      setShowUserForm(false);
      await fetchUsers();
    } catch (err: any) {
      console.error('Error inviting user:', err);
      setError(err.message || 'Failed to invite user');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLoginAccess = async (userId: string, currentStatus: boolean) => {
    setError('');
    setSuccess('');

    try {
      const { data, error: functionError } = await supabase.functions.invoke('manage-login-access', {
        body: {
          organizationId: currentOrganization?.id,
          targetUserId: userId,
          loginEnabled: !currentStatus,
        },
      });

      if (functionError) {
        throw functionError;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setSuccess(data?.message || 'Login access updated successfully!');
      await fetchUsers();
    } catch (err: any) {
      console.error('Error updating login access:', err);
      setError(err.message || 'Failed to update login access');
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('organization_id', currentOrganization?.id)
        .eq('user_id', userId);

      if (updateError) throw updateError;

      setSuccess('Role updated successfully!');
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to update role');
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this user? They will lose all access to this organization.')) return;

    setError('');
    try {
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('organization_id', currentOrganization?.id)
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      setSuccess('User removed successfully!');
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to remove user');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    const colors = {
      super_admin: 'bg-blue-100 text-blue-800',
      accountant: 'bg-green-100 text-green-800',
      staff: 'bg-slate-100 text-slate-800',
    };
    return colors[role as keyof typeof colors] || colors.staff;
  };

  const canManageUser = (userRole: string) => {
    if (currentRole?.role === 'super_admin') return true;
    return false;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-slate-900 bg-opacity-50" onClick={onClose} />

        <div className="inline-block w-full max-w-4xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
          <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Admin User Management</h2>
                <p className="text-sm text-slate-600">Create and manage user accounts</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                {success}
              </div>
            )}

            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                {users.length} user{users.length !== 1 ? 's' : ''} in this organization
              </p>
              {canManageUser('staff') && (
                <button
                  onClick={() => setShowUserForm(!showUserForm)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Add User
                </button>
              )}
            </div>

            {showUserForm && (
              <div className="mb-6 p-6 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <UserPlus className="w-5 h-5" />
                    Add New User
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCreateMode('create')}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                        createMode === 'create'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Create New
                    </button>
                    <button
                      onClick={() => setCreateMode('invite')}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                        createMode === 'invite'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Invite Existing
                    </button>
                  </div>
                </div>

                <form onSubmit={createMode === 'create' ? handleCreateUser : handleInviteUser} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="user@example.com"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    {createMode === 'create' && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Password
                        </label>
                        <input
                          type="password"
                          required
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          placeholder="Minimum 6 characters"
                          minLength={6}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Role
                      </label>
                      <select
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="staff">Staff - Limited access</option>
                        <option value="accountant">Accountant - Financial access</option>
                        <option value="super_admin">Super Administrator - Full access</option>
                      </select>
                    </div>

                    {createMode === 'create' && formData.role !== 'super_admin' && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Login Access
                        </label>
                        <label className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={formData.loginEnabled}
                            onChange={(e) => setFormData({ ...formData, loginEnabled: e.target.checked })}
                            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-slate-700">Allow user to log in</span>
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                    >
                      <Key className="w-4 h-4" />
                      {loading ? 'Processing...' : createMode === 'create' ? 'Create User' : 'Send Invite'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowUserForm(false)}
                      className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="text-xs text-slate-500 bg-white rounded-lg p-3 border border-slate-200">
                    {createMode === 'create' ? (
                      <>
                        <strong>Create New:</strong> Creates a new account with the specified email and password.
                        {formData.role === 'super_admin' ? ' Super Administrators always have login access.' : ' You can control login access.'}
                      </>
                    ) : (
                      <>
                        <strong>Invite Existing:</strong> Adds an existing registered user to this organization.
                        {formData.role === 'super_admin' ? ' Super Administrators automatically get login access.' : ' Login access is disabled by default for staff and accountants.'}
                      </>
                    )}
                  </div>
                </form>
              </div>
            )}

            {loading && !showUserForm ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="space-y-3">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition border border-slate-200"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-slate-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900">{user.email}</p>
                          {user.login_enabled ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              <Unlock className="w-3 h-3 mr-1" />
                              Login Enabled
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                              <Lock className="w-3 h-3 mr-1" />
                              Login Disabled
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500">
                          Member since {new Date(user.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {canManageUser(user.role) && user.role !== 'super_admin' ? (
                        <>
                          <select
                            value={user.role}
                            onChange={(e) => handleUpdateRole(user.user_id, e.target.value)}
                            className="px-3 py-1 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="staff">Staff</option>
                            <option value="accountant">Accountant</option>
                            <option value="super_admin">Super Administrator</option>
                          </select>

                          {user.role !== 'super_admin' && (
                            <button
                              onClick={() => handleToggleLoginAccess(user.user_id, user.login_enabled)}
                              className={`p-2 rounded-lg transition ${
                                user.login_enabled
                                  ? 'text-amber-600 hover:bg-amber-50'
                                  : 'text-green-600 hover:bg-green-50'
                              }`}
                              title={user.login_enabled ? 'Disable login' : 'Enable login'}
                            >
                              {user.login_enabled ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                            </button>
                          )}

                          <button
                            onClick={() => handleRemoveUser(user.user_id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Remove user"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getRoleBadgeColor(user.role)}`}>
                          <Shield className="w-3 h-3 mr-1" />
                          {user.role === 'super_admin' ? 'SUPER ADMIN' : user.role.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {users.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    No users found
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
