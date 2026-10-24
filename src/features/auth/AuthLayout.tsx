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
          <span className="text-2xl font-extrabold text-primary">{copy.brand.name}</span>
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-ink">{title}</h1>
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
    <p role="alert" className="rounded-2xl border-2 border-danger bg-danger-soft px-4 py-3 text-sm font-semibold text-ink">
      {message}
    </p>
  );
}

/** Confirmation panel (check your email, reset link sent). */
export function Notice({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <section role="status" className="flex flex-col gap-3 rounded-3xl border-2 border-line bg-surface p-5">
      <h2 className="text-lg font-extrabold text-ink">{title}</h2>
      <p className="text-base text-ink2">{body}</p>
      {children}
    </section>
  );
}
