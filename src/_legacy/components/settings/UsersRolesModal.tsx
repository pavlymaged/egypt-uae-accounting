import { useState, useEffect } from 'react';
import { X, Users, Mail, UserPlus, Trash2, Shield } from 'lucide-react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { supabase } from '../../lib/supabase';

interface UsersRolesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UserWithRole {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'accountant' | 'staff';
  email?: string;
  created_at: string;
}

export default function UsersRolesModal({ isOpen, onClose }: UsersRolesModalProps) {
  const { currentOrganization, currentRole } = useOrganization();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'accountant' | 'staff'>('staff');

  useEffect(() => {
    if (isOpen && currentOrganization) {
      fetchUsers();
    }
  }, [isOpen, currentOrganization]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-organization-users?organizationId=${currentOrganization?.id}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        const errorMsg = result.error || 'Failed to fetch users';
        const errorDetails = result.details ? ` (${result.details})` : '';
        throw new Error(errorMsg + errorDetails);
      }

      setUsers(result.users || []);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError(err.message || 'Failed to fetch users');
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
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-user`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: inviteEmail,
            organizationId: currentOrganization?.id,
            role: inviteRole,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        const errorMsg = result.error || 'Failed to invite user';
        const errorDetails = result.details ? ` (${result.details})` : '';
        throw new Error(errorMsg + errorDetails);
      }

      setSuccess('User invited successfully!');
      setInviteEmail('');
      setShowInviteForm(false);
      await fetchUsers();
    } catch (err: any) {
      console.error('Error inviting user:', err);
      setError(err.message || 'Failed to invite user');
    } finally {
      setLoading(false);
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
    if (!confirm('Are you sure you want to remove this user?')) return;

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
      owner: 'bg-purple-100 text-purple-800',
      admin: 'bg-blue-100 text-blue-800',
      accountant: 'bg-green-100 text-green-800',
      staff: 'bg-slate-100 text-slate-800',
    };
    return colors[role as keyof typeof colors] || colors.staff;
  };

  const canManageUser = (userRole: string) => {
    if (currentRole?.role === 'owner') return true;
    if (currentRole?.role === 'admin' && userRole !== 'owner') return true;
    return false;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-slate-900 bg-opacity-50" onClick={onClose} />

        <div className="inline-block w-full max-w-3xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
          <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-green-50 to-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Users & Roles</h2>
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
                Manage team members and their access levels
              </p>
              {canManageUser('staff') && (
                <button
                  onClick={() => setShowInviteForm(!showInviteForm)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Invite User
                </button>
              )}
            </div>

            {showInviteForm && (
              <form onSubmit={handleInviteUser} className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Invite New User
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <input
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="staff">Staff</option>
                    <option value="accountant">Accountant</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                  >
                    {loading ? 'Inviting...' : 'Send Invite'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowInviteForm(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {loading && !showInviteForm ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              </div>
            ) : (
              <div className="space-y-3">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-slate-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{user.email}</p>
                        <p className="text-sm text-slate-500">
                          Member since {new Date(user.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {canManageUser(user.role) && user.role !== 'owner' ? (
                        <select
                          value={user.role}
                          onChange={(e) => handleUpdateRole(user.user_id, e.target.value)}
                          className="px-3 py-1 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        >
                          <option value="staff">Staff</option>
                          <option value="accountant">Accountant</option>
                          <option value="admin">Admin</option>
                          {currentRole?.role === 'owner' && <option value="owner">Owner</option>}
                        </select>
                      ) : (
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getRoleBadgeColor(user.role)}`}>
                          <Shield className="w-3 h-3 mr-1" />
                          {user.role.toUpperCase()}
                        </span>
                      )}

                      {canManageUser(user.role) && user.role !== 'owner' && (
                        <button
                          onClick={() => handleRemoveUser(user.user_id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Remove user"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
