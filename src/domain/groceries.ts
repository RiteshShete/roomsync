/** Lower-case, trimmed, single-spaced: "  Whole  MILK " and "whole milk" are the same item. */
export function normalizeItemName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

/**
 * Finds an item on the Needed list with the same (normalised) name, so the UI can offer
 * "Update existing" or "Add anyway" instead of silently creating a duplicate.
 * `excludeId` lets an item being edited ignore itself.
 */
export function findDuplicate<T extends { id: string; name: string }>(needed: readonly T[], name: string, excludeId?: string): T | undefined {
  const target = normalizeItemName(name);
  if (target === '') return undefined;
  return needed.find((i) => i.id !== excludeId && normalizeItemName(i.name) === target);
}
