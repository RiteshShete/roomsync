import { Navigate, Outlet } from 'react-router-dom';
import { SkeletonList } from '@/ui';
import { useSession } from './Session';

function FullScreenLoading() {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-md pt-10">
      <SkeletonList rows={4} />
    </div>
  );
}

/** Logged-in users only; everyone else goes to the welcome screen. */
export function RequireAuth() {
  const session = useSession();
  if (session.status === 'loading') return <FullScreenLoading />;
  if (session.status === 'signedOut') return <Navigate to="/welcome" replace />;
  return <Outlet />;
}

/** Logged-out screens (welcome, sign up, log in). Signed-in users are sent into the app. */
export function PublicOnly() {
  const session = useSession();
  if (session.status === 'loading') return <FullScreenLoading />;
  if (session.status === 'signedIn' && !session.recovery) return <Navigate to="/" replace />;
  if (session.status === 'signedIn' && session.recovery) return <Navigate to="/reset-password" replace />;
  return <Outlet />;
}
