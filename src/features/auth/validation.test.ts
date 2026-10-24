import { describe, expect, it } from 'vitest';
import { copy } from '@/copy';
import { forgotSchema, logInSchema, resetSchema, signUpSchema, validate } from './validation';

const good = { displayName: 'Aarav', email: 'aarav@example.com', password: 'longenough', confirm: 'longenough' };

describe('sign-up validation', () => {
  it('accepts valid input and trims name and email', () => {
    const r = validate(signUpSchema, { ...good, displayName: '  Aarav  ', email: '  aarav@example.com ' });
    expect(r).toEqual({ ok: true, data: { ...good } });
  });

  it('asks for everything when empty (one message per field)', () => {
    const r = validate(signUpSchema, { displayName: '', email: '', password: '', confirm: '' });
    expect(r).toEqual({
      ok: false,
      errors: {
        displayName: copy.validation.nameRequired,
        email: copy.validation.emailRequired,
        password: copy.validation.passwordRequired,
        confirm: copy.validation.confirmRequired,
      },
    });
  });

  it.each(['plain', 'a@', '@b.com', 'a b@c.com', 'a@b'])('rejects email %j', (email) => {
    const r = validate(signUpSchema, { ...good, email });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.email).toBe(copy.validation.emailInvalid);
  });

  it('requires at least 8 characters', () => {
    const r = validate(signUpSchema, { ...good, password: 'short', confirm: 'short' });
    expect(r).toMatchObject({ ok: false, errors: { password: copy.validation.passwordShort } });
  });

  it('accepts exactly 8 characters', () => {
    expect(validate(signUpSchema, { ...good, password: '12345678', confirm: '12345678' }).ok).toBe(true);
  });

  it('flags mismatched confirmation on the confirm field', () => {
    const r = validate(signUpSchema, { ...good, confirm: 'different1' });
    expect(r).toMatchObject({ ok: false, errors: { confirm: copy.validation.confirmMismatch } });
  });

  it('limits the display name to 60 characters', () => {
    expect(validate(signUpSchema, { ...good, displayName: 'x'.repeat(60) }).ok).toBe(true);
    expect(validate(signUpSchema, { ...good, displayName: 'x'.repeat(61) })).toMatchObject({
      ok: false,
      errors: { displayName: copy.validation.nameTooLong },
    });
  });

  it('treats a whitespace-only name as missing', () => {
    expect(validate(signUpSchema, { ...good, displayName: '   ' })).toMatchObject({
      ok: false,
      errors: { displayName: copy.validation.nameRequired },
    });
  });
});

describe('log-in, forgot and reset validation', () => {
  it('log in needs an email and any password', () => {
    expect(validate(logInSchema, { email: 'a@b.co', password: 'x' }).ok).toBe(true);
    expect(validate(logInSchema, { email: '', password: '' })).toMatchObject({
      ok: false,
      errors: { email: copy.validation.emailRequired, password: copy.validation.passwordRequired },
    });
  });

  it('forgot password needs a valid email', () => {
    expect(validate(forgotSchema, { email: 'a@b.co' }).ok).toBe(true);
    expect(validate(forgotSchema, { email: 'nope' })).toMatchObject({ ok: false, errors: { email: copy.validation.emailInvalid } });
  });

  it('reset enforces length and matching', () => {
    expect(validate(resetSchema, { password: 'longenough', confirm: 'longenough' }).ok).toBe(true);
    expect(validate(resetSchema, { password: 'short', confirm: 'short' })).toMatchObject({ ok: false, errors: { password: copy.validation.passwordShort } });
    expect(validate(resetSchema, { password: 'longenough', confirm: 'nope' })).toMatchObject({ ok: false, errors: { confirm: copy.validation.confirmMismatch } });
  });
});
