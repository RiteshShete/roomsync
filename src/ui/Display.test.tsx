import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Avatar, AvatarGroup } from './Avatar';
import { BottomNav } from './BottomNav';
import { Chip } from './Chip';
import { Header } from './Header';
import { EmptyState, ErrorState, Skeleton, SkeletonList } from './States';

describe('Avatar', () => {
  it('is an image named after the person, with initials', () => {
    render(<Avatar name="Aarav Shah" />);
    const avatar = screen.getByRole('img', { name: 'Aarav Shah' });
    expect(avatar).toHaveTextContent('AS');
  });

  it.each([
    ['Riya', 'R'],
    ['  kunal   m  ', 'KM'],
    ['', '?'],
  ])('initials for %j are %s', (name, initials) => {
    render(<Avatar name={name || ' '} />);
    expect(screen.getByRole('img')).toHaveTextContent(initials);
  });

  it('picks readable text colour for light and dark backgrounds', () => {
    const { rerender } = render(<Avatar name="A" color="#FFE5DC" />);
    expect(screen.getByRole('img')).toHaveStyle({ color: '#1b1b1b' });
    rerender(<Avatar name="A" color="#4F46E5" />);
    expect(screen.getByRole('img')).toHaveStyle({ color: '#ffffff' });
  });

  it('group collapses overflow into a +N chip with a name', () => {
    const people = ['A', 'B', 'C', 'D', 'E', 'F'].map((name) => ({ name }));
    render(<AvatarGroup members={people} max={4} />);
    expect(screen.getByRole('group', { name: '6 members' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '2 more' })).toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(5);
  });
});

describe('Chip', () => {
  it('carries meaning in text, not colour alone', () => {
    render(<Chip tone="warning">Moving out</Chip>);
    expect(screen.getByText('Moving out')).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('says what is missing and offers the next step', async () => {
    const onClick = vi.fn();
    render(<EmptyState title="No shared expenses yet" body="Add a bill or purchase to keep household spending clear." action={<button onClick={onClick}>Add expense</button>} />);
    expect(screen.getByRole('heading', { name: 'No shared expenses yet' })).toBeInTheDocument();
    expect(screen.getByText(/keep household spending clear/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add expense' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('works without a body or action', () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.getByRole('heading', { name: 'Nothing here' })).toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('announces the message and retries on request', async () => {
    const onRetry = vi.fn();
    render(<ErrorState message="We couldn’t reach RoomSync." onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t reach RoomSync.');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('omits the retry button when there is nothing to retry', () => {
    render(<ErrorState message="Nope" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('Skeleton', () => {
  it('single block is hidden from assistive tech', () => {
    const { container } = render(<Skeleton className="h-4" />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('list announces a single busy status', () => {
    render(<SkeletonList rows={3} />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent('Loading…');
  });
});

describe('BottomNav', () => {
  it('has the five tabs from the spec as links', () => {
    render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const names = Array.from(nav.querySelectorAll('a')).map((a) => a.textContent);
    expect(names).toEqual(['Home', 'Expenses', 'Chores', 'House', 'You']);
  });

  it('marks the current tab with aria-current', () => {
    render(
      <MemoryRouter initialEntries={['/chores']}>
        <BottomNav />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Chores' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('Home is only current on the root path', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <BottomNav />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
  });

  it('tabs are at least 44px tall', () => {
    render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>,
    );
    for (const link of screen.getAllByRole('link')) expect(link).toHaveClass('min-h-14');
  });
});

describe('Header', () => {
  it('shows the title as the page heading', () => {
    render(<Header title="Expenses" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Expenses' })).toBeInTheDocument();
  });

  it('back button works and has a name', async () => {
    const onBack = vi.fn();
    render(<Header title="Details" onBack={onBack} />);
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('bell disabled: says why and does nothing', async () => {
    const onClick = vi.fn();
    render(<Header title="Home" bell={{ disabledReason: 'The activity centre arrives in a later update.', onClick }} />);
    const bell = screen.getByRole('button', { name: 'Notifications' });
    expect(bell).toHaveAccessibleDescription('The activity centre arrives in a later update.');
    await userEvent.click(bell);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('bell enabled: includes the unread count in its name', async () => {
    const onClick = vi.fn();
    render(<Header title="Home" bell={{ unread: 3, onClick }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Notifications, 3 unread' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('caps the badge at 9+', () => {
    render(<Header title="Home" bell={{ unread: 25, onClick: () => {} }} />);
    expect(screen.getByText('9+')).toBeInTheDocument();
  });
});
