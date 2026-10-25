import { copy } from '@/copy';

/**
 * Error mapper (PLAN §6 error vocabulary + auth). Everything the UI catches goes through
 * `toAppError`, then `errorMessage` for user-facing copy. Unknown errors get a safe generic message;
 * raw database text is never shown to users.
 */
export type AppErrorCode =
  | 'permission_denied'
  | 'not_found'
  | 'conflict'
  | 'validation'
  | 'invalid_invite'
  | 'already_member'
  | 'household_archived'
  | 'owner_must_transfer'
  | 'sole_member'
  | 'currency_locked'
  | 'later_occurrence_completed'
  | 'network'
  | 'auth_invalid_credentials'
  | 'auth_email_taken'
  | 'auth_weak_password'
  | 'auth_rate_limited'
  | 'unknown';

export interface AppError {
  code: AppErrorCode;
  /** validation:<field>:<detail> */
  field?: string;
  /** validation detail, or the invite reason for invalid_invite */
  detail?: string;
}

const VOCABULARY = new Set<AppErrorCode>([
  'permission_denied',
  'not_found',
  'conflict',
  'already_member',
  'household_archived',
  'owner_must_transfer',
  'sole_member',
  'currency_locked',
  'later_occurrence_completed',
]);

function field(obj: unknown, key: string): string | undefined {
  if (obj && typeof obj === 'object' && key in obj) {
    const v = (obj as Record<string, unknown>)[key];
    return typeof v === 'string' ? v : undefined;
  }
  return undefined;
}

export function toAppError(e: unknown): AppError {
  if (isAppError(e)) return e; // already mapped (e.g. thrown by an api/ wrapper): keep its code
  const message = (field(e, 'message') ?? (typeof e === 'string' ? e : '')).trim();
  const code = field(e, 'code');
  const name = field(e, 'name');

  // Network failures (fetch rejects with TypeError; supabase-js wraps some as AuthRetryableFetchError)
  if (
    name === 'AuthRetryableFetchError' ||
    (e instanceof TypeError && /fetch|network|load failed/i.test(message)) ||
    /(failed to fetch|networkerror|load failed|network request failed)/i.test(message)
  ) {
    return { code: 'network' };
  }

  // Database vocabulary
  if (VOCABULARY.has(message as AppErrorCode)) return { code: message as AppErrorCode };
  if (message.startsWith('invalid_invite:')) return { code: 'invalid_invite', detail: message.split(':')[1] };
  if (message.startsWith('validation:')) {
    const [, f, d] = message.split(':');
    return { code: 'validation', field: f, detail: d };
  }

  // Auth (supabase-js AuthApiError codes and messages)
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
    return { code: 'auth_invalid_credentials' };
  }
  if (code === 'user_already_exists' || code === 'email_exists' || /already registered/i.test(message)) {
    return { code: 'auth_email_taken' };
  }
  if (code === 'weak_password' || /password should be at least|weak password/i.test(message)) {
    return { code: 'auth_weak_password' };
  }
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || /rate limit/i.test(message)) {
    return { code: 'auth_rate_limited' };
  }

  // Postgres / PostgREST codes
  if (code === '42501') return { code: 'permission_denied' };
  if (code === '23505') return { code: 'conflict' };

  return { code: 'unknown' };
}

/** User-facing copy for any caught value (an AppError, or a raw error that is mapped first). */
export function errorMessage(e: unknown): string {
  const err = isAppError(e) ? e : toAppError(e);
  switch (err.code) {
    case 'permission_denied':
      return copy.errors.permission;
    case 'not_found':
      return copy.errors.notFound;
    case 'conflict':
      return copy.errors.conflict;
    case 'invalid_invite':
      return copy.errors.invite[err.detail ?? 'not_found'] ?? copy.errors.inviteInvalid;
    case 'already_member':
      return copy.errors.alreadyMember;
    case 'household_archived':
      return copy.errors.householdArchived;
    case 'owner_must_transfer':
      return copy.errors.ownerMustTransfer;
    case 'sole_member':
      return copy.errors.soleMember;
    case 'currency_locked':
      return copy.errors.currencyLocked;
    case 'later_occurrence_completed':
      return copy.errors.laterOccurrenceCompleted;
    case 'network':
      return copy.errors.network;
    case 'auth_invalid_credentials':
      return copy.errors.invalidCredentials;
    case 'auth_email_taken':
      return copy.errors.emailTaken;
    case 'auth_weak_password':
      return copy.errors.weakPassword;
    case 'auth_rate_limited':
      return copy.errors.rateLimited;
    case 'validation':
      return copy.errors.save;
    default:
      return copy.errors.generic;
  }
}

const CODES = new Set<string>([
  ...VOCABULARY,
  'validation',
  'invalid_invite',
  'network',
  'auth_invalid_credentials',
  'auth_email_taken',
  'auth_weak_password',
  'auth_rate_limited',
  'unknown',
]);

function isAppError(e: unknown): e is AppError {
  const c = field(e, 'code');
  return c !== undefined && CODES.has(c) && !field(e, 'message');
}
