import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AmountInput } from './AmountInput';

function Harness({ initial = null, onValue }: { initial?: number | null; onValue?: (v: number | null) => void }) {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <>
      <AmountInput
        label="Total amount"
        currency="INR"
        valueMinor={value}
        onChange={(m) => {
          setValue(m);
          onValue?.(m);
        }}
      />
      <button type="button" onClick={() => setValue(null)}>
        reset
      </button>
    </>
  );
}

describe('AmountInput', () => {
  it('shows the currency in the label', () => {
    render(<Harness />);
    expect(screen.getByLabelText(/Total amount/)).toBeInTheDocument();
    expect(screen.getByText('(INR)')).toBeInTheDocument();
  });

  it.each([
    ['1000', 100000],
    ['1,000.50', 100050],
    ['0.01', 1],
    ['12.5', 1250],
  ])('typing %s reports %i minor units (integers, no floats)', async (typed, minor) => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await userEvent.type(screen.getByLabelText(/Total amount/), typed);
    expect(onValue).toHaveBeenLastCalledWith(minor);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each(['abc', '0', '1.234', '-5', '100000000.01'])('rejects %s with a message and null', async (typed) => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    await userEvent.type(screen.getByLabelText(/Total amount/), typed);
    expect(onValue).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole('alert')).toHaveTextContent('Enter an amount like 1,250.50.');
    expect(screen.getByLabelText(/Total amount/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('formats an initial value from minor units', () => {
    render(<Harness initial={100050} />);
    expect(screen.getByLabelText(/Total amount/)).toHaveValue('1000.50');
  });

  it('does not rewrite what the user is typing', async () => {
    render(<Harness />);
    const input = screen.getByLabelText(/Total amount/);
    await userEvent.type(input, '12.');
    expect(input).toHaveValue('12.');
  });

  it('follows an external reset', async () => {
    render(<Harness initial={500} />);
    await userEvent.click(screen.getByRole('button', { name: 'reset' }));
    expect(screen.getByLabelText(/Total amount/)).toHaveValue('');
  });

  it('shows a server error passed in', () => {
    render(<AmountInput label="Amount" currency="INR" valueMinor={100} onChange={() => {}} error="Too large" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Too large');
  });

  it('uses zero decimals for currencies without minor units', async () => {
    const onValue = vi.fn();
    render(<AmountInput label="Amount" currency="JPY" valueMinor={null} onChange={onValue} />);
    await userEvent.type(screen.getByLabelText(/Amount/), '500');
    expect(onValue).toHaveBeenLastCalledWith(500, '500');
    await userEvent.type(screen.getByLabelText(/Amount/), '.5');
    expect(onValue).toHaveBeenLastCalledWith(null, '500.5');
  });
});
