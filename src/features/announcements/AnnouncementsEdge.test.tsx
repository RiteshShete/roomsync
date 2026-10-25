import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/api/announcements';
import { copy } from '@/copy';
import { announcement, mockHome } from '@/test/home';
import { renderApp } from '@/test/render';

vi.mock('@/api/households');
vi.mock('@/api/invites');
vi.mock('@/api/profile');
vi.mock('@/api/auth');

beforeEach(() => {
  vi.resetAllMocks();
  mockHome();
  vi.mocked(api.listAnnouncements).mockResolvedValue([]);
});

describe('announcements: edge cases', () => {
  it('markup in a title or message is shown as plain text, never run', async () => {
    vi.mocked(api.listAnnouncements).mockResolvedValue([announcement({ title: '<img src=x onerror=alert(1)>', body: '<script>window.__pwned = true</script>' })]);
    renderApp('/house/announcements');
    expect(await screen.findByRole('heading', { name: '<img src=x onerror=alert(1)>' })).toBeInTheDocument();
    expect(screen.getByText('<script>window.__pwned = true</script>')).toBeInTheDocument();
    expect(document.querySelector('img[src="x"]')).toBeNull();
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
  });

  it('line breaks and long unbroken text are kept', async () => {
    vi.mocked(api.listAnnouncements).mockResolvedValue([announcement({ body: `Line one\nLine two\n${'x'.repeat(500)}` })]);
    renderApp('/house/announcements');
    const body = await screen.findByText(/Line one/);
    expect(body.className).toMatch(/whitespace-pre-wrap/);
    expect(body.textContent).toContain('Line two');
  });

  it('a double-click on Post sends one request', async () => {
    let finish!: () => void;
    vi.mocked(api.createAnnouncement).mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    renderApp('/house/announcements');
    await userEvent.click((await screen.findAllByRole('button', { name: copy.announcements.post }))[0]!);
    await userEvent.type(await screen.findByLabelText(copy.announcements.heading), 'Once');
    await userEvent.type(screen.getByLabelText(copy.announcements.message), 'Only once');
    await userEvent.dblClick(screen.getByRole('button', { name: copy.announcements.save }));
    expect(api.createAnnouncement).toHaveBeenCalledTimes(1);
    finish();
  });

  it('only whitespace is not a valid title or message', async () => {
    renderApp('/house/announcements');
    await userEvent.click((await screen.findAllByRole('button', { name: copy.announcements.post }))[0]!);
    await userEvent.type(await screen.findByLabelText(copy.announcements.heading), '     ');
    await userEvent.type(screen.getByLabelText(copy.announcements.message), '     ');
    const post = screen.getByRole('button', { name: copy.announcements.save });
    expect(post).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(post);
    expect(api.createAnnouncement).not.toHaveBeenCalled();
  });

  it('deleting something someone else already deleted explains and refreshes', async () => {
    vi.mocked(api.listAnnouncements).mockResolvedValue([announcement({ id: 'x', title: 'Already gone' })]);
    vi.mocked(api.deleteAnnouncement).mockRejectedValue({ message: 'conflict' });
    renderApp('/house/announcements');
    await userEvent.click(await screen.findByRole('button', { name: copy.announcements.delete }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: copy.announcements.deleteConfirm }));
    expect(await screen.findByText(copy.announcements.conflict)).toBeInTheDocument();
    await vi.waitFor(() => expect(vi.mocked(api.listAnnouncements).mock.calls.length).toBeGreaterThan(1));
  });

  it('a refused write (the database says no) shows the permission message and keeps the text', async () => {
    vi.mocked(api.listAnnouncements).mockResolvedValue([announcement({ id: 'x', createdBy: 'u-aarav' })]);
    vi.mocked(api.updateAnnouncement).mockRejectedValue({ message: 'permission_denied' });
    renderApp('/house/announcements');
    await userEvent.click(await screen.findByRole('button', { name: copy.announcements.edit }));
    await userEvent.type(await screen.findByLabelText(copy.announcements.heading), '!');
    await userEvent.click(screen.getByRole('button', { name: copy.announcements.saveEdit }));
    expect(await screen.findByText(copy.errors.permission)).toBeInTheDocument();
    expect(screen.getByLabelText(copy.announcements.heading)).toHaveValue('Water off!');
  });
});
