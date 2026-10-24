import { describe, expect, it } from 'vitest';
import { copy } from '@/copy';
import { errorMessage, toAppError } from './errors';

describe('toAppError', () => {
  it.each([
    // database vocabulary (PLAN §6)
    [{ message: 'permission_denied' }, { code: 'permission_denied' }],
    [{ message: 'not_found' }, { code: 'not_found' }],
    [{ message: 'conflict' }, { code: 'conflict' }],
    [{ message: 'already_member' }, { code: 'already_member' }],
    [{ message: 'household_archived' }, { code: 'household_archived' }],
    [{ message: 'owner_must_transfer' }, { code: 'owner_must_transfer' }],
    [{ message: 'sole_member' }, { code: 'sole_member' }],
    [{ message: 'currency_locked' }, { code: 'currency_locked' }],
    [{ message: 'later_occurrence_completed' }, { code: 'later_occurrence_completed' }],
    [{ message: 'invalid_invite:expired' }, { code: 'invalid_invite', detail: 'expired' }],
    [{ message: 'invalid_invite:throttled' }, { code: 'invalid_invite', detail: 'throttled' }],
    [{ message: 'validation:amount:out_of_range' }, { code: 'validation', field: 'amount', detail: 'out_of_range' }],
    [{ message: 'validation:shares:sum_mismatch', code: '23514' }, { code: 'validation', field: 'shares', detail: 'sum_mismatch' }],
    // Postgres / PostgREST codes
    [{ message: 'permission denied for table expenses', code: '42501' }, { code: 'permission_denied' }],
    [{ message: 'duplicate key value', code: '23505' }, { code: 'conflict' }],
    // auth
    [{ message: 'Invalid login credentials', code: 'invalid_credentials' }, { code: 'auth_invalid_credentials' }],
    [{ message: 'User already registered', code: 'user_already_exists' }, { code: 'auth_email_taken' }],
    [{ message: 'Password should be at least 8 characters', code: 'weak_password' }, { code: 'auth_weak_password' }],
    [{ message: 'email rate limit exceeded', code: 'over_email_send_rate_limit' }, { code: 'auth_rate_limited' }],
    // network
    [new TypeError('Failed to fetch'), { code: 'network' }],
    [{ name: 'AuthRetryableFetchError', message: 'x' }, { code: 'network' }],
    [{ message: 'NetworkError when attempting to fetch resource.' }, { code: 'network' }],
    // anything else
    [{ message: 'duplicate key value violates unique constraint "x_pkey"', code: 'XX000' }, { code: 'unknown' }],
    [new Error('boom'), { code: 'unknown' }],
    ['permission_denied', { code: 'permission_denied' }],
    [null, { code: 'unknown' }],
    [undefined, { code: 'unknown' }],
  ])('maps %j', (input, expected) => {
    expect(toAppError(input)).toEqual(expected);
  });
});

describe('toAppError is idempotent', () => {
  it('keeps the code of an error that was already mapped (api wrappers throw mapped errors)', () => {
    expect(toAppError(toAppError({ message: 'conflict' }))).toEqual({ code: 'conflict' });
    expect(toAppError(toAppError({ message: 'permission_denied' }))).toEqual({ code: 'permission_denied' });
    expect(toAppError(toAppError({ message: 'later_occurrence_completed' }))).toEqual({ code: 'later_occurrence_completed' });
  });
});

describe('errorMessage', () => {
  it.each([
    [{ message: 'permission_denied' }, copy.errors.permission],
    [{ message: 'not_found' }, copy.errors.notFound],
    [{ message: 'conflict' }, copy.errors.conflict],
    [{ message: 'household_archived' }, copy.errors.householdArchived],
    [{ message: 'owner_must_transfer' }, copy.errors.ownerMustTransfer],
    [{ message: 'sole_member' }, copy.errors.soleMember],
    [{ message: 'currency_locked' }, copy.errors.currencyLocked],
    [{ message: 'later_occurrence_completed' }, copy.errors.laterOccurrenceCompleted],
    [{ message: 'invalid_invite:not_found' }, copy.errors.invite.not_found],
    [{ message: 'invalid_invite:revoked' }, copy.errors.invite.revoked],
    [{ message: 'invalid_invite:expired' }, copy.errors.invite.expired],
    [{ message: 'invalid_invite:used_up' }, copy.errors.invite.used_up],
    [{ message: 'invalid_invite:household_archived' }, copy.errors.invite.household_archived],
    [{ message: 'invalid_invite:household_full' }, copy.errors.invite.household_full],
    [{ message: 'invalid_invite:throttled' }, copy.errors.invite.throttled],
    [{ message: 'invalid_invite:something_new' }, copy.errors.inviteInvalid],
    [{ message: 'validation:title:required' }, copy.errors.save],
    [new TypeError('Failed to fetch'), copy.errors.network],
    [{ message: 'Invalid login credentials' }, copy.errors.invalidCredentials],
    [{ message: 'raw database text with secrets', code: 'XX000' }, copy.errors.generic],
    [new Error('boom'), copy.errors.generic],
  ])('turns %j into friendly copy', (input, expected) => {
    expect(errorMessage(input)).toBe(expected);
  });

  it('accepts an already-mapped AppError', () => {
    expect(errorMessage({ code: 'permission_denied' })).toBe(copy.errors.permission);
    expect(errorMessage(toAppError({ message: 'conflict' }))).toBe(copy.errors.conflict);
  });

  it('never leaks raw error text', () => {
    const msg = errorMessage({ message: 'relation "secret_table" does not exist', code: '42P01' });
    expect(msg).toBe(copy.errors.generic);
    expect(msg).not.toMatch(/secret_table/);
  });

  it('uses the spec §16 wording for the core messages', () => {
    expect(copy.errors.generic).toBe('Something went wrong. Please try again.');
    expect(copy.errors.permission).toBe('You don’t have permission to make this change.');
    expect(copy.errors.save).toBe('We couldn’t save that change. Your information is still here—please try again.');
  });
});
