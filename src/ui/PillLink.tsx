import type { ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

export type PillVariant = 'amber' | 'outline' | 'coral';

const BASE = 'inline-flex min-h-12 w-full items-center justify-center rounded-full border px-5 text-base font-semibold';
const VARIANTS: Record<PillVariant, string> = {
  amber: 'border-transparent bg-amber text-on-amber hover:bg-amber-pressed',
  outline: 'border-amber bg-surface text-ink hover:bg-brand-soft',
  coral: 'border-transparent bg-primary text-on-primary hover:bg-primary-pressed',
};

/** Full-width pill link used for the onboarding actions (welcome, set up, join), as in the mockups. */
export function PillLink({ variant, children, ...rest }: LinkProps & { variant: PillVariant; children: ReactNode }) {
  return (
    <Link {...rest} className={`${BASE} ${VARIANTS[variant]}`}>
      {children}
    </Link>
  );
}
