import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as expensesApi from '@/api/expenses';
import * as settlementsApi from '@/api/settlements';
import { copy } from '@/copy';
import { BALANCES, expense, mockMoney, settlement } from '@/test/money';
import { membership, renderApp } from '@/test/render';
import { todayIso } from './formModel';

vi.mock('@/api/households');
vi.mock('@/api/invites');
vi.mock('@/api/profile');
vi.mock('@/api/auth');
vi.mock('@/api/expenses');
vi.mock('@/api/settlements');

beforeEach(() => {
  vi.resetAllMocks();
  mockMoney();
});

describe('balances', () => {
  it('lists everyone’s balance in words (not colour alone)', async () => {
    renderApp('/expenses/balances');
    expect(await screen.findAllByText(copy.balances.isOwed('₹400.00'), { selector: 'p' })).toHaveLength(2); // Aarav and Riya
    expect(screen.getByText(copy.balances.owes('₹800.00'))).toBeInTheDocument();
  });

  it('hides a departed member with nothing owed, but keeps one with an unresolved balance, marked', async () => {
    const kunalLeft = { memberId: 'm-kunal', netMinor: -5000 };
    mockMoney({ balances: [{ memberId: 'm-aarav', netMinor: 5000 }, kunalLeft] });
    const { listAllMembers } = await import('@/api/households');
    vi.mocked(listAllMembers).mockResolvedValue([
      { memberId: 'm-aarav', userId: 'u-aarav', role: 'owner', status: 'active', displayName: 'Aarav', avatarColor: '#4F46E5', joinedAt: '', moveOutEffectiveDate: null },
      { memberId: 'm-kunal', userId: 'u-kunal', role: 'member', status: 'left', displayName: 'Kunal', avatarColor: '#B45309', joinedAt: '', moveOutEffectiveDate: null },
    ]);
    renderApp('/expenses/balances');
    expect(await screen.findByText(copy.balances.owes('₹50.00'))).toBeInTheDocument();
    expect(screen.getByText(copy.expenseForm.leftChip)).toBeInTheDocument();
  });

  it('suggestions are labelled “Suggestion”, explain that nothing happens automatically, and link to a pre-filled record form', async () => {
    renderApp('/expenses/balances');
    expect(await screen.findByText(copy.balances.suggestionNote)).toBeInTheDocument();
    expect(screen.getAllByText(copy.balances.suggestionTag)).toHaveLength(2);
    expect(screen.getByText(copy.balances.suggestionLine('Kunal', 'Aarav', '₹400.00'))).toBeInTheDocument();
    expect(screen.getByText(copy.balances.suggestionLine('Kunal', 'Riya', '₹400.00'))).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: copy.balances.recordThis });
    expect(links[0]).toHaveAttribute('href', '/expenses/settle?from=m-kunal&to=m-aarav&amount=40000');
  });

  it('says everyone is settled when there is nothing to suggest', async () => {
    mockMoney({ balances: [{ memberId: 'm-aarav', netMinor: 0 }, { memberId: 'm-riya', netMinor: 0 }] });
    renderApp('/expenses/balances');
    expect(await screen.findByText(copy.balances.noSuggestions)).toBeInTheDocument();
  });

  it('a plain member can only record payments they are part of; others are disabled with the reason', async () => {
    mockMoney({ me: membership({ role: 'member', memberId: 'm-riya' }) });
    renderApp('/expenses/balances');
    await screen.findByText(copy.balances.suggestionNote);
    expect(screen.getAllByRole('link', { name: copy.balances.recordThis })).toHaveLength(1); // Kunal → Riya
    const blocked = screen.getByRole('button', { name: copy.balances.recordThis });
    expect(blocked).toHaveAttribute('aria-disabled', 'true');
    expect(blocked).toHaveAccessibleDescription(copy.settle.memberOnly);
  });

  it('archived household: recording is disabled with the reason', async () => {
    mockMoney({ me: membership({ archived: true }) });
    renderApp('/expenses/balances');
    await screen.findByText(copy.balances.suggestionNote);
    for (const b of screen.getAllByRole('button', { name: copy.balances.recordThis })) {
      expect(b).toHaveAttribute('aria-disabled', 'true');
      expect(b).toHaveAccessibleDescription(copy.errors.householdArchived);
    }
  });

  it('“Why am I owed this?” lists every line and they add up exactly to the balance', async () => {
    vi.mocked(expensesApi.getBalanceInputs).mockResolvedValue({
      expenses: [
        { id: 'e1', title: 'Rent', amountMinor: 90000, paidBy: 'm-aarav', shares: [{ memberId: 'm-aarav', amountMinor: 30000 }] },
        { id: 'e2', title: 'Wi-Fi', amountMinor: 10000, paidBy: 'm-riya', shares: [{ memberId: 'm-aarav', amountMinor: 5000 }] },
      ],
      settlements: [{ id: 's1', from: 'm-kunal', to: 'm-aarav', amountMinor: 15000, status: 'recorded' }],
      truncated: false,
    });
    mockMoney({ balances: [{ memberId: 'm-aarav', netMinor: 40000 }, { memberId: 'm-riya', netMinor: 0 }, { memberId: 'm-kunal', netMinor: -40000 }] });
    vi.mocked(expensesApi.getBalanceInputs).mockResolvedValue({
      expenses: [
        { id: 'e1', title: 'Rent', amountMinor: 90000, paidBy: 'm-aarav', shares: [{ memberId: 'm-aarav', amountMinor: 30000 }] },
        { id: 'e2', title: 'Wi-Fi', amountMinor: 10000, paidBy: 'm-riya', shares: [{ memberId: 'm-aarav', amountMinor: 5000 }] },
      ],
      settlements: [{ id: 's1', from: 'm-kunal', to: 'm-aarav', amountMinor: 15000, status: 'recorded' }],
      truncated: false,
    });
    renderApp('/expenses/balances');
    const toggle = await screen.findByRole('button', { name: copy.balances.whyOwed });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const body = within(document.getElementById('why-body')!);
    expect(await body.findByText(copy.balances.paidFor('Rent'))).toBeInTheDocument();
    expect(body.getByText('+₹900.00')).toBeInTheDocument();
    expect(body.getByText(copy.balances.shareOf('Rent'))).toBeInTheDocument();
    expect(body.getByText('−₹300.00')).toBeInTheDocument();
    expect(body.getByText(copy.balances.shareOf('Wi-Fi'))).toBeInTheDocument();
    expect(body.getByText(copy.balances.paidYouSettlement('Kunal'))).toBeInTheDocument();
    expect(body.getByText('−₹150.00')).toBeInTheDocument();
    // 900 - 300 - 50 - 150 = 400, the displayed balance
    expect(body.getByTestId('why-total')).toHaveTextContent('+₹400.00');
    expect(body.queryByText(copy.balances.mismatch)).not.toBeInTheDocument();
  });

  it('uses “Why do I owe this?” for a debtor', async () => {
    mockMoney({ balances: [{ memberId: 'm-aarav', netMinor: -1000 }, { memberId: 'm-riya', netMinor: 1000 }] });
    renderApp('/expenses/balances');
    expect(await screen.findByRole('button', { name: copy.balances.whyOwe })).toBeInTheDocument();
  });

  it('warns instead of silently showing a breakdown that does not add up', async () => {
    mockMoney();
    vi.mocked(expensesApi.getBalanceInputs).mockResolvedValue({ expenses: [{ id: 'e1', title: 'Rent', amountMinor: 100, paidBy: 'm-aarav', shares: [] }], settlements: [], truncated: true });
    renderApp('/expenses/balances');
    await userEvent.click(await screen.findByRole('button', { name: copy.balances.whyOwed }));
    expect(await screen.findByText(copy.balances.mismatch)).toBeInTheDocument();
  });

  it('mentions disputed settlements that are not counted, with a link', async () => {
    mockMoney({ settlements: [settlement({ status: 'disputed', statusReason: 'not received' })] });
    renderApp('/expenses/balances');
    expect(await screen.findByText(copy.balances.disputed(1), { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: copy.balances.seeSettlements })).toHaveAttribute('href', '/expenses/settlements');
  });

  it('shows an error with retry when balances cannot load', async () => {
    vi.mocked(expensesApi.getBalances).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderApp('/expenses/balances');
    expect(await screen.findByText(copy.errors.network)).toBeInTheDocument();
    vi.mocked(expensesApi.getBalances).mockResolvedValue(BALANCES);
    await userEvent.click(screen.getByRole('button', { name: copy.states.retry }));
    expect(await screen.findByText(copy.balances.suggestionNote)).toBeInTheDocument();
  });
});

describe('record settlement (Journey D)', () => {
  const url = '/expenses/settle?from=m-kunal&to=m-aarav&amount=30000';
  const review = () => screen.getByRole('button', { name: copy.settle.review });

  it('pre-fills from a suggestion', async () => {
    renderApp(url);
    expect(await screen.findByLabelText(copy.settle.from)).toHaveValue('m-kunal');
    expect(screen.getByLabelText(copy.settle.to)).toHaveValue('m-aarav');
    expect(screen.getByLabelText(/^Amount/)).toHaveValue('300.00');
    expect(screen.getByLabelText(copy.settle.date)).toHaveValue(todayIso());
    expect(screen.getByLabelText(copy.settle.date)).toHaveAttribute('max', todayIso());
  });

  it('the form says it only records a payment made elsewhere', async () => {
    renderApp(url);
    expect(await screen.findByText(copy.settle.disclaimer)).toBeInTheDocument();
  });

  it('blocks review until it is valid, with the reason', async () => {
    renderApp('/expenses/settle');
    await screen.findByLabelText(copy.settle.from);
    expect(review()).toHaveAttribute('aria-disabled', 'true');
    expect(review()).toHaveAccessibleDescription(copy.settle.choose);
    await userEvent.selectOptions(screen.getByLabelText(copy.settle.from), 'm-kunal');
    await userEvent.selectOptions(screen.getByLabelText(copy.settle.to), 'm-kunal');
    expect(review()).toHaveAccessibleDescription(copy.settle.sameMember);
    await userEvent.selectOptions(screen.getByLabelText(copy.settle.to), 'm-aarav');
    expect(review()).toHaveAccessibleDescription(copy.settle.amountRequired);
    await userEvent.type(screen.getByLabelText(/^Amount/), '100');
    expect(review()).not.toHaveAttribute('aria-disabled');
  });

  it('refuses a future date', async () => {
    renderApp(url);
    const date = await screen.findByLabelText(copy.settle.date);
    await userEvent.clear(date);
    await userEvent.type(date, '2999-01-01');
    expect(review()).toHaveAccessibleDescription(copy.settle.futureDate);
  });

  it('a plain member can only record payments they made or received', async () => {
    mockMoney({ me: membership({ role: 'member', memberId: 'm-riya' }) });
    renderApp(url); // Kunal → Aarav: Riya is not part of it
    await screen.findByLabelText(copy.settle.from);
    expect(review()).toHaveAttribute('aria-disabled', 'true');
    expect(review()).toHaveAccessibleDescription(copy.settle.memberOnly);
    await userEvent.selectOptions(screen.getByLabelText(copy.settle.to), 'm-riya');
    expect(review()).not.toHaveAttribute('aria-disabled');
  });

  it('review states that RoomSync moves no money, and does not claim a payment was sent', async () => {
    renderApp(url);
    await userEvent.click(await screen.findByRole('button', { name: copy.settle.review }));
    expect(screen.getByRole('heading', { level: 1, name: copy.settle.reviewTitle })).toBeInTheDocument();
    expect(screen.getByText(copy.settle.summary('Kunal', 'Aarav'))).toBeInTheDocument();
    expect(screen.getByText('₹300.00')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('This records a payment made outside RoomSync. RoomSync does not move money.');
    expect(document.body.textContent).not.toMatch(/payment sent|sent to|paid via roomsync/i);
  });

  it('warns when the amount is more than the payer currently owes, but does not block', async () => {
    renderApp('/expenses/settle?from=m-kunal&to=m-aarav&amount=90000'); // Kunal owes ₹800
    await userEvent.click(await screen.findByRole('button', { name: copy.settle.review }));
    expect(screen.getByRole('status')).toHaveTextContent(copy.settle.exceeds('Kunal', '₹800.00'));
    expect(screen.getByRole('button', { name: copy.settle.confirm })).not.toHaveAttribute('aria-disabled');
  });

  it('no warning when the amount is within what is owed', async () => {
    renderApp(url);
    await userEvent.click(await screen.findByRole('button', { name: copy.settle.review }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('warns differently when the payer owes nothing', async () => {
    renderApp('/expenses/settle?from=m-aarav&to=m-kunal&amount=1000');
    await userEvent.click(await screen.findByRole('button', { name: copy.settle.review }));
    expect(screen.getByRole('status')).toHaveTextContent(copy.settle.exceedsNothing('Aarav'));
  });

  it('confirming records it and shows a receipt-like record', async () => {
    vi.mocked(settlementsApi.recordSettlement).mockResolvedValue('s-new');
    renderApp(url);
    await userEvent.type(await screen.findByLabelText(new RegExp(copy.settle.note)), 'UPI ref 123');
    await userEvent.click(screen.getByRole('button', { name: copy.settle.review }));
    await userEvent.click(screen.getByRole('button', { name: copy.settle.confirm }));
    expect(settlementsApi.recordSettlement).toHaveBeenCalledWith({
      householdId: 'h1',
      fromMemberId: 'm-kunal',
      toMemberId: 'm-aarav',
      amountMinor: 30000,
      settlementDate: todayIso(),
      note: 'UPI ref 123',
    });
    expect(await screen.findByRole('heading', { name: 'Settlement recorded' })).toBeInTheDocument();
    expect(screen.getByTestId('receipt-amount')).toHaveTextContent('₹300.00');
    expect(screen.getByText(copy.settle.receiptNote)).toBeInTheDocument();
    expect(screen.getByText(copy.settlements.note('UPI ref 123'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.settle.done })).toBeInTheDocument();
  });

  it('a failed record keeps every detail and says why (rule 6)', async () => {
    vi.mocked(settlementsApi.recordSettlement).mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue('s-new');
    renderApp(url);
    await userEvent.type(await screen.findByLabelText(new RegExp(copy.settle.note)), 'ref');
    await userEvent.click(screen.getByRole('button', { name: copy.settle.review }));
    await userEvent.click(screen.getByRole('button', { name: copy.settle.confirm }));
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.errors.network);
    await userEvent.click(screen.getByRole('button', { name: copy.settle.edit }));
    expect(screen.getByLabelText(/^Amount/)).toHaveValue('300.00');
    expect(screen.getByLabelText(new RegExp(copy.settle.note))).toHaveValue('ref');
    expect(screen.getByLabelText(copy.settle.from)).toHaveValue('m-kunal');
    await userEvent.click(screen.getByRole('button', { name: copy.settle.review }));
    await userEvent.click(screen.getByRole('button', { name: copy.settle.confirm }));
    expect(await screen.findByRole('heading', { name: 'Settlement recorded' })).toBeInTheDocument();
    expect(settlementsApi.recordSettlement).toHaveBeenCalledTimes(2);
  });

  it('“Record another” starts a fresh form', async () => {
    vi.mocked(settlementsApi.recordSettlement).mockResolvedValue('s-new');
    renderApp(url);
    await userEvent.click(await screen.findByRole('button', { name: copy.settle.review }));
    await userEvent.click(screen.getByRole('button', { name: copy.settle.confirm }));
    await userEvent.click(await screen.findByRole('button', { name: copy.settle.another }));
    expect(screen.getByLabelText(/^Amount/)).toHaveValue('');
  });

  it('archived household: review is disabled with the reason', async () => {
    mockMoney({ me: membership({ archived: true }) });
    renderApp(url);
    await screen.findByLabelText(copy.settle.from);
    expect(review()).toHaveAccessibleDescription(copy.errors.householdArchived);
  });
});

describe('settlements list: reverse, dispute, resolve', () => {
  const recordedByKunal = settlement({ id: 's-k', recordedBy: 'u-kunal' }); // Kunal → Aarav, recorded by Kunal
  const recordedByMe = settlement({ id: 's-me', fromMemberId: 'm-aarav', toMemberId: 'm-kunal', recordedBy: 'u-aarav', amountMinor: 1000 });
  const bystander = settlement({ id: 's-by', fromMemberId: 'm-riya', toMemberId: 'm-kunal', recordedBy: 'u-riya', amountMinor: 2000 });
  const disputed = settlement({ id: 's-d', status: 'disputed', statusReason: 'I never got this', statusChangedBy: 'u-aarav', recordedBy: 'u-kunal', amountMinor: 3000 });
  const reversed = settlement({ id: 's-r', status: 'reversed', amountMinor: 4000 });

  it('groups by status, with disputed in its own section and its explanation', async () => {
    mockMoney({ settlements: [recordedByKunal, disputed, reversed] });
    renderApp('/expenses/settlements');
    expect(await screen.findByRole('region', { name: copy.settlements.disputed })).toBeInTheDocument();
    expect(screen.getByText(copy.settlements.disputedNote)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: copy.settlements.recorded })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: copy.settlements.reversed })).toBeInTheDocument();
    const d = within(screen.getByRole('region', { name: copy.settlements.disputed }));
    expect(d.getByText('₹30.00')).toBeInTheDocument();
    expect(d.getByText(copy.settlements.reasonLine('I never got this'))).toBeInTheDocument();
    expect(d.getByText(copy.settlements.statuses.disputed!)).toBeInTheDocument();
  });

  it('empty state offers to record one', async () => {
    renderApp('/expenses/settlements');
    expect(await screen.findByText(copy.settlements.emptyTitle)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: copy.expenses.recordSettlement }).some((l) => l.getAttribute('href') === '/expenses/settle')).toBe(true);
  });

  it('an owner/admin can dispute or reverse any recorded settlement', async () => {
    mockMoney({ settlements: [bystander] });
    renderApp('/expenses/settlements');
    const li = (await screen.findByText('₹20.00')).closest('li')!;
    expect(within(li).getByRole('button', { name: copy.settlements.dispute })).toBeInTheDocument();
    expect(within(li).getByRole('button', { name: copy.settlements.reverse })).toBeInTheDocument();
  });

  it('a member who is the other party can dispute but not reverse what someone else recorded', async () => {
    mockMoney({ me: membership({ role: 'member' }), settlements: [recordedByKunal] });
    renderApp('/expenses/settlements');
    const li = (await screen.findByText('₹300.00')).closest('li')!;
    expect(within(li).getByRole('button', { name: copy.settlements.dispute })).toBeInTheDocument();
    expect(within(li).queryByRole('button', { name: copy.settlements.reverse })).not.toBeInTheDocument();
  });

  it('a member can reverse what they recorded but cannot dispute their own', async () => {
    mockMoney({ me: membership({ role: 'member' }), settlements: [recordedByMe] });
    renderApp('/expenses/settlements');
    const li = (await screen.findByText('₹10.00')).closest('li')!;
    expect(within(li).getByRole('button', { name: copy.settlements.reverse })).toBeInTheDocument();
    expect(within(li).queryByRole('button', { name: copy.settlements.dispute })).not.toBeInTheDocument();
  });

  it('a member who is not involved sees no actions', async () => {
    mockMoney({ me: membership({ role: 'member' }), settlements: [bystander] });
    renderApp('/expenses/settlements');
    const li = (await screen.findByText('₹20.00')).closest('li')!;
    expect(within(li).queryByRole('button')).not.toBeInTheDocument();
  });

  it('disputing needs a reason, then calls the database with it and the version', async () => {
    vi.mocked(settlementsApi.setSettlementStatus).mockResolvedValue(2);
    mockMoney({ settlements: [recordedByKunal] });
    renderApp('/expenses/settlements');
    await userEvent.click(await screen.findByRole('button', { name: copy.settlements.dispute }));
    const sheet = screen.getByRole('dialog', { name: copy.settlements.disputeTitle });
    await userEvent.click(within(sheet).getByRole('button', { name: copy.settlements.disputeConfirm }));
    expect(within(sheet).getByRole('alert')).toHaveTextContent(copy.settlements.reasonRequired);
    expect(settlementsApi.setSettlementStatus).not.toHaveBeenCalled();
    await userEvent.type(within(sheet).getByLabelText(copy.settlements.reason), 'Never received it');
    await userEvent.click(within(sheet).getByRole('button', { name: copy.settlements.disputeConfirm }));
    expect(settlementsApi.setSettlementStatus).toHaveBeenCalledWith('s-k', 'disputed', 'Never received it', 1);
    expect(await screen.findByText(copy.settlements.disputedToast)).toBeInTheDocument();
  });

  it('a failed dispute keeps the sheet and the typed reason', async () => {
    vi.mocked(settlementsApi.setSettlementStatus).mockRejectedValue(new TypeError('Failed to fetch'));
    mockMoney({ settlements: [recordedByKunal] });
    renderApp('/expenses/settlements');
    await userEvent.click(await screen.findByRole('button', { name: copy.settlements.dispute }));
    await userEvent.type(screen.getByLabelText(copy.settlements.reason), 'Never received it');
    await userEvent.click(screen.getByRole('button', { name: copy.settlements.disputeConfirm }));
    expect(await within(screen.getByRole('dialog')).findByText(copy.errors.network)).toBeInTheDocument();
    expect(screen.getByLabelText(copy.settlements.reason)).toHaveValue('Never received it');
  });

  it('reversing asks first and explains it can’t be turned back on', async () => {
    vi.mocked(settlementsApi.setSettlementStatus).mockResolvedValue(2);
    mockMoney({ settlements: [recordedByKunal] });
    renderApp('/expenses/settlements');
    await userEvent.click(await screen.findByRole('button', { name: copy.settlements.reverse }));
    const dialog = screen.getByRole('dialog', { name: copy.settlements.reverseTitle });
    expect(dialog).toHaveTextContent('can’t be turned back on');
    expect(settlementsApi.setSettlementStatus).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: copy.settlements.reverseConfirm }));
    expect(settlementsApi.setSettlementStatus).toHaveBeenCalledWith('s-k', 'reversed', undefined, 1);
    expect(await screen.findByText(copy.settlements.reversedToast)).toBeInTheDocument();
  });

  it('whoever raised a dispute can mark it correct again', async () => {
    vi.mocked(settlementsApi.setSettlementStatus).mockResolvedValue(3);
    mockMoney({ me: membership({ role: 'member' }), settlements: [disputed] }); // statusChangedBy u-aarav = me
    renderApp('/expenses/settlements');
    await userEvent.click(await screen.findByRole('button', { name: copy.settlements.resolve }));
    expect(settlementsApi.setSettlementStatus).toHaveBeenCalledWith('s-d', 'recorded', undefined, 1);
    expect(await screen.findByText(copy.settlements.resolvedToast)).toBeInTheDocument();
  });

  it('someone who did not raise the dispute cannot resolve it (unless admin)', async () => {
    mockMoney({ me: membership({ role: 'member' }), settlements: [{ ...disputed, statusChangedBy: 'u-kunal' }] });
    renderApp('/expenses/settlements');
    await screen.findByText('₹30.00');
    expect(screen.queryByRole('button', { name: copy.settlements.resolve })).not.toBeInTheDocument();
  });

  it('reversed settlements are history only: no actions', async () => {
    mockMoney({ settlements: [reversed] });
    renderApp('/expenses/settlements');
    const li = (await screen.findByText('₹40.00')).closest('li')!;
    expect(within(li).queryByRole('button')).not.toBeInTheDocument();
  });

  it('archived household: actions are disabled with the reason', async () => {
    mockMoney({ me: membership({ archived: true }), settlements: [recordedByKunal] });
    renderApp('/expenses/settlements');
    const dispute = await screen.findByRole('button', { name: copy.settlements.dispute });
    expect(dispute).toHaveAttribute('aria-disabled', 'true');
    expect(dispute).toHaveAccessibleDescription(copy.errors.householdArchived);
    expect(screen.getByRole('button', { name: copy.expenses.recordSettlement })).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows an error with retry', async () => {
    vi.mocked(settlementsApi.listSettlements).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderApp('/expenses/settlements');
    expect(await screen.findByText(copy.errors.network)).toBeInTheDocument();
    vi.mocked(settlementsApi.listSettlements).mockResolvedValue([recordedByKunal]);
    await userEvent.click(screen.getByRole('button', { name: copy.states.retry }));
    expect(await screen.findByText('₹300.00')).toBeInTheDocument();
  });
});

it('keeps unused imports honest', () => {
  expect(expense().id).toBe('e1');
});
