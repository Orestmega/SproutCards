import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Variant = 'primary' | 'secondary' | 'danger';

interface CommonProps {
  variant?: Variant;
  small?: boolean;
  block?: boolean;
  children: ReactNode;
}

function classes({ variant = 'primary', small, block }: CommonProps): string {
  return ['btn', `btn--${variant}`, small && 'btn--small', block && 'btn--block']
    .filter(Boolean)
    .join(' ');
}

export function Button({
  variant,
  small,
  block,
  children,
  type = 'button',
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={classes({ variant, small, block, children })} {...rest}>
      {children}
    </button>
  );
}

/** A link that looks like a button. */
export function ButtonLink({ to, variant, small, block, children }: CommonProps & { to: string }) {
  return (
    <Link to={to} className={classes({ variant, small, block, children })}>
      {children}
    </Link>
  );
}
