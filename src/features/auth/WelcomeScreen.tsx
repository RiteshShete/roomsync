import { Link } from 'react-router-dom';
import { copy } from '@/copy';
import { BrandMark } from '@/ui';

const LINK_BASE =
  'inline-flex min-h-12 w-full items-center justify-center rounded-[var(--radius-control)] border-2 px-5 text-base font-extrabold';

/** Spec §8.1: concise welcome, one primary and one secondary action, no carousel. */
export function WelcomeScreen() {
  return (
    <div className="hero-glow min-h-dvh">
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-between px-5 pt-[calc(2.5rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3">
          <BrandMark size={48} />
          <span className="text-2xl font-extrabold text-primary">{copy.brand.name}</span>
        </div>

        <div className="flex flex-1 flex-col justify-end gap-3 pb-8">
          <h1 className="text-4xl leading-tight font-extrabold text-ink">{copy.welcome.headline}</h1>
          <p className="text-lg text-ink2">{copy.welcome.support}</p>
        </div>

        <div className="flex flex-col gap-3">
          <Link to="/signup" className={`${LINK_BASE} border-transparent bg-amber text-on-amber hover:bg-amber-pressed`}>
            {copy.welcome.getStarted}
          </Link>
          <Link to="/signup?invite=1" className={`${LINK_BASE} border-amber bg-surface text-ink hover:bg-tint`}>
            {copy.welcome.haveInvite}
          </Link>
          <Link to="/login" className="mt-1 inline-flex min-h-11 items-center justify-center text-base font-bold text-primary underline-offset-4 hover:underline">
            {copy.welcome.haveAccount}
          </Link>
        </div>
      </main>
    </div>
  );
}
