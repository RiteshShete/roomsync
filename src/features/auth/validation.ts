import { z } from 'zod';
import { copy } from '@/copy';

export type FormErrors = Record<string, string>;
export type Validated<T> = { ok: true; data: T } | { ok: false; errors: FormErrors };

const v = copy.validation;

const email = z.string().trim().min(1, v.emailRequired).pipe(z.email(v.emailInvalid));
const password = z.string().min(1, v.passwordRequired).min(8, v.passwordShort);
const confirm = z.string().min(1, v.confirmRequired);

export const signUpSchema = z
  .object({
    displayName: z.string().trim().min(1, v.nameRequired).max(60, v.nameTooLong),
    email,
    password,
    confirm,
  })
  .refine((x) => x.password === x.confirm, { path: ['confirm'], message: v.confirmMismatch });

export const logInSchema = z.object({ email, password: z.string().min(1, v.passwordRequired) });
export const forgotSchema = z.object({ email });
export const resetSchema = z
  .object({ password, confirm })
  .refine((x) => x.password === x.confirm, { path: ['confirm'], message: v.confirmMismatch });

/** Runs a schema and returns one message per field (the first problem), or the parsed data. */
export function validate<S extends z.ZodType>(schema: S, values: unknown): Validated<z.infer<S>> {
  const result = schema.safeParse(values);
  if (result.success) return { ok: true, data: result.data };
  const errors: FormErrors = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!(key in errors)) errors[key] = issue.message;
  }
  return { ok: false, errors };
}

/** Moves focus to the first invalid field so keyboard and screen-reader users land on the problem. */
export function focusFirstError(ids: Record<string, string>, errors: FormErrors): void {
  const first = Object.keys(ids).find((k) => k in errors);
  if (first) requestAnimationFrame(() => document.getElementById(ids[first]!)?.focus());
}
