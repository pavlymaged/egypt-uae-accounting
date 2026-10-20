import { Eye, LifeBuoy, LogOut, PencilLine } from 'lucide-react';
import { useState } from 'react';
import { useSession } from '../../auth/SessionProvider';
import { Button } from '../../components/ui/Button';
import { Alert, Badge, Card } from '../../components/ui/Feedback';
import { Field, inputClass } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useI18n } from '../../i18n/I18nProvider';
import { formatDateTime } from '../../lib/dates';
import { isNetworkError } from '../../lib/errors';
import { supabase } from '../../lib/supabase';
import { useSupportSession } from '../../support/SupportSessionProvider';
import type { Company } from '../../types';

const MIN_REASON = 5;

type Ask = 'open' | 'edit' | null;

export function SupportPanel({ company }: { company: Pick<Company, 'id' | 'name' | 'service_model' | 'status'> }) {
  const { t, lang } = useI18n();
  const { session } = useSession();
  const { active, refresh, close } = useSupportSession();
  const [ask, setAsk] = useState<Ask>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (company.service_model !== 'self_service') {
    return (
      <Card className="p-6">
        <p className="text-sm text-ink-600">{t('support.managedOnly')}</p>
      </Card>
    );
  }

  const here = active && active.company_id === company.id ? active : null;
  const elsewhere = active && active.company_id !== company.id ? active : null;

  function startAsk(kind: Ask) {
    setReason('');
    setReasonError(null);
    setError(null);
    setNotice(null);
    setAsk(kind);
  }

  async function submitReason() {
    const text = reason.trim();
    const field = ask === 'edit' ? t('support.editReason') : t('support.reason');
    if (text.length < MIN_REASON) return setReasonError(t('support.reasonShort', { field, n: MIN_REASON }));
    setBusy(true);
    const result =
      ask === 'open'
        ? await supabase
            .from('support_sessions')
            .insert({ staff_user_id: session?.user.id, company_id: company.id, reason: text })
            .select('id')
            .maybeSingle()
        : await supabase
            .from('support_sessions')
            .update({ mode: 'edit', edit_reason: text })
            .eq('id', here?.id ?? '')
            .select('id')
            .maybeSingle();
    setBusy(false);
    if (result.error) {
      return setReasonError(isNetworkError(result.error) ? t('common.networkError') : t('common.saveFailed', { msg: result.error.message }));
    }
    if (!result.data) return setReasonError(t('common.notSaved'));
    setNotice(ask === 'open' ? t('support.opened') : t('support.editOn'));
    setAsk(null);
    await refresh();
  }

  async function closeSession() {
    if (!here) return;
    setBusy(true);
    setError(null);
    const res = await close(here.id);
    setBusy(false);
    if (res === 'ok') return setNotice(t('support.closed'));
    setError(res === 'network' ? t('common.networkError') : res === 'notSaved' ? t('common.notSaved') : t('common.saveFailed', res));
  }

  return (
    <div className="space-y-4">
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      <Card>
        <div className="flex flex-wrap items-start gap-4 px-5 py-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
            <LifeBuoy className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-ink-900">{t('support.title')}</h2>
            <p className="mt-1 text-sm text-ink-500">{t('support.body')}</p>
          </div>
        </div>

        <div className="border-t border-ink-100 px-5 py-5">
          {here ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="success">{t('support.status.open')}</Badge>
                <Badge tone={here.mode === 'edit' ? 'warning' : 'sky'}>{t(`support.mode.${here.mode}`)}</Badge>
                <span className="text-sm text-ink-600">{t('support.endsAt', { time: formatDateTime(here.expires_at, lang) })}</span>
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-ink-500">{t('support.reason')}</dt>
                  <dd className="mt-0.5 text-ink-900">{here.reason}</dd>
                </div>
                {here.edit_reason && (
                  <div>
                    <dt className="text-ink-500">{t('support.editReason')}</dt>
                    <dd className="mt-0.5 text-ink-900">{here.edit_reason}</dd>
                  </div>
                )}
              </dl>
              <div className="flex flex-wrap gap-2">
                {here.mode === 'read' && (
                  <Button variant="secondary" icon={<PencilLine className="h-4 w-4" />} onClick={() => startAsk('edit')}>
                    {t('support.switchEdit')}
                  </Button>
                )}
                <Button variant="danger" icon={<LogOut className="h-4 w-4" />} loading={busy && ask === null} onClick={() => void closeSession()}>
                  {t('support.close')}
                </Button>
              </div>
            </div>
          ) : elsewhere ? (
            <Alert tone="info">{t('support.elsewhere', { company: elsewhere.company?.name ?? '' })}</Alert>
          ) : company.status === 'closed' ? (
            <p className="text-sm text-ink-500">{t('support.companyClosed')}</p>
          ) : (
            <Button icon={<Eye className="h-4 w-4" />} onClick={() => startAsk('open')}>
              {t('support.open')}
            </Button>
          )}
        </div>
      </Card>

      <Modal
        open={ask !== null}
        title={ask === 'edit' ? t('support.switchEdit') : t('support.open')}
        description={ask === 'edit' ? t('support.editIntro') : t('support.openIntro', { company: company.name })}
        submitLabel={ask === 'edit' ? t('support.switchEdit') : t('support.open')}
        submitTone={ask === 'edit' ? 'danger' : 'primary'}
        busy={busy}
        onSubmit={() => void submitReason()}
        onClose={() => setAsk(null)}
      >
        <Field label={ask === 'edit' ? t('support.editReason') : t('support.reason')} hint={t('support.reasonHint', { n: MIN_REASON })} error={reasonError ?? undefined}>
          {(id, d, invalid) => (
            <textarea
              id={id}
              rows={3}
              maxLength={500}
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-describedby={d}
              aria-invalid={invalid}
              className={`${inputClass(invalid)} resize-y`}
            />
          )}
        </Field>
      </Modal>
    </div>
  );
}
