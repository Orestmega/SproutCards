import type { ReactNode } from 'react';

interface ChoiceCardProps {
  children: ReactNode;
  onClick: () => void;
  /** Selected (before checking). */
  selected?: boolean;
  /** After checking: marks the right/wrong option. A text/icon `mark` is shown too, never colour alone. */
  state?: 'correct' | 'wrong';
  /** Short text shown at the end, e.g. "✓" or "✗" (colour is not the only signal). */
  mark?: string;
  disabled?: boolean;
}

/** Big rounded answer option. The whole card is the tap target. */
export function ChoiceCard({
  children,
  onClick,
  selected,
  state,
  mark,
  disabled,
}: ChoiceCardProps) {
  const className = ['choice', state && `choice--${state}`].filter(Boolean).join(' ');
  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      aria-pressed={selected ?? false}
      disabled={disabled}
    >
      <span style={{ flex: 1 }}>{children}</span>
      {mark && (
        <span className="choice__mark" aria-hidden="true">
          {mark}
        </span>
      )}
    </button>
  );
}
