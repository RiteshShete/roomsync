import type { GroceryItem } from '@/api/groceries';
import { copy } from '@/copy';

export type GrocerySort = 'recent' | 'name';

/** Item quantity as shown beside the name: "2 kg", "3", or nothing. */
export const quantityText = (i: Pick<GroceryItem, 'quantity' | 'unit'>): string => (i.quantity === null ? '' : `${i.quantity}${i.unit ? ` ${i.unit}` : ''}`);

export const categoryOf = (i: Pick<GroceryItem, 'category'>): string => i.category ?? copy.groceries.uncategorised;

/** Narrow to one category (or all), then order. "recent" keeps the server's newest-first order. */
export function arrange(items: GroceryItem[], category: string, sort: GrocerySort): GroceryItem[] {
  const kept = category === '' ? items : items.filter((i) => categoryOf(i) === category);
  return sort === 'name' ? [...kept].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })) : kept;
}

/** Items grouped by category in first-seen order. */
export function groupByCategory(items: GroceryItem[]): [string, GroceryItem[]][] {
  const groups = new Map<string, GroceryItem[]>();
  for (const i of items) groups.set(categoryOf(i), [...(groups.get(categoryOf(i)) ?? []), i]);
  return [...groups.entries()];
}

/** A plain-text copy of what is still to buy, for sharing: one line per item, grouped by category. */
export function shareListText(title: string, needed: GroceryItem[]): string {
  const lines = groupByCategory(needed).flatMap(([cat, rows]) => [`${cat}:`, ...rows.map((i) => `- ${i.name}${quantityText(i) ? ` (${quantityText(i)})` : ''}`)]);
  return [title, ...lines].join('\n');
}
