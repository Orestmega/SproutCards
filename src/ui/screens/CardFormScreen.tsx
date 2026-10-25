import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import type { Card, Deck } from '../../core/types';
import { useI18n } from '../../i18n';
import { useRepo } from '../AppProviders';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CheckField, TextField } from '../components/Fields';
import { PageHeader } from '../components/Layout';
import { Notice } from '../components/Notice';
import { NotFoundScreen } from './NotFoundScreen';

/** Add (`/decks/:deckId/cards/new`) or edit (`/decks/:deckId/cards/:cardId`) a card. */
export function CardFormScreen() {
  const { deckId = '', cardId } = useParams();
  const repo = useRepo();
  const deck = useLiveQuery(async () => (await repo.getDeck(deckId)) ?? null, [repo, deckId]);
  const card = useLiveQuery(
    async () => (cardId ? ((await repo.getCard(cardId)) ?? null) : undefined),
    [repo, cardId],
  );
  if (deck === undefined || (cardId && card === undefined)) return null; // loading
  if (deck === null || (cardId && (card === null || card?.deckId !== deckId))) {
    return <NotFoundScreen />;
  }
  return <CardForm deck={deck} card={card ?? undefined} />;
}

interface ExampleValue {
  text: string;
  translation: string;
}

function CardForm({ deck, card }: { deck: Deck; card: Card | undefined }) {
  const { t, languageName } = useI18n();
  const navigate = useNavigate();
  // Bumped after "save and add another" to start with a clean form.
  const [formKey, setFormKey] = useState(0);
  const [added, setAdded] = useState(0);

  return (
    <>
      <PageHeader
        title={card ? t('cardForm.titleEdit') : t('cardForm.titleNew')}
        backTo={`/decks/${deck.id}`}
      />
      {added > 0 && !card && (
        <Notice kind="success">{t('cardForm.added', { count: added })}</Notice>
      )}
      <CardFields
        key={formKey}
        deck={deck}
        card={card}
        labels={{
          term: languageName(deck.learningLang),
          translation: languageName(deck.translationLang),
        }}
        onSaved={(another) => {
          if (another) {
            setAdded((n) => n + 1);
            setFormKey((k) => k + 1);
          } else navigate(`/decks/${deck.id}`);
        }}
        onDeleted={() => navigate(`/decks/${deck.id}`, { replace: true })}
      />
    </>
  );
}

function CardFields({
  deck,
  card,
  labels,
  onSaved,
  onDeleted,
}: {
  deck: Deck;
  card: Card | undefined;
  labels: { term: string; translation: string };
  onSaved: (addAnother: boolean) => void;
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  const repo = useRepo();
  const [term, setTerm] = useState(card?.term ?? '');
  const [translations, setTranslations] = useState(card?.translations.join('\n') ?? '');
  const [examples, setExamples] = useState<ExampleValue[]>(
    card?.examples.map((e) => ({ text: e.text, translation: e.translation ?? '' })) ?? [],
  );
  const [notes, setNotes] = useState(card?.notes ?? '');
  const [reviewed, setReviewed] = useState(card?.reviewed ?? true);
  const [submitted, setSubmitted] = useState(false);
  const [failed, setFailed] = useState<'save' | 'delete' | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const translationList = translations
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  const termError = term.trim() === '' ? t('cardForm.termRequired') : undefined;
  const translationError =
    translationList.length === 0 ? t('cardForm.translationRequired') : undefined;

  async function save(addAnother: boolean) {
    setSubmitted(true);
    if (termError || translationError) return;
    setSaving(true);
    setFailed(null);
    const input = {
      term,
      translations: translationList,
      examples: examples
        .filter((e) => e.text.trim() !== '')
        .map((e) =>
          e.translation.trim() === ''
            ? { text: e.text.trim() }
            : { text: e.text.trim(), translation: e.translation.trim() },
        ),
      notes,
      reviewed,
    };
    try {
      if (card) await repo.updateCard(card.id, input);
      else await repo.addCard(deck.id, input);
      onSaved(addAnother);
    } catch {
      setFailed('save');
      setSaving(false);
    }
  }

  async function remove() {
    if (!card) return;
    try {
      await repo.deleteCard(card.id);
      onDeleted();
    } catch {
      setConfirmDelete(false);
      setFailed('delete');
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void save(false);
  }

  const setExample = (index: number, patch: Partial<ExampleValue>) =>
    setExamples(examples.map((e, i) => (i === index ? { ...e, ...patch } : e)));

  return (
    <>
      <form className="form" onSubmit={onSubmit} noValidate>
        <TextField
          label={t('cardForm.term', { language: labels.term })}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          error={submitted ? termError : undefined}
          maxLength={500}
          autoFocus
          autoCapitalize="off"
        />
        <TextField
          multiline
          label={t('cardForm.translations', { language: labels.translation })}
          hint={t('cardForm.translationsHint')}
          value={translations}
          onChange={(e) => setTranslations(e.target.value)}
          error={submitted ? translationError : undefined}
          rows={3}
        />

        <fieldset className="section" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field__label">{t('cardForm.examples')}</legend>
          {examples.map((example, i) => (
            <div key={i} className="list-row" style={{ alignItems: 'flex-start' }}>
              <div className="form" style={{ flex: 1 }}>
                <TextField
                  label={t('cardForm.exampleText', { number: i + 1 })}
                  value={example.text}
                  onChange={(e) => setExample(i, { text: e.target.value })}
                  maxLength={500}
                />
                <TextField
                  label={t('cardForm.exampleTranslation', { number: i + 1 })}
                  value={example.translation}
                  onChange={(e) => setExample(i, { translation: e.target.value })}
                  maxLength={500}
                />
              </div>
              <button
                type="button"
                className="icon-btn"
                aria-label={t('cardForm.removeExample', { number: i + 1 })}
                onClick={() => setExamples(examples.filter((_, j) => j !== i))}
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
          ))}
          <Button
            variant="secondary"
            small
            onClick={() => setExamples([...examples, { text: '', translation: '' }])}
          >
            {t('cardForm.addExample')}
          </Button>
        </fieldset>

        <TextField
          multiline
          label={t('cardForm.notes')}
          hint={t('form.optional')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={1000}
        />
        {card && !card.reviewed && (
          <CheckField label={t('cardForm.markChecked')} checked={reviewed} onChange={setReviewed} />
        )}

        {failed && (
          <Notice kind="error">
            {t(failed === 'save' ? 'common.saveFailed' : 'common.deleteFailed')}
          </Notice>
        )}
        <Button type="submit" disabled={saving} block>
          {t('common.save')}
        </Button>
        {!card && (
          <Button variant="secondary" disabled={saving} block onClick={() => void save(true)}>
            {t('cardForm.saveAnother')}
          </Button>
        )}
        {card && (
          <Button variant="danger" onClick={() => setConfirmDelete(true)} block>
            {t('cardForm.delete')}
          </Button>
        )}
      </form>

      {confirmDelete && (
        <ConfirmDialog
          title={t('cardForm.deleteConfirm.title')}
          confirmLabel={t('common.delete')}
          danger
          onConfirm={() => void remove()}
          onCancel={() => setConfirmDelete(false)}
        >
          <p>{t('cardForm.deleteConfirm.text', { term: card?.term ?? '' })}</p>
        </ConfirmDialog>
      )}
    </>
  );
}
