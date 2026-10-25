import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { useRepo } from '../AppProviders';
import { Button } from '../components/Button';
import { LANGUAGE_CODE_RE, LanguageField, TextField } from '../components/Fields';
import { PageHeader } from '../components/Layout';
import { Notice } from '../components/Notice';
import { NotFoundScreen } from './NotFoundScreen';

/** Create (`/decks/new`) or edit (`/decks/:deckId/edit`) a deck. */
export function DeckFormScreen() {
  const { deckId } = useParams();
  const repo = useRepo();
  const existing = useLiveQuery(
    async () => (deckId ? ((await repo.getDeck(deckId)) ?? null) : undefined),
    [repo, deckId],
  );
  if (deckId && existing === undefined) return null; // loading
  if (deckId && existing === null) return <NotFoundScreen />;
  return (
    <DeckForm
      deckId={deckId}
      initial={{
        name: existing?.name ?? '',
        description: existing?.description ?? '',
        learningLang: existing?.learningLang ?? 'en',
        translationLang: existing?.translationLang ?? 'uk',
      }}
    />
  );
}

interface FormValues {
  name: string;
  description: string;
  learningLang: string;
  translationLang: string;
}

function DeckForm({ deckId, initial }: { deckId: string | undefined; initial: FormValues }) {
  const { t } = useI18n();
  const repo = useRepo();
  const navigate = useNavigate();
  const [values, setValues] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const errors = {
    name: values.name.trim() === '' ? t('form.nameRequired') : undefined,
    learningLang: !LANGUAGE_CODE_RE.test(values.learningLang)
      ? t('form.languageInvalid')
      : undefined,
    translationLang: !LANGUAGE_CODE_RE.test(values.translationLang)
      ? t('form.languageInvalid')
      : values.translationLang.toLowerCase() === values.learningLang.toLowerCase()
        ? t('form.languagesSame')
        : undefined,
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const shown = (key: keyof typeof errors) => (submitted ? errors[key] : undefined);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (hasErrors) return;
    setSaving(true);
    setFailed(false);
    try {
      const data = {
        name: values.name,
        learningLang: values.learningLang,
        translationLang: values.translationLang,
        description: values.description.trim() || undefined,
      };
      if (deckId) {
        await repo.updateDeck(deckId, data);
        navigate(`/decks/${deckId}`);
      } else {
        const deck = await repo.createDeck(data);
        navigate(`/decks/${deck.id}`);
      }
    } catch {
      setFailed(true);
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title={deckId ? t('deckForm.titleEdit') : t('deckForm.titleNew')}
        backTo={deckId ? `/decks/${deckId}` : '/decks'}
      />
      <form className="form" onSubmit={onSubmit} noValidate>
        <TextField
          label={t('form.deckName')}
          value={values.name}
          onChange={(e) => setValues({ ...values, name: e.target.value })}
          error={shown('name')}
          maxLength={100}
          autoFocus={!deckId}
        />
        <LanguageField
          label={t('form.learningLang')}
          value={values.learningLang}
          onChange={(code) => setValues({ ...values, learningLang: code })}
          error={shown('learningLang')}
        />
        <LanguageField
          label={t('form.translationLang')}
          value={values.translationLang}
          onChange={(code) => setValues({ ...values, translationLang: code })}
          error={shown('translationLang')}
        />
        <TextField
          multiline
          label={t('form.description')}
          hint={t('form.optional')}
          value={values.description}
          onChange={(e) => setValues({ ...values, description: e.target.value })}
          maxLength={500}
        />
        {failed && <Notice kind="error">{t('common.saveFailed')}</Notice>}
        <Button type="submit" disabled={saving} block>
          {t('common.save')}
        </Button>
      </form>
    </>
  );
}
