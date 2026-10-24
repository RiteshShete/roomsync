import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { readEnv } from './env';

export type Supa = SupabaseClient<Database>;

let client: Supa | null = null;

/** Lazily created singleton. Throws only if called when the env is invalid (the app gates on that first). */
export function getSupabase(): Supa {
  if (client) return client;
  const env = readEnv();
  if (!env.ok) throw new Error('Supabase environment is not configured');
  client = createClient<Database>(env.url, env.publishableKey, {
    auth: {
      flowType: 'pkce', // PLAN D11: avoids URL-hash token conflicts with HashRouter
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return client;
}
