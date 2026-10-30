#!/usr/bin/env node
/**
 * Runs scripts/explain-lists.sql against the LOCAL database (inside a rolled-back transaction) and fails if a
 * list the app loads would scan a whole big table or take too long.
 *
 *   npm run db:explain
 *
 * Needs the local stack running (`npx supabase start`). Refuses anything that is not the local container.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const CONTAINER = 'supabase_db_roomsync';
const BIG = ['expenses', 'activity_events', 'chores', 'grocery_items', 'announcements', 'audit_events'];
const MAX_MS = 50;

let out;
try {
  out = execFileSync('docker', ['exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-q', '-v', 'ON_ERROR_STOP=1'], {
    input: readFileSync(new URL('./explain-lists.sql', import.meta.url)),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 20 * 1024 * 1024,
  });
} catch (err) {
  console.error(`explain-check: could not run against ${CONTAINER}. Is the local stack running (npx supabase start)?\n${err.stderr ?? err.message}`);
  process.exit(2);
}

const problems = [];
let current = '(start)';
const rows = [];
for (const line of out.split(/\r?\n/)) {
  const section = /^=== (.*)$/.exec(line);
  if (section) current = section[1];
  const seq = /Seq Scan on (\w+)/.exec(line);
  if (seq && BIG.includes(seq[1])) problems.push(`${current}: Seq Scan on ${seq[1]}`);
  const time = /Execution Time: ([\d.]+) ms/.exec(line);
  if (time) {
    rows.push([current, Number(time[1])]);
    if (Number(time[1]) > MAX_MS) problems.push(`${current}: ${time[1]} ms (limit ${MAX_MS} ms)`);
  }
}
for (const [name, ms] of rows) console.log(`${ms.toFixed(2).padStart(8)} ms  ${name}`);
if (rows.length < 9) problems.push(`expected 9 plans, found ${rows.length}`);
if (problems.length) {
  console.error('\nPlan problems:\n- ' + problems.join('\n- '));
  process.exit(1);
}
console.log('\nAll list queries use an index and run in under ' + MAX_MS + ' ms.');
process.exit(0);
