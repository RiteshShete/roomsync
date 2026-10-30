import { NavLink } from 'react-router-dom';
// ?no-inline: the icons are used as CSS masks, which need real files (small SVGs would otherwise be inlined as data URIs).
import financeIcon from '@/assets/nav/finance.svg?no-inline';
import homeIcon from '@/assets/nav/home.svg?no-inline';
import settingsIcon from '@/assets/nav/settings.svg?no-inline';
import shoppingIcon from '@/assets/nav/shopping.svg?no-inline';
import tasksIcon from '@/assets/nav/tasks.svg?no-inline';
import { copy } from '@/copy';

const NAV_ITEMS: { to: string; label: string; icon: string; end?: boolean }[] = [
  { to: '/', label: copy.nav.home, icon: homeIcon, end: true },
  { to: '/house/groceries', label: copy.nav.shopping, icon: shoppingIcon },
  { to: '/chores', label: copy.nav.tasks, icon: tasksIcon },
  { to: '/expenses', label: copy.nav.finance, icon: financeIcon },
  { to: '/you', label: copy.nav.settings, icon: settingsIcon },
];

/**
 * The five-tab bar from the design: white, a soft upward shadow, 30px icons over 14px labels. The
 * icons are the design's own artwork, painted through a mask so the current tab can be coral and the
 * rest the muted tone without changing the shapes. It is fixed to the bottom with safe-area padding and
 * pages reserve matching space. The current tab is exposed with aria-current and a bold label (not
 * colour alone). Label text uses the deeper coral so it meets AA contrast on white.
 */
export function BottomNav() {
  return (
    <nav aria-label={copy.nav.label} className="fixed inset-x-0 bottom-0 z-40 bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_10px_rgba(140,76,5,0.06)]">
      {/* At very large text sizes the tabs keep their full labels and the bar scrolls sideways, instead of widening the page. */}
      <ul className="mx-auto flex min-h-[81px] max-w-md items-center justify-between gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {NAV_ITEMS.map((item) => (
          <li key={item.to} className="min-w-fit">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) => `flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-sm tracking-[-0.02em] ${isActive ? 'font-bold text-coral' : 'font-normal text-ink2'}`}
            >
              {({ isActive }) => (
                <>
                  <span
                    aria-hidden="true"
                    className="block h-[30px] w-[30px] bg-current"
                    style={{
                      color: isActive ? 'var(--primary)' : 'var(--nav-idle)',
                      WebkitMaskImage: `url(${item.icon})`,
                      maskImage: `url(${item.icon})`,
                      WebkitMaskRepeat: 'no-repeat',
                      maskRepeat: 'no-repeat',
                      WebkitMaskPosition: 'center',
                      maskPosition: 'center',
                      WebkitMaskSize: 'contain',
                      maskSize: 'contain',
                    }}
                  />
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
