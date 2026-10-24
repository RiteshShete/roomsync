import { copy } from '@/copy';
import { TabbedHeader } from '@/features/shell/TabbedHeader';

const TABS = [
  { to: '/expenses', label: copy.expenses.title, end: true },
  { to: '/expenses/balances', label: copy.balances.title },
  { to: '/expenses/settlements', label: copy.settlements.title },
];

export function MoneyHeader() {
  return <TabbedHeader title={copy.expenses.title} tabs={TABS} />;
}
