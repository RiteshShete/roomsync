import { Link } from 'react-router-dom';
import { copy } from '@/copy';
import { PillLink } from '@/ui';
import { HeroLayout } from './AuthLayout';

/**
 * Spec §8.1: concise welcome with one primary and one secondary action and no carousel. Laid out
 * like the welcome mockup (illustration, centred bold headline, amber pill button).
 */
export function WelcomeScreen() {
  return (
    <HeroLayout art="welcome" title={copy.welcome.headline} subtitle={copy.welcome.support}>
      <PillLink to="/signup" variant="amber">
        {copy.welcome.getStarted}
      </PillLink>
      <PillLink to="/signup?invite=1" variant="outline">
        {copy.welcome.haveInvite}
      </PillLink>
      <Link to="/login" className="inline-flex min-h-11 items-center justify-center text-base font-semibold text-coral underline-offset-4 hover:underline">
        {copy.welcome.haveAccount}
      </Link>
    </HeroLayout>
  );
}
