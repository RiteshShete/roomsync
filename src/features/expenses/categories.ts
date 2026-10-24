import { copy } from '@/copy';

export const CATEGORY_OPTIONS = Object.entries(copy.categories).map(([value, label]) => ({ value, label }));

/** Display name for a stored category (unknown/legacy values are capitalised rather than hidden). */
export function categoryLabel(value: string): string {
  return copy.categories[value] ?? value.charAt(0).toUpperCase() + value.slice(1);
}
