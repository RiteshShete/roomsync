import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as chores from '@/api/chores';
import * as groceries from '@/api/groceries';
import * as households from '@/api/households';
import { copy } from '@/copy';
import { addDays, todayIso } from '@/domain';
import { chore, grocery, inDays, mockHome } from '@/test/home';
import { BALANCES, mockMoney, settlement } from '@/test/money';
import { aarav, kunal, membership, renderApp, riya, signedIn } from '@/test/render';
import { QueryClient } from '@tanstack/react-query';

vi.mock('@/api/households');
vi.mock('@/api/invites');
vi.mock('@/api/profile');
vi.mock('@/api/auth');

const KUNAL = membership({ role: 'member', memberId: 'm-kunal' });
const today = () => todayIso();
const dateInput = () => screen.getByLabelText(copy.moveOut.date) as HTMLInputElement;

function setup({ me = KUNAL, chores: openChores = [] as ReturnType<typeof chore>[], items = [] as ReturnType<typeof grocery>[], settlements = [] as ReturnType<typeof settlement>[], balances = BALANCES } = {}) {
  mockHome({ me });
  mockMoney({ me, settlements, balances });
  // mockApi() inside the helpers resets these, so set them last
  vi.mocked(chores.listChores).mockResolvedValue({ open: openChores, completed: [] });
  vi.mocked(groceries.listGroceries).mockResolvedValue(items);
}

beforeEach(() => {
  vi.resetAllMocks();
  window.localStorage.clear();
  setup();
  vi.mocked(households.startMoveOut).mockResolvedValue();
  vi.mocked(households.cancelMoveOut).mockResolvedValue();
  vi.mocked(households.addMoveOutNote).mockResolvedValue();
  vi.mocked(households.listMoveOutNotes).mockResolvedValue([]);
  vi.mocked(households.getMoveOut).mockResolvedValue({ effectiveDate: null, requestedAt: null, requestedByMemberId: null, note: null, acknowledgedBalanceMinor: null });
});

describe('entry point', () => {
  it('Household settings links to Leave household', async () => {
    renderApp('/you/household');
    expect(await screen.findByRole('link', { name: copy.moveOut.settingsLink })).toHaveAttribute('href', '/you/household/leave');
  });
});

describe('who can leave', () => {
  it('the owner of a household with others is told to transfer ownership first, with a link to members', async () => {
    setup({ me: membership() });
    renderApp('/you/household/leave');
    expect(await screen.findByText(copy.moveOut.ownerTitle)).toBeInTheDocument();
    expect(screen.getByText(copy.moveOut.ownerBody)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: copy.moveOut.ownerGo })).toHaveAttribute('href', '/you/members');
    expect(screen.queryByRole('button', { name: copy.moveOut.confirmButton })).not.toBeInTheDocument();
  });

  it('a sole owner is pointed to archiving instead', async () => {
    mockHome({ me: membership(), members: [aarav] });
    mockMoney({ me: membership(), members: [aarav] });
    renderApp('/you/household/leave');
    expect(await screen.findByText(copy.moveOut.soleTitle)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: copy.moveOut.soleGo })).toHaveAttribute('href', '/you/household');
  });
});

describe('leaving: step 1, consequences', () => {
  it('explains what happens before anything can be confirmed, and says money is not handled', async () => {
    renderApp('/you/household/leave');
    expect(await screen.findByRole('heading', { name: copy.moveOut.introTitle })).toBeInTheDocument();
    for (const line of copy.moveOut.consequences) expect(screen.getByText(line)).toBeInTheDocument();
    expect(screen.getByText(/does not move money, work out deposits, or mark anything as paid/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy.moveOut.confirmButton })).not.toBeInTheDocument();
  });
});

describe('leaving: step 2, what is outstanding', () => {
  async function toReview() {
    renderApp('/you/household/leave');
    await userEvent.click(await screen.findByRole('button', { name: copy.moveOut.next }));
  }

  it('shows my balance as an estimate, my open chores, payments in dispute and the items I added', async () => {
    setup({
      chores: [chore({ id: 'a', title: 'Dishes', assigneeMemberId: 'm-kunal' }), chore({ id: 'b', title: 'Trash', assigneeMemberId: 'm-kunal' }), chore({ id: 'c', title: 'Not mine', assigneeMemberId: 'm-riya' })],
      items: [grocery({ id: 'g1', addedByMemberId: 'm-kunal' }), grocery({ id: 'g2', addedByMemberId: 'm-riya' }), grocery({ id: 'g3', addedByMemberId: 'm-kunal', status: 'purchased', purchasedByMemberId: 'm-riya', purchasedAt: '2026-05-02T10:00:00Z' })],
      settlements: [settlement({ id: 's1', status: 'disputed', fromMemberId: 'm-kunal', toMemberId: 'm-aarav', amountMinor: 30000 }), settlement({ id: 's2', status: 'recorded' }), settlement({ id: 's3', status: 'disputed', fromMemberId: 'm-aarav', toMemberId: 'm-riya' })],
    });
    await toReview();
    expect(await screen.findByText(copy.moveOut.balanceOwe('₹800.00'))).toBeInTheDocument();
    expect(screen.getByText(copy.moveOut.balanceNote)).toBeInTheDocument();
    expect(screen.getByText(copy.moveOut.choresSome(2))).toBeInTheDocument();
    expect(screen.getByText('Dishes')).toBeInTheDocument();
    expect(screen.getByText('Trash')).toBeInTheDocument();
    expect(screen.queryByText('Not mine')).not.toBeInTheDocument();
    expect(screen.getByText(copy.moveOut.disputedLine('Kunal', 'Aarav', '₹300.00'))).toBeInTheDocument();
    expect(screen.queryByText(copy.moveOut.disputedLine('Aarav', 'Riya', '₹300.00'))).not.toBeInTheDocument();
    expect(screen.getByText(copy.moveOut.groceriesSome(1))).toBeInTheDocument();
  });

  it('says plainly when nothing is outstanding, and phrases a credit and a zero balance', async () => {
    setup({ balances: [{ memberId: 'm-kunal', netMinor: 2500 }] });
    await toReview();
    expect(await screen.findByText(copy.moveOut.balanceOwed('₹25.00'))).toBeInTheDocument();
    expect(screen.getByText(copy.moveOut.choresNone)).toBeInTheDocument();
    expect(screen.getByText(copy.moveOut.disputedNone)).toBeInTheDocument();
    expect(screen.getByText(copy.moveOut.groceriesNone)).toBeInTheDocument();
  });

  it('a person with no recorded balance is settled up', async () => {
    setup({ balances: [] });
    await toReview();
    expect(await screen.findByText(copy.moveOut.balanceZero)).toBeInTheDocument();
  });

  it('a balance that cannot load says so instead of showing a wrong number', async () => {
    vi.mocked((await import('@/api/expenses')).getBalances).mockRejectedValue(new TypeError('Failed to fetch'));
    await toReview();
    expect(await screen.findAllByText(copy.errors.network)).not.toHaveLength(0);
    expect(screen.queryByText(copy.moveOut.balanceZero)).not.toBeInTheDocument();
  });

  it('never claims to compute deposits or mark dues paid', async () => {
    await toReview();
    await screen.findByText(copy.moveOut.balanceTitle);
    expect(document.body.textContent).not.toMatch(/deposit (refund|amount) of|marked as paid|dues (are )?paid/i);
  });
});

describe('leaving: date, note and explicit confirmation', () => {
  async function toReview() {
    renderApp('/you/household/leave');
    await userEvent.click(await screen.findByRole('button', { name: copy.moveOut.next }));
    await screen.findByLabelText(copy.moveOut.date);
  }

  it('starts a week ahead (never today by accident); Leave is disabled until the box is ticked', async () => {
    await toReview();
    expect(dateInput().value).toBe(inDays(7));
    expect(dateInput()).toHaveAttribute('min', today());
    expect(dateInput()).toHaveAttribute('max', addDays(today(), 90));
    const leave = screen.getByRole('button', { name: copy.moveOut.confirmButton });
    expect(leave).toHaveAttribute('aria-disabled', 'true');
    expect(leave).toHaveAccessibleDescription(copy.moveOut.reasonUnderstand);
    await userEvent.click(leave);
    expect(households.startMoveOut).not.toHaveBeenCalled();
  });

  it.each([
    ['', copy.moveOut.dateReasons.missing],
    [addDays(todayIso(), -1), copy.moveOut.dateReasons.past],
    [addDays(todayIso(), 91), copy.moveOut.dateReasons.tooFar],
  ])('date %j blocks with its reason, even when confirmed', async (value, reason) => {
    await toReview();
    await userEvent.click(screen.getByRole('checkbox', { name: copy.moveOut.understand }));
    // the date input ignores typing for out-of-range values in some browsers, so set it directly
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(dateInput(), { target: { value } });
    expect(screen.getByRole('button', { name: copy.moveOut.confirmButton })).toHaveAccessibleDescription(reason);
  });

  it('the boundary days (today and +90) are accepted', async () => {
    await toReview();
    await userEvent.click(screen.getByRole('checkbox', { name: copy.moveOut.understand }));
    const { fireEvent } = await import('@testing-library/react');
    for (const value of [today(), addDays(today(), 90)]) {
      fireEvent.change(dateInput(), { target: { value } });
      expect(screen.getByRole('button', { name: copy.moveOut.confirmButton })).not.toHaveAttribute('aria-disabled');
    }
  });

  it('starts the move-out with the date, the note, and the balance the person reviewed', async () => {
    await toReview();
    await userEvent.type(screen.getByLabelText(copy.moveOut.note), '  Deposit to discuss  ');
    await userEvent.click(screen.getByRole('checkbox', { name: copy.moveOut.understand }));
    await userEvent.click(screen.getByRole('button', { name: copy.moveOut.confirmButton }));
    expect(households.startMoveOut).toHaveBeenCalledWith({ memberId: 'm-kunal', effectiveDate: inDays(7), note: 'Deposit to discuss', acknowledgedBalanceMinor: -80000 });
    expect(await screen.findByText(copy.moveOut.started)).toBeInTheDocument();
  });

  it('a blank note is sent as no note', async () => {
    await toReview();
    await userEvent.click(screen.getByRole('checkbox', { name: copy.moveOut.understand }));
    await userEvent.click(screen.getByRole('button', { name: copy.moveOut.confirmButton }));
    expect(vi.mocked(households.startMoveOut).mock.calls[0]![0].note).toBeNull();
  });

  it('a failed start keeps the date, note and tick, and says why', async () => {
    vi.mocked(households.startMoveOut).mockRejectedValue(new TypeError('Failed to fetch'));
    await toReview();
    await userEvent.type(screen.getByLabelText(copy.moveOut.note), 'Keep me');
    await userEvent.click(screen.getByRole('checkbox', { name: copy.moveOut.understand }));
    await userEvent.click(screen.getByRole('button', { name: copy.moveOut.confirmButton }));
    expect(await screen.findByText(copy.errors.network)).toBeInTheDocument();
    expect(screen.getByLabelText(copy.moveOut.note)).toHaveValue('Keep me');
    expect(screen.getByRole('checkbox', { name: copy.moveOut.understand })).toBeChecked();
    expect(dateInput().value).toBe(inDays(7));
  });

  it('the database refusing (owner must transfer, archived) shows its message', async () => {
    vi.mocked(households.startMoveOut).mockRejectedValue({ message: 'household_archived' });
    await toReview();
    await userEvent.click(screen.getByRole('checkbox', { name: copy.moveOut.understand }));
    await userEvent.click(screen.getByRole('button', { name: copy.moveOut.confirmButton }));
    expect(await screen.findByText(copy.errors.householdArchived)).toBeInTheDocument();
  });

  it('a double click starts it once', async () => {
    let finish!: () => void;
    vi.mocked(households.startMoveOut).mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    await toReview();
    await userEvent.click(screen.getByRole('checkbox', { name: copy.moveOut.understand }));
    await userEvent.dblClick(screen.getByRole('button', { name: copy.moveOut.confirmButton }));
    expect(households.startMoveOut).toHaveBeenCalledTimes(1);
    finish();
  });

  it('archived household: leaving is disabled with the reason', async () => {
    setup({ me: membership({ role: 'member', memberId: 'm-kunal', archived: true }) });
    await toReview();
    await userEvent.click(screen.getByRole('checkbox', { name: copy.moveOut.understand }));
    expect(screen.getByRole('button', { name: copy.moveOut.confirmButton })).toHaveAccessibleDescription(copy.errors.householdArchived);
  });

  it('Back returns to the explanation', async () => {
    await toReview();
    await userEvent.click(screen.getByRole('button', { name: copy.moveOut.back }));
    expect(await screen.findByRole('heading', { name: copy.moveOut.introTitle })).toBeInTheDocument();
  });
});

describe('while leaving', () => {
  const leaving = (date: string) => membership({ role: 'member', memberId: 'm-kunal', status: 'leaving', moveOutEffectiveDate: date });

  function leavingSetup(date = inDays(10)) {
    setup({ me: leaving(date), chores: [chore({ assigneeMemberId: 'm-kunal', title: 'Dishes' })] });
  }

  it('shows when it takes effect, that access continues until then, what was recorded and what is unresolved', async () => {
    leavingSetup(inDays(10));
    vi.mocked(households.getMoveOut).mockResolvedValue({ effectiveDate: inDays(10), requestedAt: '2026-05-01T10:00:00Z', requestedByMemberId: 'm-kunal', note: 'Deposit to discuss', acknowledgedBalanceMinor: -80000 });
    renderApp('/you/household/leave');
    expect(await screen.findByRole('heading', { name: copy.moveOut.statusTitle })).toBeInTheDocument();
    expect(screen.getByText(copy.moveOut.stillAccess)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(copy.moveOut.timing.inDays(10)))).toBeInTheDocument();
    expect(await screen.findByText(copy.moveOut.recordedBalance('-₹800.00'))).toBeInTheDocument();
    expect(screen.getByText('Deposit to discuss')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: copy.moveOut.unresolvedTitle })).toBeInTheDocument();
    expect(await screen.findByText('Dishes')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy.moveOut.confirmButton })).not.toBeInTheDocument();
  });

  it.each([
    [0, copy.moveOut.timing.today],
    [1, copy.moveOut.timing.tomorrow],
  ])('a date %i days away reads "%s"', async (days, text) => {
    leavingSetup(inDays(days));
    renderApp('/you/household/leave');
    expect(await screen.findByText(new RegExp(text))).toBeInTheDocument();
  });

  it('the shell shows a banner with a link to the details on every page', async () => {
    leavingSetup(inDays(3));
    renderApp('/');
    const link = await screen.findByRole('link', { name: copy.moveOut.bannerLink });
    expect(link).toHaveAttribute('href', '/you/household/leave');
    expect(link.closest('p')).toHaveTextContent(/You’re moving out on/);
  });

  it('notes and disputes are listed, added with the text kept on failure, and never resolved by the app', async () => {
    leavingSetup();
    vi.mocked(households.listMoveOutNotes).mockResolvedValue([{ id: 'n1', note: 'Electricity bill unclear', createdAt: '2026-05-02T10:00:00Z' }]);
    renderApp('/you/household/leave');
    expect(await screen.findByText('Electricity bill unclear')).toBeInTheDocument();
    const add = screen.getByRole('button', { name: copy.moveOut.noteSave });
    expect(add).toHaveAccessibleDescription(copy.moveOut.noteReasonEmpty);

    vi.mocked(households.addMoveOutNote).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await userEvent.type(screen.getByLabelText(copy.moveOut.noteLabel), 'Deposit not returned');
    await userEvent.click(add);
    expect(await screen.findByText(copy.errors.network)).toBeInTheDocument();
    expect(screen.getByLabelText(copy.moveOut.noteLabel)).toHaveValue('Deposit not returned');

    await userEvent.click(add);
    expect(households.addMoveOutNote).toHaveBeenLastCalledWith('m-kunal', 'Deposit not returned');
    expect(await screen.findByText(copy.moveOut.noteAdded)).toBeInTheDocument();
    expect(screen.getByLabelText(copy.moveOut.noteLabel)).toHaveValue('');
  });

  it('cancel asks first, then cancels; keeping it does nothing', async () => {
    leavingSetup();
    renderApp('/you/household/leave');
    await userEvent.click(await screen.findByRole('button', { name: copy.moveOut.cancel }));
    expect(await screen.findByText(copy.moveOut.cancelBody)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: copy.moveOut.cancelKeep }));
    expect(households.cancelMoveOut).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: copy.moveOut.cancel }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: copy.moveOut.cancelConfirm }));
    expect(households.cancelMoveOut).toHaveBeenCalledWith('m-kunal');
    expect(await screen.findByText(copy.moveOut.cancelled)).toBeInTheDocument();
  });

  it('a cancel that fails explains and the page stays', async () => {
    leavingSetup();
    vi.mocked(households.cancelMoveOut).mockRejectedValue({ message: 'conflict' });
    renderApp('/you/household/leave');
    await userEvent.click(await screen.findByRole('button', { name: copy.moveOut.cancel }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: copy.moveOut.cancelConfirm }));
    expect(await screen.findByText(copy.errors.conflict)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: copy.moveOut.statusTitle })).toBeInTheDocument();
  });
});

describe('owner or admin starting a move-out for someone else', () => {
  it('an admin starts it for a member with a date and note; the sheet explains what happens', async () => {
    const me = membership({ role: 'admin', memberId: 'm-riya' });
    mockHome({ me });
    mockMoney({ me });
    renderApp('/you/members');
    await userEvent.click(await screen.findByRole('button', { name: copy.members.manageFor('Kunal') }));
    await userEvent.click(await screen.findByRole('button', { name: copy.moveOut.forOther.start }));
    expect(await screen.findByText(copy.moveOut.forOther.body('Kunal'))).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(copy.moveOut.note), 'Agreed in person');
    await userEvent.click(screen.getByRole('button', { name: copy.moveOut.forOther.confirm }));
    expect(households.startMoveOut).toHaveBeenCalledWith({ memberId: 'm-kunal', effectiveDate: inDays(7), note: 'Agreed in person', acknowledgedBalanceMinor: null });
    expect(await screen.findByText(copy.moveOut.forOther.started('Kunal'))).toBeInTheDocument();
  });

  it('a failure keeps the sheet and fields', async () => {
    setup({ me: membership({ role: 'admin', memberId: 'm-riya' }) });
    vi.mocked(households.startMoveOut).mockRejectedValue({ message: 'permission_denied' });
    renderApp('/you/members');
    await userEvent.click(await screen.findByRole('button', { name: copy.members.manageFor('Kunal') }));
    await userEvent.click(await screen.findByRole('button', { name: copy.moveOut.forOther.start }));
    await userEvent.type(await screen.findByLabelText(copy.moveOut.note), 'Keep');
    await userEvent.click(screen.getByRole('button', { name: copy.moveOut.forOther.confirm }));
    expect(await screen.findByText(copy.errors.permission)).toBeInTheDocument();
    expect(screen.getByLabelText(copy.moveOut.note)).toHaveValue('Keep');
  });

  it('for someone already leaving, the choice is to cancel their move-out', async () => {
    mockHome({ members: [aarav, riya, { ...kunal, status: 'leaving', moveOutEffectiveDate: inDays(5) }] });
    renderApp('/you/members');
    await userEvent.click(await screen.findByRole('button', { name: copy.members.manageFor('Kunal') }));
    expect(screen.queryByRole('button', { name: copy.moveOut.forOther.start })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: copy.moveOut.forOther.cancelFor('Kunal') }));
    expect(households.cancelMoveOut).toHaveBeenCalledWith('m-kunal');
    expect(await screen.findByText(copy.moveOut.forOther.cancelledFor('Kunal'))).toBeInTheDocument();
  });

  it('the owner is never offered a move-out by someone else', async () => {
    const me = membership({ role: 'admin', memberId: 'm-riya' });
    mockHome({ me });
    renderApp('/you/members');
    await screen.findByText('Aarav', { selector: 'p' });
    expect(screen.queryByRole('button', { name: copy.members.manageFor('Aarav') })).not.toBeInTheDocument();
  });
});

describe('after leaving', () => {
  const leftOnce = [{ householdId: 'h-old', name: 'Flat 4B', leftAt: '2026-05-03T09:00:00Z' }];

  it('someone with no household who just left sees "You\'ve left <household>" with what that means', async () => {
    mockHome({ me: null as never });
    vi.mocked(households.getMyMembership).mockResolvedValue(null);
    vi.mocked(households.listMyLeftHouseholds).mockResolvedValue(leftOnce);
    renderApp('/');
    expect(await screen.findByRole('heading', { name: copy.left.title('Flat 4B') })).toBeInTheDocument();
    expect(screen.getByText(copy.left.body)).toBeInTheDocument();
    expect(screen.getByText(copy.left.unresolved)).toBeInTheDocument();
    // and nothing from the household is shown
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });

  it('a cached "nothing left" from earlier in the session does not hide the notice', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
    client.setQueryData(['left-households'], []); // fetched when this person had no household yet, long before they left
    vi.mocked(households.getMyMembership).mockResolvedValue(null);
    vi.mocked(households.listMyLeftHouseholds).mockResolvedValue(leftOnce);
    renderApp('/', signedIn, client);
    expect(await screen.findByRole('heading', { name: copy.left.title('Flat 4B') })).toBeInTheDocument();
  });

  it('Continue goes on to create or join, and the notice is not shown again on this device', async () => {
    vi.mocked(households.getMyMembership).mockResolvedValue(null);
    vi.mocked(households.listMyLeftHouseholds).mockResolvedValue(leftOnce);
    renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: copy.left.continue }));
    expect(await screen.findByText(copy.household.chooseBody)).toBeInTheDocument();
    expect(window.localStorage.getItem('roomsync.left-seen:h-old')).toBe('1');
  });

  it('once seen, a person with no household goes straight to create or join', async () => {
    window.localStorage.setItem('roomsync.left-seen:h-old', '1');
    vi.mocked(households.getMyMembership).mockResolvedValue(null);
    vi.mocked(households.listMyLeftHouseholds).mockResolvedValue(leftOnce);
    renderApp('/');
    expect(await screen.findByText(copy.household.chooseBody)).toBeInTheDocument();
  });

  it('a brand-new user (nothing ever left) goes straight to create or join', async () => {
    vi.mocked(households.getMyMembership).mockResolvedValue(null);
    renderApp('/');
    expect(await screen.findByText(copy.household.chooseBody)).toBeInTheDocument();
  });

  it('if the list of left households cannot load, the person still gets to create or join', async () => {
    vi.mocked(households.getMyMembership).mockResolvedValue(null);
    vi.mocked(households.listMyLeftHouseholds).mockRejectedValue(new TypeError('Failed to fetch'));
    renderApp('/');
    expect(await screen.findByText(copy.household.chooseBody)).toBeInTheDocument();
  });

  it('with blocked storage the notice still works (it may simply show again)', async () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.mocked(households.getMyMembership).mockResolvedValue(null);
    vi.mocked(households.listMyLeftHouseholds).mockResolvedValue(leftOnce);
    renderApp('/');
    expect(await screen.findByRole('heading', { name: copy.left.title('Flat 4B') })).toBeInTheDocument();
    spy.mockRestore();
  });

  it('opening /left with nothing to show goes on to create or join', async () => {
    vi.mocked(households.getMyMembership).mockResolvedValue(null);
    renderApp('/left');
    expect(await screen.findByText(copy.household.chooseBody)).toBeInTheDocument();
  });
});

describe('applying a move-out whose date has passed', () => {
  it('asks the server to reconcile when the household is opened', async () => {
    renderApp('/');
    await vi.waitFor(() => expect(households.reconcileHousehold).toHaveBeenCalledWith('h1'));
  });

  it('when someone flipped to left, everything refreshes (a failed reconcile is silent)', async () => {
    vi.mocked(households.reconcileHousehold).mockResolvedValue(1);
    renderApp('/');
    await vi.waitFor(() => expect(vi.mocked(households.getMyMembership).mock.calls.length).toBeGreaterThan(1));

    vi.mocked(households.reconcileHousehold).mockRejectedValue(new TypeError('Failed to fetch'));
    renderApp('/');
    expect(await screen.findAllByRole('heading', { level: 1, name: 'Flat 4B' })).not.toHaveLength(0);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
