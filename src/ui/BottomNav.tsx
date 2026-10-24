import { NavLink } from 'react-router-dom';
import { copy } from '@/copy';
import { Icon, type IconName } from './Icon';

export const NAV_ITEMS: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: copy.nav.home, icon: 'home', end: true },
  { to: '/expenses', label: copy.nav.expenses, icon: 'wallet' },
  { to: '/chores', label: copy.nav.chores, icon: 'checklist' },
  { to: '/house', label: copy.nav.house, icon: 'house' },
  { to: '/you', label: copy.nav.you, icon: 'user' },
];

/**
 * Five-tab bottom navigation, as in the mockups: white bar, muted icons, the current tab in coral.
 * It is fixed to the bottom with safe-area padding; pages reserve matching space so it never covers
 * content. The current tab is exposed with aria-current and a bold label (not colour alone).
 */
export function BottomNav() {
  return (
    <nav
      aria-label={copy.nav.label}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-md">
        {NAV_ITEMS.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-xs',
                  isActive ? 'font-bold text-coral' : 'font-normal text-ink2',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`flex h-7 w-12 items-center justify-center ${isActive ? 'text-primary' : 'text-nav-idle'}`}>
                    <Icon name={item.icon} size={26} strokeWidth={2.2} />
                  </span>
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
