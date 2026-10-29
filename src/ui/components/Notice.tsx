import type { ReactNode } from 'react';
import { Mascot } from './Mascot';
import type { MascotMood } from './Mascot';

type Kind = 'success' | 'error' | 'warn' | 'info';

const ICON: Record<Kind, string> = { success: '✓', error: '✗', warn: '!', info: 'i' };

/**
 * Inline message. Always has an icon character as well as a colour, so it never relies on colour alone.
 * Errors are announced immediately (`alert`), other messages politely (`status`).
 */
export function Notice({ kind = 'info', children }: { kind?: Kind; children: ReactNode }) {
  return (
    <div className={`notice notice--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <span className="notice__icon" aria-hidden="true">
        {ICON[kind]}
      </span>
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({
  title,
  text,
  mood = 'normal',
  children,
}: {
  title: string;
  text?: string;
  mood?: MascotMood;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Mascot mood={mood} size={104} />
      <h2>{title}</h2>
      {text && <p className="muted">{text}</p>}
      {children}
    </div>
  );
}
