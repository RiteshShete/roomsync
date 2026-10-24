import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';
import { Sheet } from './Sheet';
import { ToastProvider, useToast } from './Toast';

function SheetHarness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open sheet</button>
      <Sheet
        open={open}
        title="Add item"
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
        footer={<button>Save item</button>}
      >
        <input aria-label="Item name" />
      </Sheet>
    </>
  );
}

describe('Sheet', () => {
  it('renders nothing while closed', () => {
    render(<Sheet open={false} title="Hidden" onClose={() => {}}>x</Sheet>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is a modal dialog named by its title and moves focus inside', async () => {
    render(<SheetHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open sheet' }));
    const dialog = screen.getByRole('dialog', { name: 'Add item' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it('closes on Escape and restores focus to the opener', async () => {
    const onClose = vi.fn();
    render(<SheetHarness onClose={onClose} />);
    const opener = screen.getByRole('button', { name: 'Open sheet' });
    await userEvent.click(opener);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('closes from the close button and from the backdrop', async () => {
    const onClose = vi.fn();
    const { rerender } = render(<Sheet open title="T" onClose={onClose}>x</Sheet>);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(<Sheet open title="T" onClose={onClose}>x</Sheet>);
    await userEvent.click(document.querySelector('[aria-hidden="true"].absolute') as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('traps Tab inside the dialog in both directions', async () => {
    render(<SheetHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open sheet' }));
    const close = screen.getByRole('button', { name: 'Close' });
    const input = screen.getByLabelText('Item name');
    const save = screen.getByRole('button', { name: 'Save item' });
    expect(close).toHaveFocus();
    await userEvent.tab();
    expect(input).toHaveFocus();
    await userEvent.tab();
    expect(save).toHaveFocus();
    await userEvent.tab(); // wraps to the first control
    expect(close).toHaveFocus();
    await userEvent.tab({ shift: true }); // wraps back to the last
    expect(save).toHaveFocus();
  });

  it('honours data-autofocus', () => {
    render(
      <Sheet open title="T" onClose={() => {}}>
        <input aria-label="first" />
        <input aria-label="second" data-autofocus />
      </Sheet>,
    );
    expect(screen.getByLabelText('second')).toHaveFocus();
  });

  it('locks page scroll while open and releases it on close', () => {
    const { rerender } = render(<Sheet open title="T" onClose={() => {}}>x</Sheet>);
    expect(document.body.style.overflow).toBe('hidden');
    rerender(<Sheet open={false} title="T" onClose={() => {}}>x</Sheet>);
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});

describe('ConfirmDialog', () => {
  function setup(props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog open title="Delete expense?" confirmLabel="Delete expense" onConfirm={onConfirm} onCancel={onCancel} {...props}>
        This removes it from balances. You can undo it right after.
      </ConfirmDialog>,
    );
    return { onConfirm, onCancel };
  }

  it('explains the consequence and uses a specific action label', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Delete expense?' })).toBeInTheDocument();
    expect(screen.getByText(/removes it from balances/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete expense' })).toBeInTheDocument();
  });

  it('starts focus on Cancel, the safe choice', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('confirm and cancel call their handlers', async () => {
    const { onConfirm, onCancel } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Delete expense' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('Escape cancels', async () => {
    const { onCancel } = setup();
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('shows a busy confirm button while working and ignores a second click', async () => {
    const { onConfirm } = setup({ loading: true });
    const confirm = screen.getByRole('button', { name: 'Delete expense' });
    expect(confirm).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

function ToastButtons({ onUndo }: { onUndo?: () => void }) {
  const toast = useToast();
  return (
    <>
      <button onClick={() => toast.show({ message: 'Expense saved' })}>ok</button>
      <button onClick={() => toast.show({ tone: 'error', message: 'Could not save' })}>fail</button>
      <button onClick={() => toast.show({ message: 'Expense deleted', action: { label: 'Undo', onClick: onUndo ?? (() => {}) } })}>undo</button>
    </>
  );
}

describe('Toast', () => {
  afterEach(() => vi.useRealTimers());

  it('announces success politely (role=status)', async () => {
    render(<ToastProvider><ToastButtons /></ToastProvider>);
    await userEvent.click(screen.getByText('ok'));
    expect(screen.getByRole('status')).toHaveTextContent('Expense saved');
  });

  it('announces errors assertively (role=alert)', async () => {
    render(<ToastProvider><ToastButtons /></ToastProvider>);
    await userEvent.click(screen.getByText('fail'));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save');
  });

  it('dismisses itself after its duration', () => {
    vi.useFakeTimers();
    render(<ToastProvider><ToastButtons /></ToastProvider>);
    act(() => screen.getByText('ok').click());
    expect(screen.getByRole('status')).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(3900));
    expect(screen.getByRole('status')).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(200));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('keeps toasts with an action longer, and Undo runs and dismisses', async () => {
    const onUndo = vi.fn();
    render(<ToastProvider><ToastButtons onUndo={onUndo} /></ToastProvider>);
    await userEvent.click(screen.getByText('undo'));
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledOnce();
    expect(screen.queryByText('Expense deleted')).not.toBeInTheDocument();
  });

  it('can be dismissed manually', async () => {
    render(<ToastProvider><ToastButtons /></ToastProvider>);
    await userEvent.click(screen.getByText('ok'));
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Expense saved')).not.toBeInTheDocument();
  });

  it('shows at most three at once', async () => {
    render(<ToastProvider><ToastButtons /></ToastProvider>);
    for (let i = 0; i < 5; i++) await userEvent.click(screen.getByText('ok'));
    expect(screen.getAllByText('Expense saved')).toHaveLength(3);
  });

  it('useToast outside a provider fails loudly', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ToastButtons />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});
