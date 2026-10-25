#!/usr/bin/env node
/**
 * LOCAL DEV SEED. Creates four test users and a demo household through the real auth API and the
 * real RPCs (PLAN D2: no demo mode, no second code path).
 *
 *   npm run seed:dev
 *
 * Safety:
 *  - Refuses to run unless the Supabase URL is localhost / 127.0.0.1.
 *  - The secret key is read from the environment (SUPABASE_SECRET_KEY) or, if unset, from the local
 *    `supabase status` output at run time. It is never written to disk or printed.
 *  - Passwords are fixed and local-only. Never reuse them anywhere else.
 *
 * Reset with `npm run db:reset` first if you want a clean slate; re-running on a seeded database
 * just prints the credentials.
 */
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const PASSWORD = 'roomsync-local-1';
const PEOPLE = [
  { key: 'aarav', name: 'Aarav', email: 'aarav@roomsync.test' },
  { key: 'riya', name: 'Riya', email: 'riya@roomsync.test' },
  { key: 'kunal', name: 'Kunal', email: 'kunal@roomsync.test' },
  { key: 'sneha', name: 'Sneha', email: 'sneha@roomsync.test' },
];

function loadLocalStatus() {
  try {
    const out = execSync('npx supabase status -o env', { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    const env = {};
    for (const line of out.split(/\r?\n/)) {
      const m = /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim());
      if (m) env[m[1]] = m[2];
    }
    return env;
  } catch {
    return {};
  }
}

function fail(message) {
  console.error(`seed-dev: ${message}`);
  process.exit(1);
}

const status = process.env.SUPABASE_SECRET_KEY && process.env.SUPABASE_URL ? {} : loadLocalStatus();
const url = process.env.SUPABASE_URL ?? status.API_URL ?? 'http://127.0.0.1:54321';
const secretKey = process.env.SUPABASE_SECRET_KEY ?? status.SECRET_KEY;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? status.PUBLISHABLE_KEY;

const host = new URL(url).hostname;
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
  fail(`refusing to run against ${host}. This script only seeds a LOCAL Supabase stack.`);
}
if (!secretKey || !publishableKey) {
  fail('could not find the local keys. Start the stack (`npx supabase start`) or set SUPABASE_SECRET_KEY and SUPABASE_PUBLISHABLE_KEY.');
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(url, secretKey, noSession);

/** Throws a readable error for supabase-js { data, error } results. */
function must({ data, error }, what) {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

async function ensureUser(person) {
  const created = await admin.auth.admin.createUser({
    email: person.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: person.name },
  });
  if (created.error && !/already|exists|registered/i.test(created.error.message)) {
    throw new Error(`create ${person.email}: ${created.error.message}`);
  }
  const client = createClient(url, publishableKey, noSession);
  const { data, error } = await client.auth.signInWithPassword({ email: person.email, password: PASSWORD });
  if (error) throw new Error(`sign in ${person.email}: ${error.message}`);
  return { ...person, client, userId: data.user.id };
}

// Same rule as src/domain/splits.ts: remainder goes one minor unit at a time to the first members.
function equalShares(total, ids) {
  const base = Math.floor(total / ids.length);
  const extra = total - base * ids.length;
  return ids.map((id, i) => ({ member_id: id, share_amount_minor: base + (i < extra ? 1 : 0) }));
}
const percentShares = (total, entries) =>
  entries.map((e) => ({ member_id: e.id, share_amount_minor: Math.floor((total * e.bp) / 10000), percent_bp: e.bp }));
const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

async function main() {
  console.log(`Seeding local stack at ${url} …`);
  const users = {};
  for (const p of PEOPLE) users[p.key] = await ensureUser(p);
  const { aarav, riya, kunal, sneha } = users;

  const existing = must(
    await aarav.client.from('household_members').select('id').eq('user_id', aarav.userId).neq('status', 'left'),
    'check existing household',
  );
  if (existing.length > 0) {
    console.log('Already seeded (Aarav already has a household). Run `npm run db:reset` for a clean slate.');
    return printCredentials();
  }

  // Household, invite, joins, roles — through the real RPCs.
  const hid = must(await aarav.client.rpc('create_household', { p_name: 'Flat 4B', p_currency_code: 'INR' }), 'create_household');
  const invite = must(await aarav.client.rpc('create_invite', { p_household_id: hid, p_expires_in_hours: 72 }), 'create_invite');
  for (const u of [riya, kunal, sneha]) {
    const joined = must(await u.client.rpc('join_household', { p_code: invite.code }), `join ${u.name}`);
    if (!joined.ok) throw new Error(`join ${u.name}: ${joined.error}`);
  }
  const members = must(await aarav.client.from('household_members').select('id, user_id').eq('household_id', hid), 'members');
  const mid = Object.fromEntries(Object.values(users).map((u) => [u.key, members.find((m) => m.user_id === u.userId).id]));
  must(await aarav.client.rpc('set_member_role', { p_member_id: mid.riya, p_role: 'admin' }), 'make Riya admin');

  const all = [mid.aarav, mid.riya, mid.kunal, mid.sneha];
  const expense = async (who, title, amount, category, method, shares, date = day(0)) => {
    const id = must(
      await who.client.rpc('add_expense', {
        p_household_id: hid,
        p_title: title,
        p_amount_minor: amount,
        p_category: category,
        p_paid_by_member_id: mid[who.key],
        p_expense_date: date,
        p_split_method: method,
        p_shares: shares,
      }),
      `add_expense ${title}`,
    );
    return id;
  };

  await expense(aarav, 'Rent', 3200000, 'rent', 'equal', equalShares(3200000, all), day(-20));
  await expense(riya, 'Electricity bill', 185000, 'utilities', 'equal', equalShares(185000, all), day(-14));
  await expense(kunal, 'Wi-Fi', 99900, 'internet', 'equal', equalShares(99900, all), day(-12));
  await expense(sneha, 'Groceries', 100000, 'groceries', 'equal', equalShares(100000, [mid.aarav, mid.riya, mid.sneha]), day(-9));
  await expense(aarav, 'Cleaning supplies', 45000, 'household', 'custom', [
    { member_id: mid.aarav, share_amount_minor: 15000 },
    { member_id: mid.riya, share_amount_minor: 10000 },
    { member_id: mid.kunal, share_amount_minor: 10000 },
    { member_id: mid.sneha, share_amount_minor: 10000 },
  ], day(-8));
  await expense(kunal, 'Movie night', 120000, 'entertainment', 'percentage',
    percentShares(120000, [{ id: mid.kunal, bp: 4000 }, { id: mid.aarav, bp: 3000 }, { id: mid.sneha, bp: 3000 }]), day(-6));
  await expense(riya, 'Water cans', 24000, 'household', 'equal', equalShares(24000, all), day(-5));
  await expense(aarav, 'Gas cylinder', 115000, 'utilities', 'equal', equalShares(115000, all), day(-3));
  const pizza = await expense(sneha, 'Pizza', 89900, 'food', 'equal', equalShares(89900, all), day(-2));
  await expense(kunal, 'Dish soap', 12000, 'household', 'equal', equalShares(12000, [mid.kunal, mid.riya]), day(-1));

  // One edit (writes an audit row): the pizza was ₹950, not ₹899.
  must(
    await sneha.client.rpc('edit_expense', {
      p_expense_id: pizza,
      p_expected_version: 1,
      p_title: 'Pizza',
      p_amount_minor: 95000,
      p_category: 'food',
      p_paid_by_member_id: mid.sneha,
      p_expense_date: day(-2),
      p_split_method: 'equal',
      p_shares: equalShares(95000, all),
    }),
    'edit_expense',
  );

  // One recorded settlement (recorded outside the app; RoomSync moves no money).
  must(
    await riya.client.rpc('record_settlement', {
      p_household_id: hid,
      p_from_member_id: mid.riya,
      p_to_member_id: mid.aarav,
      p_amount_minor: 200000,
      p_settlement_date: day(0),
      p_note: 'Paid by UPI outside RoomSync',
    }),
    'record_settlement',
  );

  // Chores: recurring + rotation, plain recurring, one-off, unassigned.
  const chore = async (who, row) =>
    must(
      await who.client.from('chores').insert({ household_id: hid, created_by: who.userId, ...row }).select('id').single(),
      `chore ${row.title}`,
    ).id;
  const trash = await chore(aarav, {
    title: 'Take out the trash',
    assignee_member_id: mid.aarav,
    due_date: day(1),
    recurrence_frequency: 'weekly',
    rotation_member_ids: all,
  });
  await chore(riya, { title: 'Clean the kitchen', assignee_member_id: mid.riya, due_date: day(3), recurrence_frequency: 'weekly' });
  await chore(kunal, { title: 'Pay the electricity bill', assignee_member_id: mid.kunal, due_date: day(1) });
  await chore(sneha, { title: 'Water the plants' });
  // Completing the rotating chore creates next week's occurrence for the next member (Riya).
  must(await aarav.client.rpc('complete_chore', { p_chore_id: trash }), 'complete_chore');

  // Groceries
  const grocery = async (who, row) =>
    must(
      await who.client.from('grocery_items').insert({ household_id: hid, added_by_member_id: mid[who.key], ...row }).select('id').single(),
      `grocery ${row.name}`,
    ).id;
  await grocery(riya, { name: 'Milk', quantity: 2, unit: 'l', category: 'Dairy' });
  await grocery(riya, { name: 'Eggs', quantity: 12, unit: 'pcs', category: 'Dairy' });
  await grocery(aarav, { name: 'Palak', quantity: 1, unit: 'bunch', category: 'Fruits and Veggies', note: 'Fresh and leafy' });
  const bread = await grocery(kunal, { name: 'Bread', category: 'Bakery' });
  must(
    await sneha.client.from('grocery_items').update({ status: 'purchased', purchased_by_member_id: mid.sneha, purchased_at: new Date().toISOString() }).eq('id', bread),
    'purchase bread',
  );

  // Announcements (the second one pinned by the owner)
  await aarav.client.from('announcements').insert({ household_id: hid, created_by: aarav.userId, title: 'Welcome to Flat 4B', body: 'Add your expenses here so we always know who owes what.' });
  const visit = must(
    await aarav.client.from('announcements').insert({ household_id: hid, created_by: aarav.userId, title: 'Landlord visit on Saturday', body: 'He will check the meter around 11am. Please keep the hall clear.' }).select('id').single(),
    'announcement',
  );
  must(await aarav.client.from('announcements').update({ pinned_at: new Date().toISOString() }).eq('id', visit.id), 'pin announcement');

  // ---- More states, so every screen has something to look at ----
  // Expenses: one deleted (soft), so the "Show deleted expenses" filter and Restore have something to show.
  const mistake = await expense(kunal, 'Entered twice by mistake', 50000, 'other', 'equal', equalShares(50000, all), day(-4));
  must(await kunal.client.rpc('delete_expense', { p_expense_id: mistake }), 'delete_expense');

  // Settlements: one reversed, one disputed (with a reason), next to the recorded one above.
  const settle = async (who, from, to, amount, note) =>
    must(
      await who.client.rpc('record_settlement', {
        p_household_id: hid,
        p_from_member_id: mid[from],
        p_to_member_id: mid[to],
        p_amount_minor: amount,
        p_settlement_date: day(-1),
        p_note: note,
      }),
      `record_settlement ${note}`,
    );
  const wrong = await settle(kunal, 'kunal', 'aarav', 10000, 'Recorded the wrong amount');
  must(await kunal.client.rpc('set_settlement_status', { p_settlement_id: wrong, p_status: 'reversed', p_reason: 'Wrong amount' }), 'reverse settlement');
  const disputed = await settle(kunal, 'kunal', 'sneha', 50000, 'Cash for the pizza');
  must(await sneha.client.rpc('set_settlement_status', { p_settlement_id: disputed, p_status: 'disputed', p_reason: 'I did not receive this' }), 'dispute settlement');

  // Chores: due today, overdue, unassigned (above), and a completed one for the history tab.
  await chore(aarav, { title: 'Sweep the hall', assignee_member_id: mid.aarav, due_date: day(0) });
  await chore(riya, { title: 'Take the bins to the street', assignee_member_id: mid.aarav, due_date: day(-3) });
  const filter = await chore(riya, { title: 'Refill the water filter', assignee_member_id: mid.riya, due_date: day(-2) });
  must(await riya.client.rpc('complete_chore', { p_chore_id: filter }), 'complete filter chore');

  // Groceries: one more bought, one deleted, so both tabs and the Undo path have data.
  const rice = await grocery(aarav, { name: 'Basmati rice', quantity: 5, unit: 'kg', category: 'Pantry' });
  must(
    await riya.client.from('grocery_items').update({ status: 'purchased', purchased_by_member_id: mid.riya, purchased_at: new Date().toISOString() }).eq('id', rice),
    'purchase rice',
  );
  const soap = await grocery(kunal, { name: 'Hand soap', quantity: 3, category: 'Household' });
  must(await kunal.client.from('grocery_items').update({ deleted_at: new Date().toISOString() }).eq('id', soap), 'delete soap');

  // A notice from a plain member, and Riya (admin) has already read her first updates.
  await kunal.client.from('announcements').insert({ household_id: hid, created_by: kunal.userId, title: 'Movie night Friday?', body: 'Thinking of a movie night this Friday. Shout if you are in.' });
  must(await riya.client.rpc('mark_all_activity_read', { p_household_id: hid }), 'Riya reads her updates');

  console.log(
    'Seeded: household "Flat 4B" with 4 members (Aarav owner, Riya admin, Kunal and Sneha members), 11 expenses (1 edited, 1 deleted), ' +
      '3 settlements (recorded, reversed, disputed), 8 chores (today, overdue, upcoming, unassigned, completed), 5 groceries (needed, bought, deleted), 3 announcements (1 pinned).',
  );
  printCredentials();
}

function printCredentials() {
  console.log('\nLocal test accounts (local stack only):');
  for (const p of PEOPLE) console.log(`  ${p.name.padEnd(6)} ${p.email}  /  ${PASSWORD}`);
}

main().catch((err) => fail(err.message));
