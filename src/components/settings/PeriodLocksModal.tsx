import { useState, useEffect } from 'react';
import { X, Lock, Unlock, Calendar, Shield } from 'lucide-react';
import { useOrganization } from '../../contexts/OrganizationContext';
import { supabase } from '../../lib/supabase';

interface PeriodLocksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PeriodLock {
  id: string;
  period_start: string;
  period_end: string;
  locked_by: string;
  locked_at: string;
  reason: string;
  organization_id: string;
}

export default function PeriodLocksModal({ isOpen, onClose }: PeriodLocksModalProps) {
  const { currentOrganization } = useOrganization();
  const [periodLocks, setPeriodLocks] = useState<PeriodLock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showLockForm, setShowLockForm] = useState(false);

  const [formData, setFormData] = useState({
    period_start: '',
    period_end: '',
    reason: '',
  });

  useEffect(() => {
    if (isOpen && currentOrganization) {
      fetchPeriodLocks();
    }
  }, [isOpen, currentOrganization]);

  const fetchPeriodLocks = async () => {
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('period_locks')
        .select('*')
        .eq('organization_id', currentOrganization?.id)
        .order('period_end', { ascending: false });

      if (fetchError) throw fetchError;
      setPeriodLocks(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch period locks');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ period_start: '', period_end: '', reason: '' });
    setShowLockForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { data: userData } = await supabase.auth.getUser();

      const { error: insertError } = await supabase
        .from('period_locks')
        .insert({
          ...formData,
          organization_id: currentOrganization?.id,
          locked_by: userData.user?.id,
          is_locked: true,
        });

      if (insertError) throw insertError;

      setSuccess('Period locked successfully!');
      resetForm();
      await fetchPeriodLocks();
    } catch (err: any) {
      setError(err.message || 'Failed to lock period');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async (id: string) => {
    if (!confirm('Are you sure you want to unlock this period? This will allow editing of transactions in this period.')) {
      return;
    }

    setError('');
    try {
      const { error: deleteError } = await supabase
        .from('period_locks')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      setSuccess('Period unlocked successfully!');
      await fetchPeriodLocks();
    } catch (err: any) {
      setError(err.message || 'Failed to unlock period');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-slate-900 bg-opacity-50" onClick={onClose} />

        <div className="inline-block w-full max-w-3xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
          <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-amber-50 to-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-600 rounded-lg flex items-center justify-center">
                <Lock className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Period Locks</h2>
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

            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-900 mb-1">What are Period Locks?</h3>
                  <p className="text-sm text-blue-800">
                    Period locks prevent modifications to transactions within a specific date range.
                    This is commonly used after financial reporting or audits to maintain data integrity.
                    Only accountants and owners can manage period locks.
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Lock accounting periods to prevent changes
              </p>
              {!showLockForm && (
                <button
                  onClick={() => setShowLockForm(true)}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition flex items-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  Lock Period
                </button>
              )}
            </div>

            {showLockForm && (
              <form onSubmit={handleSubmit} className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Lock New Period
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Period Start Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.period_start}
                      onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Period End Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.period_end}
                      onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Reason for Lock
                  </label>
                  <textarea
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    rows={2}
                    placeholder="e.g., Year-end audit completed"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    {loading ? 'Locking...' : 'Lock Period'}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {loading && !showLockForm ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
              </div>
            ) : (
              <div className="space-y-3">
                {periodLocks.map((lock) => (
                  <div
                    key={lock.id}
                    className="p-4 bg-slate-50 rounded-lg border-l-4 border-amber-500 hover:bg-slate-100 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Lock className="w-4 h-4 text-amber-600" />
                          <h3 className="font-semibold text-slate-900">
                            {formatDate(lock.period_start)} - {formatDate(lock.period_end)}
                          </h3>
                        </div>
                        {lock.reason && (
                          <p className="text-sm text-slate-600 mb-2">
                            Reason: {lock.reason}
                          </p>
                        )}
                        <p className="text-xs text-slate-500">
                          Locked on {formatDate(lock.locked_at)}
                        </p>
                      </div>

                      <button
                        onClick={() => handleUnlock(lock.id)}
                        className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition flex items-center gap-2"
                      >
                        <Unlock className="w-4 h-4" />
                        Unlock
                      </button>
                    </div>
                  </div>
                ))}

                {periodLocks.length === 0 && (
                  <div className="text-center py-8">
                    <Lock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">No locked periods</p>
                    <p className="text-sm text-slate-400 mt-1">
                      Lock periods to prevent editing of transactions within specific date ranges
                    </p>
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
