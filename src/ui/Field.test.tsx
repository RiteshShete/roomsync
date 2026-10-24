import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Field, PasswordField } from './Field';

describe('Field', () => {
  it('labels the input', () => {
    render(<Field label="Email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('ties hint and error to the input and announces the error', () => {
    render(<Field label="Email" hint="We never share it" error="Enter a valid email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('We never share it Enter a valid email');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email');
  });

  it('shows no alert and is valid without an error', () => {
    render(<Field label="Email" />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid');
  });

  it('marks optional fields in the label', () => {
    render(<Field label="Note" optional />);
    expect(screen.getByText('(optional)')).toBeInTheDocument();
  });

  it('accepts typing', async () => {
    render(<Field label="Name" defaultValue="" />);
    await userEvent.type(screen.getByLabelText('Name'), 'Aarav');
    expect(screen.getByLabelText('Name')).toHaveValue('Aarav');
  });
});

describe('PasswordField', () => {
  it('hides the password and toggles visibility with an accessible button', async () => {
    render(<PasswordField label="Password" />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('announces its error', () => {
    render(<PasswordField label="Password" error="Use at least 8 characters." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Use at least 8 characters.');
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
  });
});
