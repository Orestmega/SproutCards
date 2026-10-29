import { useState } from 'react';
import { useI18n } from '../../i18n';
import { useRepo } from '../AppProviders';

/**
 * A star toggle for a card: marks words that are hard or important, so they can be studied on their own.
 * It saves at once; if saving fails the star goes back to what it was (the state is never left lying).
 */
export function StarButton({
  cardId,
  term,
  starred,
}: {
  cardId: string;
  /** The card's word, used in the accessible name ("Add a star to apple"). */
  term: string;
  starred: boolean;
}) {
  const { t } = useI18n();
  const repo = useRepo();
  // what the user just chose; shown until the stored value (`starred`) catches up
  const [choice, setChoice] = useState<boolean | null>(null);
  const on = choice ?? starred;

  function toggle() {
    const next = !on;
    setChoice(next);
    repo.setStarred(cardId, next).catch(() => setChoice(!next));
  }

  return (
    <button
      type="button"
      className={on ? 'icon-btn star star--on' : 'icon-btn star'}
      aria-pressed={on}
      aria-label={t(on ? 'star.remove' : 'star.add', { term })}
      onClick={toggle}
    >
      <svg
        viewBox="0 0 24 24"
        width="24"
        height="24"
        fill={on ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z" />
      </svg>
    </button>
  );
}
