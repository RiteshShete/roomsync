#!/usr/bin/env node
/**
 * One command for "is everything green?":
 *
 *   npm run verify            typecheck, unit tests, build, database tests, query plans, end-to-end tests
 *   npm run verify -- --reset also rebuilds the local database from the migrations first (WIPES local data,
 *                             including the seeded demo household; this is what CI does on a fresh stack)
 *
 * It starts the local Supabase stack if needed (Docker must be running) and creates `.env.local` from the
 * stack's own local keys if it is missing. Local keys only: it refuses to do anything else.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';

const reset = process.argv.includes('--reset');
const run = (cmd, capture = false) => spawnSync(cmd, { shell: true, stdio: capture ? 'pipe' : 'inherit', encoding: 'utf8' });

function prepare() {
  console.log('\n== Preparing the local stack');
  if (run('docker info', true).status !== 0) {
    console.error('Docker is not running. Start Docker Desktop, wait until it says it is running, then run this again.');
    process.exit(2);
  }
  if (run('npx supabase start').status !== 0) {
    console.error('Could not start the local Supabase stack (npx supabase start).');
    process.exit(2);
  }
  if (reset && run('npx supabase db reset').status !== 0) {
    console.error('Could not reset the local database.');
    process.exit(2);
  }
  if (!existsSync('.env.local')) {
    const status = run('npx supabase status -o env', true).stdout ?? '';
    const get = (k) => new RegExp(`^${k}="?([^"\\r\\n]*)"?$`, 'm').exec(status)?.[1];
    const url = get('API_URL');
    const key = get('PUBLISHABLE_KEY');
    if (!url || !key || !/^https?:\/\/(127\.0\.0\.1|localhost)/.test(url)) {
      console.error('Could not read the local URL and publishable key from `supabase status`.');
      process.exit(2);
    }
    writeFileSync('.env.local', `VITE_SUPABASE_URL=${url}\nVITE_SUPABASE_PUBLISHABLE_KEY=${key}\n`);
    console.log('Created .env.local from the local stack (URL and publishable key only).');
  }
}

const STEPS = [
  ['typecheck', 'npm run typecheck'],
  ['unit tests', 'npm test'],
  ['build', 'npm run build'],
  ['database tests (pgTAP)', 'npm run db:test'],
  ['query plans', 'npm run db:explain'],
  ['end-to-end tests', 'npm run e2e'],
];

prepare();
const results = [];
for (const [name, cmd] of STEPS) {
  console.log(`\n== ${name}: ${cmd}`);
  const started = Date.now();
  const ok = run(cmd).status === 0;
  results.push([name, ok, ((Date.now() - started) / 1000).toFixed(0)]);
  if (!ok) break; // the first failure is the one to fix
}

console.log('\n== Summary');
for (const [name, ok, secs] of results) console.log(`${ok ? '  PASS' : '  FAIL'}  ${name.padEnd(26)} ${secs}s`);
const skipped = STEPS.slice(results.length).map(([n]) => n);
for (const n of skipped) console.log(`  skip  ${n}`);
const failed = results.some(([, ok]) => !ok);
console.log(failed ? '\nNot green.' : '\nAll green.');
process.exit(failed ? 1 : 0);
