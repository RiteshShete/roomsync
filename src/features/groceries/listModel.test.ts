import { describe, expect, it } from 'vitest';
import type { GroceryItem } from '@/api/groceries';
import { arrange, groupByCategory, quantityText, shareListText } from './listModel';

const item = (o: Partial<GroceryItem>): GroceryItem => ({ id: 'x', name: 'Item', quantity: null, unit: null, category: null, note: null, status: 'needed', version: 1, addedByMemberId: 'm', purchasedByMemberId: null, purchasedAt: null, ...o }) as GroceryItem;
const items = [item({ id: '1', name: 'tomatoes', category: 'Fruits and Veggies', quantity: 2, unit: 'kg' }), item({ id: '2', name: 'Milk', category: 'Dairy' }), item({ id: '3', name: 'Apples', category: 'Fruits and Veggies' }), item({ id: '4', name: 'Soap' })];

describe('grocery list model', () => {
  it('formats quantities', () => {
    expect(quantityText(items[0]!)).toBe('2 kg');
    expect(quantityText(item({ quantity: 3 }))).toBe('3');
    expect(quantityText(items[1]!)).toBe('');
  });
  it('filters by category (uncategorised counts as Other) and sorts', () => {
    expect(arrange(items, 'Dairy', 'recent').map((i) => i.id)).toEqual(['2']);
    expect(arrange(items, 'Other', 'recent').map((i) => i.id)).toEqual(['4']);
    expect(arrange(items, '', 'name').map((i) => i.name)).toEqual(['Apples', 'Milk', 'Soap', 'tomatoes']);
    expect(arrange(items, '', 'recent').map((i) => i.id)).toEqual(['1', '2', '3', '4']);
  });
  it('groups in first-seen order', () => {
    expect(groupByCategory(items).map(([c, r]) => [c, r.length])).toEqual([['Fruits and Veggies', 2], ['Dairy', 1], ['Other', 1]]);
  });
  it('writes a shareable list', () => {
    expect(shareListText('Shopping list', items)).toBe('Shopping list\nFruits and Veggies:\n- tomatoes (2 kg)\n- Apples\nDairy:\n- Milk\nOther:\n- Soap');
  });
});
