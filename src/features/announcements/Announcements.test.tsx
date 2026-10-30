import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/api/announcements';
import { copy } from '@/copy';
import { announcement, mockHome } from '@/test/home';
import { membership, renderApp } from '@/test/render';

vi.mock('@/api/households');
vi.mock('@/api/invites');
vi.mock('@/api/profile');
vi.mock('@/api/auth');

beforeEach(() => {
  vi.resetAllMocks();
  mockHome();
  vi.mocked(api.listAnnouncements).mockResolvedValue([]);
});

const card = (title: string) => screen.getByRole('heading', { name: title }).closest('li')!;

describe('announcement list', () => {
  const list = [
    announcement({ id: 'a', title: 'Pinned notice', pinnedAt: '2026-05-02T10:00:00Z', createdBy: 'u-riya' }),
    announcement({ id: 'b', title: 'Plain notice', createdBy: 'u-kunal', version: 3 }),
  ];

  it('shows author, time, message, a Pinned chip and an edited marker', async () => {
    vi.mocked(api.listAnnouncements).mockResolvedValue(list);
    renderApp('/house/announcements');
    expect(await screen.findByRole('heading', { name: 'Pinned notice' })).toBeInTheDocument();
    expect(within(card('Pinned notice')).getByText(copy.announcements.pinned)).toBeInTheDocument();
    expect(within(card('Pinned notice')).getByText(/Riya ·/)).toBeInTheDocument();
    expect(within(card('Plain notice')).getByText(/Kunal ·.*edited/)).toBeInTheDocument();
    expect(within(card('Plain notice')).getByText('Tuesday 10 to 12.')).toBeInTheDocument();
  });

  it('empty state offers to post', async () => {
    renderApp('/house/announcements');
    expect(await screen.findByText(copy.announcements.emptyTitle)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: copy.announcements.post }).length).toBeGreaterThan(0);
  });

  it('error state retries', async () => {
    vi.mocked(api.listAnnouncements).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderApp('/house/announcements');
    expect(await screen.findByText(copy.errors.network)).toBeInTheDocument();
    vi.mocked(api.listAnnouncements).mockResolvedValue(list);
    await userEvent.click(screen.getByRole('button', { name: copy.states.retry }));
    expect(await screen.findByRole('heading', { name: 'Pinned notice' })).toBeInTheDocument();
  });
});

describe('posting', () => {
  it('Post is disabled with a reason until there is a title and a message, then posts as me', async () => {
    vi.mocked(api.createAnnouncement).mockResolvedValue();
    renderApp('/house/announcements');
    await userEvent.click((await screen.findAllByRole('button', { name: copy.announcements.post }))[0]!);
    const post = await screen.findByRole('button', { name: copy.announcements.save });
    expect(post).toHaveAccessibleDescription(copy.announcements.reasonTitle);
    await userEvent.type(screen.getByLabelText(copy.announcements.heading), '  Party Saturday ');
    expect(post).toHaveAccessibleDescription(copy.announcements.reasonMessage);
    await userEvent.type(screen.getByLabelText(copy.announcements.message), 'Friends coming over.');
    await userEvent.click(post);
    expect(api.createAnnouncement).toHaveBeenCalledWith('h1', 'u-aarav', { title: 'Party Saturday', body: 'Friends coming over.' });
    expect(await screen.findByText(copy.announcements.posted)).toBeInTheDocument();
  });

  it('a failed post keeps the sheet and everything typed', async () => {
    vi.mocked(api.createAnnouncement).mockRejectedValue(new TypeError('Failed to fetch'));
    renderApp('/house/announcements');
    await userEvent.click((await screen.findAllByRole('button', { name: copy.announcements.post }))[0]!);
    await userEvent.type(await screen.findByLabelText(copy.announcements.heading), 'Keep me');
    await userEvent.type(screen.getByLabelText(copy.announcements.message), 'Body stays');
    await userEvent.click(screen.getByRole('button', { name: copy.announcements.save }));
    expect(await screen.findByText(copy.errors.network)).toBeInTheDocument();
    expect(screen.getByLabelText(copy.announcements.heading)).toHaveValue('Keep me');
    expect(screen.getByLabelText(copy.announcements.message)).toHaveValue('Body stays');
  });

  it('archived household: posting is disabled with the reason', async () => {
    mockHome({ me: membership({ archived: true }) });
    vi.mocked(api.listAnnouncements).mockResolvedValue([announcement()]);
    renderApp('/house/announcements');
    await screen.findByRole('heading', { name: 'Water off' });
    expect(screen.getByRole('button', { name: copy.announcements.post })).toHaveAttribute('aria-disabled', 'true');
    expect(within(card('Water off')).getByRole('button', { name: copy.announcements.edit })).toHaveAccessibleDescription(copy.errors.householdArchived);
  });
});

describe('who can change what (UX; the database enforces it)', () => {
  it('a plain member can edit and delete their own but not someone else’s, and cannot pin', async () => {
    mockHome({ me: membership({ role: 'member' }) });
    vi.mocked(api.listAnnouncements).mockResolvedValue([announcement({ id: 'mine', title: 'Mine', createdBy: 'u-aarav' }), announcement({ id: 'theirs', title: 'Theirs', createdBy: 'u-riya' })]);
    renderApp('/house/announcements');
    await screen.findByRole('heading', { name: 'Mine' });
    expect(within(card('Mine')).getByRole('button', { name: copy.announcements.edit })).not.toHaveAttribute('aria-disabled');
    expect(within(card('Mine')).getByRole('button', { name: copy.announcements.delete })).not.toHaveAttribute('aria-disabled');
    const theirs = within(card('Theirs'));
    expect(theirs.getByRole('button', { name: copy.announcements.edit })).toHaveAccessibleDescription(copy.announcements.noPermission);
    expect(theirs.getByRole('button', { name: copy.announcements.delete })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByRole('button', { name: copy.announcements.pin })).not.toBeInTheDocument();
  });

  it('an owner or admin can pin, unpin, edit and delete anyone’s', async () => {
    vi.mocked(api.listAnnouncements).mockResolvedValue([announcement({ id: 'x', title: 'Theirs', createdBy: 'u-kunal', version: 4 })]);
    vi.mocked(api.setAnnouncementPinned).mockResolvedValue(5);
    renderApp('/house/announcements');
    await screen.findByRole('heading', { name: 'Theirs' });
    expect(within(card('Theirs')).getByRole('button', { name: copy.announcements.edit })).not.toHaveAttribute('aria-disabled');
    await userEvent.click(within(card('Theirs')).getByRole('button', { name: copy.announcements.pin }));
    expect(api.setAnnouncementPinned).toHaveBeenCalledWith('x', 4, true);
    expect(await screen.findByText(copy.announcements.pinnedToast)).toBeInTheDocument();
  });

  it('unpinning sends pinned = false', async () => {
    vi.mocked(api.listAnnouncements).mockResolvedValue([announcement({ id: 'x', title: 'Up', pinnedAt: '2026-05-02T10:00:00Z' })]);
    vi.mocked(api.setAnnouncementPinned).mockResolvedValue(2);
    renderApp('/house/announcements');
    await userEvent.click(await screen.findByRole('button', { name: copy.announcements.unpin }));
    expect(api.setAnnouncementPinned).toHaveBeenCalledWith('x', 1, false);
  });
});

describe('editing and deleting', () => {
  it('edit starts from the saved text, keeps Save disabled until changed, and sends the version', async () => {
    vi.mocked(api.listAnnouncements).mockResolvedValue([announcement({ id: 'x', title: 'Old title', version: 2 })]);
    vi.mocked(api.updateAnnouncement).mockResolvedValue(3);
    renderApp('/house/announcements');
    await userEvent.click(await screen.findByRole('button', { name: copy.announcements.edit }));
    const title = await screen.findByLabelText(copy.announcements.heading);
    expect(title).toHaveValue('Old title');
    const save = screen.getByRole('button', { name: copy.announcements.saveEdit });
    expect(save).toHaveAccessibleDescription(copy.announcements.reasonSame);
    await userEvent.clear(title);
    await userEvent.type(title, 'New title');
    await userEvent.click(save);
    expect(api.updateAnnouncement).toHaveBeenCalledWith('x', 2, { title: 'New title', body: 'Tuesday 10 to 12.' });
    expect(await screen.findByText(copy.announcements.updated)).toBeInTheDocument();
  });

  it('a conflict closes the sheet, refreshes, and explains', async () => {
    vi.mocked(api.listAnnouncements).mockResolvedValue([announcement({ id: 'x', title: 'Old title' })]);
    vi.mocked(api.updateAnnouncement).mockRejectedValue({ message: 'conflict' });
    renderApp('/house/announcements');
    await userEvent.click(await screen.findByRole('button', { name: copy.announcements.edit }));
    await userEvent.type(await screen.findByLabelText(copy.announcements.heading), '!');
    await userEvent.click(screen.getByRole('button', { name: copy.announcements.saveEdit }));
    expect(await screen.findByText(copy.announcements.conflict)).toBeInTheDocument();
    await vi.waitFor(() => expect(vi.mocked(api.listAnnouncements).mock.calls.length).toBeGreaterThan(1));
  });

  it('delete asks first, explains, then deletes with the version', async () => {
    vi.mocked(api.listAnnouncements).mockResolvedValue([announcement({ id: 'x', title: 'Gone soon', version: 6 })]);
    vi.mocked(api.deleteAnnouncement).mockResolvedValue(7);
    renderApp('/house/announcements');
    await userEvent.click(await screen.findByRole('button', { name: copy.announcements.delete }));
    expect(await screen.findByText(copy.announcements.deleteBody)).toBeInTheDocument();
    expect(api.deleteAnnouncement).not.toHaveBeenCalled();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: copy.announcements.deleteConfirm }));
    expect(api.deleteAnnouncement).toHaveBeenCalledWith('x', 6);
    expect(await screen.findByText(copy.announcements.deleted)).toBeInTheDocument();
  });

  it('"Keep it" cancels the delete', async () => {
    vi.mocked(api.listAnnouncements).mockResolvedValue([announcement()]);
    renderApp('/house/announcements');
    await userEvent.click(await screen.findByRole('button', { name: copy.announcements.delete }));
    await userEvent.click(await screen.findByRole('button', { name: copy.announcements.deleteKeep }));
    expect(api.deleteAnnouncement).not.toHaveBeenCalled();
  });
});
