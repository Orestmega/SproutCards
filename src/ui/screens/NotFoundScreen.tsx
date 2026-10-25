import { useI18n } from '../../i18n';
import { ButtonLink } from '../components/Button';
import { EmptyState } from '../components/Notice';

export function NotFoundScreen() {
  const { t } = useI18n();
  return (
    <EmptyState title={t('notFound.title')} text={t('notFound.text')} mood="encouraging">
      <ButtonLink to="/">{t('notFound.home')}</ButtonLink>
    </EmptyState>
  );
}
