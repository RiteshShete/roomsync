import type { ReactNode } from 'react';
import { copy } from '@/copy';
import { BrandMark } from '@/ui';

/** Shared frame for logged-out screens: brand mark, title, soft coral glow behind the content. */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="hero-glow min-h-dvh">
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-5 pt-[calc(2rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3">
          <BrandMark size={44} />
          <span className="text-2xl font-bold text-coral">{copy.brand.name}</span>
        </div>
        <div>
          <h1 className="text-3xl font-bold text-ink">{title}</h1>
          {subtitle ? <p className="mt-1 text-base text-ink2">{subtitle}</p> : null}
        </div>
        {children}
      </main>
    </div>
  );
}

/** Inline error summary for a failed submit. Announced to assistive tech; inputs are never cleared. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl border border-danger bg-danger-soft px-4 py-3 text-sm font-semibold text-ink">
      {message}
    </p>
  );
}

/** Confirmation panel (check your email, reset link sent). */
export function Notice({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <section role="status" className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      <p className="text-base text-ink2">{body}</p>
      {children}
    </section>
  );
}

const ART = { welcome: 'illustrations/welcome.png', create: 'illustrations/create.png', join: 'illustrations/join.png' } as const;

/**
 * Onboarding layout from the welcome/set-up/join mockups: coral glow, a flat illustration, a centred
 * bold title and grey supporting line, then pill buttons. The illustration is decorative.
 */
export function HeroLayout({
  art,
  title,
  subtitle,
  children,
}: {
  art: keyof typeof ART;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="hero-glow-low min-h-dvh">
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <div className="-mx-5 flex flex-1 items-center justify-center">
          <img src={`${import.meta.env.BASE_URL}${ART[art]}`} alt="" className="w-full max-w-md select-none" draggable={false} />
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-[2rem] leading-tight font-bold text-ink">{title}</h1>
          {subtitle ? <p className="max-w-xs text-base text-ink2">{subtitle}</p> : null}
        </div>
        <div className="mt-6 flex flex-col gap-3">{children}</div>
      </main>
    </div>
  );
}
