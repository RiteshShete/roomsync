import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { PASSWORD, localKeys, uniqueEmail } from './helpers';

test.describe.configure({ timeout: 90_000 });

async function signedUp(label: string): Promise<SupabaseClient> {
  const { url, key } = localKeys();
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signUp({ email: uniqueEmail(label), password: PASSWORD, options: { data: { display_name: label } } });
  expect(error).toBeNull();
  // Outside a browser the client does not hand the new session to the realtime socket by itself.
  await client.realtime.setAuth(data.session!.access_token);
  return client;
}

/** Subscribes to every table the app listens to, for one household, and resolves once the server confirms. */
async function listen(client: SupabaseClient, householdId: string, tables: string[]) {
  const seen: { table: string }[] = [];
  let channel = client.channel(`probe:${householdId}:${Math.random()}`);
  for (const table of tables) {
    channel = channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `household_id=eq.${householdId}` }, () => seen.push({ table }));
  }
  await new Promise<void>((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve();
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(`channel ${status}`));
    });
  });
  return { seen, stop: () => client.removeChannel(channel) };
}

test('Realtime respects row-level security: an outsider receives nothing, a member receives the change', async () => {
  const tables = ['grocery_items', 'announcements', 'activity_events', 'chores'];
  const owner = await signedUp('rt-owner');
  const outsider = await signedUp('rt-outsider');

  const { data: householdId, error } = await owner.rpc('create_household', { p_name: 'Realtime RLS' });
  expect(error).toBeNull();
  const { data: me } = await owner.from('household_members').select('id').eq('household_id', householdId as string).single();

  const member = await listen(owner, householdId as string, tables);
  const stranger = await listen(outsider, householdId as string, tables);

  const added = await owner.from('grocery_items').insert({ household_id: householdId as string, name: 'Secret milk', added_by_member_id: me!.id });
  expect(added.error).toBeNull();
  const posted = await owner.from('announcements').insert({ household_id: householdId as string, title: 'Private notice', body: 'Members only', created_by: (await owner.auth.getUser()).data.user!.id });
  expect(posted.error).toBeNull();

  await expect.poll(() => member.seen.length, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
  await new Promise((r) => setTimeout(r, 3000)); // give a leak every chance to show up
  expect(stranger.seen).toEqual([]);

  await member.stop();
  await stranger.stop();
});
