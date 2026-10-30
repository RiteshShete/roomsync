import { copy } from '@/copy';
import { NOTIFICATION_CATEGORIES, type NotificationCategory } from '@/domain';
import { MenuButton } from '@/ui';

export type ActivityFilterValue = 'all' | NotificationCategory;

/** The design's "Filter" menu: All, then only the categories that actually have events. */
export function ActivityFilter({ present, value, onChange }: { present: NotificationCategory[]; value: ActivityFilterValue; onChange: (v: ActivityFilterValue) => void }) {
  const options = [
    { value: 'all' as const, label: copy.activity.all },
    ...NOTIFICATION_CATEGORIES.filter((c) => present.includes(c)).map((c) => ({
      value: c,
      label: copy.activity.categories[c]!,
    })),
  ];
  return <MenuButton label={copy.activity.filter} options={options} value={value} onChange={onChange} />;
}
