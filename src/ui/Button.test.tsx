import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button, IconButton } from './Button';

describe('Button', () => {
  it('has an accessible name and fires onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save expense</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Save expense' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is a plain button by default so it never submits a form by accident', () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('meets the 44px touch target (min-h-11)', () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole('button')).toHaveClass('min-h-11');
  });

  it('loading: announces busy, swaps the label, and ignores clicks', async () => {
    const onClick = vi.fn();
    render(
      <Button loading loadingLabel="Saving…" onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Saving…' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('disabled: stays focusable, exposes the reason, and ignores clicks', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled disabledReason="Add a title first" onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription('Add a title first');
    button.focus();
    expect(button).toHaveFocus();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('can show the disabled reason on screen', () => {
    render(
      <Button disabled disabledReason="Not available yet" showReason>
        Join
      </Button>,
    );
    expect(screen.getByText('Not available yet')).toBeVisible();
  });

  it('a disabled submit button does not submit the form', async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <input aria-label="name" />
        <Button type="submit" disabled disabledReason="Fill in the form">
          Send
        </Button>
      </form>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    await userEvent.type(screen.getByLabelText('name'), 'x{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('renders every variant', () => {
    render(
      <>
        {(['primary', 'secondary', 'tertiary', 'danger', 'amber'] as const).map((v) => (
          <Button key={v} variant={v}>
            {v}
          </Button>
        ))}
      </>,
    );
    expect(screen.getAllByRole('button')).toHaveLength(5);
  });
});

describe('IconButton', () => {
  it('uses its label as the accessible name', async () => {
    const onClick = vi.fn();
    render(<IconButton label="Notifications" icon={<svg />} onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('disabled: ignores clicks and states why', async () => {
    const onClick = vi.fn();
    render(<IconButton label="Notifications" icon={<svg />} disabled disabledReason="Coming later" onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'Notifications' });
    expect(button).toHaveAccessibleDescription('Coming later');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
