import { useI18n } from '../../../i18n/I18nProvider';
import type { FeeCharge } from './feeCharges';

export function FeeModeText({ charge }: { charge: Pick<FeeCharge, 'mode' | 'account_name'> }) {
  const { t } = useI18n();
  return <>{charge.mode === 'deducted' ? t('feeCharges.mode.deducted') : t('feeCharges.mode.direct', { account: charge.account_name ?? '-' })}</>;
}
