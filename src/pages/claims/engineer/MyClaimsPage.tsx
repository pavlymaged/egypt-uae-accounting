import { FileText, Pencil, Plus, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../../../auth/SessionProvider';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Alert, Card, EmptyState, Spinner } from '../../../components/ui/Feedback';
import { useI18n } from '../../../i18n/I18nProvider';
import { supabase } from '../../../lib/supabase';
import { dbErrorText } from '../../books/books';
import { ClaimSummary } from '../ClaimParts';
import { CLAIM_COLUMNS, type SiteClaim } from '../claims';
import { EngineerScreen } from './EngineerScreen';
import type { EngineerCompany } from './useEngineerCompany';

export function MyClaimsPage() {
  const { t } = useI18n();
  return <EngineerScreen title={t('nav.myClaims')} subtitle={t('claims.mineSubtitle')}>{(c) => <ClaimsList company={c} />}</EngineerScreen>;
}

function ClaimsList({ company }: { company: EngineerCompany }) {
  const { t } = useI18n();
  const { session } = useSession();
  const userId = session?.user.id;
  const location = useLocation();
  const navigate = useNavigate();
  const [claims, setClaims] = useState<SiteClaim[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(() =>
    (location.state as { sent?: boolean } | null)?.sent ? { tone: 'success', text: t('claims.sent') } : null,
  );
  const [cancelling, setCancelling] = useState<SiteClaim | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if ((location.state as { sent?: boolean } | null)?.sent) navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setFailed(false);
    supabase
      .from('site_claims_list')
      .select(CLAIM_COLUMNS)
      .eq('company_id', company.companyId)
      .eq('engineer_user_id', userId)
      .order('claim_date', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !Array.isArray(data)) return setFailed(true);
        setClaims(data as unknown as SiteClaim[]);
      });
    return () => {
      cancelled = true;
    };
  }, [company.companyId, userId, attempt]);

  async function cancelClaim() {
    if (!cancelling) return;
    setBusy(true);
    const { error } = await supabase.rpc('cancel_site_claim', { p_claim: cancelling.claim_id });
    setBusy(false);
    setCancelling(null);
    setNotice(error ? { tone: 'error', text: dbErrorText(error, t) } : { tone: 'success', text: t('claims.cancelled') });
    setAttempt((a) => a + 1);
  }

  return (
    <div className="space-y-4">
      <Button full icon={<Plus className="h-5 w-5" />} className="min-h-[3rem] text-base" onClick={() => navigate('/new-claim')}>{t('nav.newClaim')}</Button>
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
      {failed && (
        <Alert tone="error" action={<Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>{t('common.retry')}</Button>}>
          {t('common.loadFailed')}
        </Alert>
      )}
      {!failed && !claims && <Spinner label={t('common.loading')} />}
      {claims && claims.length === 0 && (
        <Card><EmptyState icon={<FileText className="h-6 w-6" />} title={t('claims.mineEmpty')} /></Card>
      )}
      {claims && claims.length > 0 && (
        <ul className="space-y-3">
          {claims.map((c) => (
            <li key={c.claim_id}>
              <Card className="p-4 sm:p-5">
                <ClaimSummary
                  claim={c}
                  currency={company.currency}
                  actions={
                    (c.can_edit || c.can_cancel) && (
                      <>
                        {c.can_edit && (
                          <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} className="min-h-[2.75rem]" onClick={() => navigate(`/my-claims/${c.claim_id}/edit`)}>
                            {t('common.edit')}
                          </Button>
                        )}
                        {c.can_cancel && (
                          <Button variant="ghost" icon={<XCircle className="h-4 w-4" />} className="min-h-[2.75rem] text-red-700 hover:bg-red-50" onClick={() => { setNotice(null); setCancelling(c); }}>
                            {t('claims.cancel')}
                          </Button>
                        )}
                      </>
                    )
                  }
                />
              </Card>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={cancelling !== null}
        title={t('claims.cancelTitle')}
        confirmLabel={t('claims.cancel')}
        tone="danger"
        loading={busy}
        onConfirm={() => void cancelClaim()}
        onCancel={() => setCancelling(null)}
      >
        {t('claims.cancelBody')}
      </ConfirmDialog>
    </div>
  );
}
