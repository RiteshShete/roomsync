import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SelectField } from './SelectField';
import { Toggle } from './Toggle';

const OPTIONS = [
  { value: 'INR', label: 'INR' },
  { value: 'USD', label: 'USD' },
];

describe('SelectField', () => {
  it('is labelled and changes value', async () => {
    const onChange = vi.fn();
    render(<SelectField label="Currency" options={OPTIONS} defaultValue="INR" onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText('Currency'), 'USD');
    expect(onChange).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Currency')).toHaveValue('USD');
  });

  it('disabled: keeps its value, blocks changes, and states why on screen', async () => {
    const onChange = vi.fn();
    render(<SelectField label="Currency" options={OPTIONS} value="INR" onChange={onChange} disabled disabledReason="Locked once money exists." />);
    const select = screen.getByLabelText('Currency');
    expect(select).toHaveAttribute('aria-disabled', 'true');
    expect(select).toHaveAccessibleDescription('Locked once money exists.');
    expect(screen.getByText('Locked once money exists.')).toBeVisible();
    await userEvent.selectOptions(select, 'USD');
    expect(onChange).not.toHaveBeenCalled();
    expect(select).toHaveValue('INR');
  });

  it('announces an error', () => {
    render(<SelectField label="Currency" options={OPTIONS} error="Pick one" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Pick one');
    expect(screen.getByLabelText('Currency')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('Toggle', () => {
  function Harness({ disabled = false }: { disabled?: boolean }) {
    const [on, setOn] = useState(false);
    return <Toggle label="Chore reminders" description="Shows overdue chores." checked={on} onChange={setOn} disabled={disabled} disabledReason="Read-only." />;
  }

  it('is a labelled switch whose state is exposed', async () => {
    render(<Harness />);
    const sw = screen.getByRole('switch', { name: 'Chore reminders' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(sw).toHaveAccessibleDescription('Shows overdue chores.');
    await userEvent.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
    await userEvent.keyboard('{Enter}');
    expect(sw).toHaveAttribute('aria-checked', 'false');
  });

  it('disabled: does not toggle and explains why', async () => {
    render(<Harness disabled />);
    const sw = screen.getByRole('switch', { name: 'Chore reminders' });
    await userEvent.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(sw).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Read-only.')).toBeVisible();
  });
});
