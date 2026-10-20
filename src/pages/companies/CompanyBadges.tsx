import { Badge } from '../../components/ui/Feedback';
import { useI18n } from '../../i18n/I18nProvider';
import type { CompanyStatus, ServiceModel } from '../../types';

export function ServiceModelBadge({ model }: { model: ServiceModel }) {
  const { t } = useI18n();
  return <Badge tone={model === 'managed' ? 'brand' : 'sky'}>{t(`model.${model}`)}</Badge>;
}

const statusTones = { active: 'success', suspended: 'warning', closed: 'neutral' } as const;

export function CompanyStatusBadge({ status }: { status: CompanyStatus }) {
  const { t } = useI18n();
  return <Badge tone={statusTones[status]}>{t(`status.${status}`)}</Badge>;
}
