import { NavLink } from 'react-router-dom';
import { copy } from '@/copy';
import { Header, HeaderTabs } from '@/ui';

const TABS = [
  { to: '/expenses', label: copy.expenses.title, end: true },
  { to: '/expenses/balances', label: copy.balances.title },
  { to: '/expenses/settlements', label: copy.settlements.title },
];

/** Expenses tab header: title, the (not yet available) bell, and underlined tabs as in the mockups. */
export function MoneyHeader() {
  return (
    <Header title={copy.expenses.title} bell={{ disabledReason: copy.header.notificationsUnavailable }}>
      <HeaderTabs label={copy.expenses.title}>
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `inline-flex min-h-11 items-center border-b-2 pb-0.5 text-base whitespace-nowrap ${isActive ? 'border-primary font-bold text-coral' : 'border-transparent font-normal text-ink'}`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </HeaderTabs>
    </Header>
  );
}
