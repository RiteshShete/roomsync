/**
 * Client environment. Only the Supabase URL and the *publishable* key may reach the bundle
 * (CLAUDE.md rule 3). A secret/service key supplied by mistake is rejected rather than shipped.
 */
export type EnvResult =
  | { ok: true; url: string; publishableKey: string }
  | { ok: false; missing: string[]; secretKey: boolean };

type Source = Record<string, string | undefined>;

function looksSecret(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;
  // Legacy JWT keys: check the role claim without trusting the signature.
  const parts = key.split('.');
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/'))) as { role?: string };
      return payload.role === 'service_role';
    } catch {
      return false;
    }
  }
  return false;
}

export function readEnv(source: Source = import.meta.env as Source): EnvResult {
  const url = source.VITE_SUPABASE_URL?.trim();
  const key = source.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  const missing: string[] = [];
  if (!url) missing.push('VITE_SUPABASE_URL');
  if (!key) missing.push('VITE_SUPABASE_PUBLISHABLE_KEY');
  if (missing.length > 0) return { ok: false, missing, secretKey: false };
  if (looksSecret(key!)) return { ok: false, missing: [], secretKey: true };
  try {
    new URL(url!);
  } catch {
    return { ok: false, missing: ['VITE_SUPABASE_URL (not a valid URL)'], secretKey: false };
  }
  return { ok: true, url: url!, publishableKey: key! };
}
