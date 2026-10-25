import { NavLink } from 'react-router-dom';
import { useBell } from '@/features/activity/hooks';
import { Header, HeaderTabs } from '@/ui';

export interface TabSpec {
  to: string;
  label: string;
  end?: boolean;
}

/** Shell header with the notifications bell and an underlined tab strip, as in the mockups. */
export function TabbedHeader({ title, tabs }: { title: string; tabs: TabSpec[] }) {
  const bell = useBell();
  return (
    <Header title={title} bell={bell}>
      <HeaderTabs label={title}>
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `inline-flex min-h-11 items-center border-b-2 pb-0.5 text-sm whitespace-nowrap min-[360px]:text-base ${isActive ? 'border-primary font-bold text-coral' : 'border-transparent font-normal text-ink'}`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </HeaderTabs>
    </Header>
  );
}
