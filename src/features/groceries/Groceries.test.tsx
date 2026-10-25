import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/api/groceries';
import { copy } from '@/copy';
import { grocery, mockHome } from '@/test/home';
import { membership, renderApp } from '@/test/render';

vi.mock('@/api/households');
vi.mock('@/api/invites');
vi.mock('@/api/profile');
vi.mock('@/api/auth');
vi.mock('@/api/chores');
vi.mock('@/api/groceries');

beforeEach(() => {
  vi.resetAllMocks();
  mockHome();
});

const milk = grocery({ id: 'g1', name: 'Milk', quantity: 2, unit: 'l', category: 'Dairy', version: 4 });
const bread = grocery({ id: 'g2', name: 'Bread', quantity: null, unit: null, category: 'Bakery' });
const eggs = grocery({ id: 'g3', name: 'Eggs', category: 'Dairy', status: 'purchased', purchasedByMemberId: 'm-kunal', purchasedAt: '2026-05-02T10:00:00Z' });

describe('grocery list', () => {
  it('groups Needed by category, shows progress, and switches to Purchased', async () => {
    mockHome({ items: [milk, bread, eggs] });
    renderApp('/house/groceries');
    expect(await screen.findByText('Milk')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Dairy' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Bakery' })).toBeInTheDocument();
    expect(screen.getByText(copy.groceries.progressOf(1, 3))).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '33');
    expect(screen.queryByText('Eggs')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /Purchased/ }));
    expect(await screen.findByText('Eggs')).toBeInTheDocument();
    expect(screen.getByText(/bought by Kunal/)).toBeInTheDocument();
    expect(screen.queryByText('Milk')).not.toBeInTheDocument();
  });

  it('empty state offers to add', async () => {
    renderApp('/house/groceries');
    expect(await screen.findByText(copy.groceries.emptyTitle)).toBeInTheDocument();
    expect(screen.getByText(copy.groceries.emptyBody)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: copy.groceries.add }).length).toBeGreaterThan(0);
  });

  it('error state retries', async () => {
    vi.mocked(api.listGroceries).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderApp('/house/groceries');
    expect(await screen.findByText(copy.errors.network)).toBeInTheDocument();
    vi.mocked(api.listGroceries).mockResolvedValue([milk]);
    await userEvent.click(screen.getByRole('button', { name: copy.states.retry }));
    expect(await screen.findByText('Milk')).toBeInTheDocument();
  });

  it('ticking an item marks it purchased with its version and says so', async () => {
    mockHome({ items: [milk] });
    vi.mocked(api.markPurchased).mockResolvedValue(2);
    renderApp('/house/groceries');
    await userEvent.click(await screen.findByRole('checkbox', { name: copy.groceries.markPurchased('Milk') }));
    expect(api.markPurchased).toHaveBeenCalledWith('g1', 4, expect.any(String));
    expect(await screen.findByText(copy.groceries.purchasedToast('Milk'))).toBeInTheDocument();
  });

  it('unticking a purchased item moves it back', async () => {
    mockHome({ items: [eggs] });
    vi.mocked(api.moveBackToNeeded).mockResolvedValue(2);
    renderApp('/house/groceries');
    await userEvent.click(await screen.findByRole('tab', { name: /Purchased/ }));
    await userEvent.click(await screen.findByRole('checkbox', { name: copy.groceries.moveBack('Eggs') }));
    expect(api.moveBackToNeeded).toHaveBeenCalledWith('g3', 1);
    expect(await screen.findByText(copy.groceries.movedBackToast('Eggs'))).toBeInTheDocument();
  });

  it('a concurrent purchase (conflict) refreshes the list and explains', async () => {
    mockHome({ items: [milk] });
    vi.mocked(api.markPurchased).mockRejectedValue({ message: 'conflict' });
    renderApp('/house/groceries');
    await userEvent.click(await screen.findByRole('checkbox', { name: copy.groceries.markPurchased('Milk') }));
    expect(await screen.findByText(copy.groceries.conflict)).toBeInTheDocument();
    await vi.waitFor(() => expect(vi.mocked(api.listGroceries).mock.calls.length).toBeGreaterThan(1));
  });

  it('archived household blocks ticking, with the reason', async () => {
    mockHome({ me: membership({ archived: true }), items: [milk] });
    renderApp('/house/groceries');
    const box = await screen.findByRole('checkbox', { name: copy.groceries.markPurchased('Milk') });
    expect(box).toHaveAttribute('title', copy.errors.householdArchived);
    await userEvent.click(box);
    expect(api.markPurchased).not.toHaveBeenCalled();
  });
});

describe('add / edit sheet', () => {
  it('adds an item and closes', async () => {
    mockHome({ items: [milk] });
    vi.mocked(api.addGrocery).mockResolvedValue("new");
    renderApp('/house/groceries');
    await userEvent.click((await screen.findAllByRole('button', { name: copy.groceries.add }))[0]!);
    const save = await screen.findByRole('button', { name: copy.groceries.save });
    expect(save).toHaveAttribute('aria-disabled', 'true');
    expect(save).toHaveAccessibleDescription(copy.groceries.reasonName);
    await userEvent.type(screen.getByLabelText(new RegExp(copy.groceries.name)), 'Rice');
    await userEvent.type(screen.getByLabelText(new RegExp(copy.groceries.quantity)), '1.5');
    await userEvent.click(save);
    expect(api.addGrocery).toHaveBeenCalledWith(expect.any(String), expect.any(String), expect.objectContaining({ name: 'Rice', quantity: 1.5 }));
    expect(await screen.findByText(copy.groceries.added)).toBeInTheDocument();
  });

  it('a bad quantity blocks save with the reason', async () => {
    mockHome({ items: [milk] });
    renderApp('/house/groceries');
    await userEvent.click((await screen.findAllByRole('button', { name: copy.groceries.add }))[0]!);
    await userEvent.type(await screen.findByLabelText(new RegExp(copy.groceries.name)), 'Rice');
    await userEvent.type(screen.getByLabelText(new RegExp(copy.groceries.quantity)), 'two');
    expect(screen.getByRole('button', { name: copy.groceries.save })).toHaveAccessibleDescription(copy.groceries.reasonQuantity);
  });

  it('a failed save keeps the sheet and every field as typed', async () => {
    mockHome({ items: [milk] });
    vi.mocked(api.addGrocery).mockRejectedValue(new TypeError('Failed to fetch'));
    renderApp('/house/groceries');
    await userEvent.click((await screen.findAllByRole('button', { name: copy.groceries.add }))[0]!);
    await userEvent.type(await screen.findByLabelText(new RegExp(copy.groceries.name)), 'Rice');
    await userEvent.type(screen.getByLabelText(new RegExp(copy.groceries.note)), 'basmati');
    await userEvent.click(screen.getByRole('button', { name: copy.groceries.save }));
    expect(await screen.findByText(copy.errors.network)).toBeInTheDocument();
    expect(screen.getByLabelText(new RegExp(copy.groceries.name))).toHaveValue('Rice');
    expect(screen.getByLabelText(new RegExp(copy.groceries.note))).toHaveValue('basmati');
  });

  it('a duplicate name offers Update existing or Add anyway', async () => {
    mockHome({ items: [milk] });
    vi.mocked(api.updateGrocery).mockResolvedValue(2);
    vi.mocked(api.addGrocery).mockResolvedValue("new");
    renderApp('/house/groceries');
    await userEvent.click((await screen.findAllByRole('button', { name: copy.groceries.add }))[0]!);
    await userEvent.type(await screen.findByLabelText(new RegExp(copy.groceries.name)), '  milk ');
    await userEvent.type(screen.getByLabelText(new RegExp(copy.groceries.quantity)), '3');
    await userEvent.click(screen.getByRole('button', { name: copy.groceries.save }));
    const group = await screen.findByRole('group', { name: copy.groceries.duplicateTitle });
    expect(within(group).getByText(/Milk \(2 l\) is already on the list/)).toBeInTheDocument();
    expect(api.addGrocery).not.toHaveBeenCalled();
    await userEvent.click(within(group).getByRole('button', { name: copy.groceries.updateExisting }));
    expect(api.updateGrocery).toHaveBeenCalledWith('g1', 4, expect.objectContaining({ name: 'Milk', quantity: 3 }));
    expect(api.addGrocery).not.toHaveBeenCalled();
  });

  it('Add anyway creates a second item', async () => {
    mockHome({ items: [milk] });
    vi.mocked(api.addGrocery).mockResolvedValue("new");
    renderApp('/house/groceries');
    await userEvent.click((await screen.findAllByRole('button', { name: copy.groceries.add }))[0]!);
    await userEvent.type(await screen.findByLabelText(new RegExp(copy.groceries.name)), 'Milk');
    await userEvent.click(screen.getByRole('button', { name: copy.groceries.save }));
    await userEvent.click(await screen.findByRole('button', { name: copy.groceries.addAnyway }));
    expect(api.addGrocery).toHaveBeenCalledTimes(1);
  });

  it('edit saves with the item version; delete is soft and offers Undo', async () => {
    mockHome({ items: [milk] });
    vi.mocked(api.updateGrocery).mockResolvedValue(2);
    vi.mocked(api.deleteGrocery).mockResolvedValue(2);
    vi.mocked(api.restoreGrocery).mockResolvedValue();
    renderApp('/house/groceries');
    await userEvent.click(await screen.findByRole('button', { name: copy.groceries.edit('Milk') }));
    const name = await screen.findByLabelText(new RegExp(copy.groceries.name));
    expect(name).toHaveValue('Milk');
    await userEvent.clear(name);
    await userEvent.type(name, 'Oat milk');
    await userEvent.click(screen.getByRole('button', { name: copy.groceries.save }));
    expect(api.updateGrocery).toHaveBeenCalledWith('g1', 4, expect.objectContaining({ name: 'Oat milk' }));

    await userEvent.click(await screen.findByRole('button', { name: copy.groceries.edit('Milk') }));
    await userEvent.click(await screen.findByRole('button', { name: copy.groceries.delete }));
    expect(api.deleteGrocery).toHaveBeenCalledWith('g1', 4);
    await userEvent.click(await screen.findByRole('button', { name: copy.groceries.undo }));
    expect(api.restoreGrocery).toHaveBeenCalledWith('g1');
    expect(await screen.findByText(copy.groceries.restored('Milk'))).toBeInTheDocument();
  });

  it('editing a purchased item can move it back', async () => {
    mockHome({ items: [eggs] });
    vi.mocked(api.moveBackToNeeded).mockResolvedValue(2);
    renderApp('/house/groceries');
    await userEvent.click(await screen.findByRole('tab', { name: /Purchased/ }));
    await userEvent.click(await screen.findByRole('button', { name: copy.groceries.edit('Eggs') }));
    await userEvent.click(await screen.findByRole('button', { name: copy.groceries.moveBack('Eggs') }));
    expect(api.moveBackToNeeded).toHaveBeenCalledWith('g3', 1);
  });
});
