# RoomSync

Shared living, simplified. Shared expenses, chores, groceries, announcements and move-out in one mobile-first app.

> **Status:** MVP complete locally (Phase 9 of 13). Everything below works against a local Supabase stack on your own machine. Hosting it for real (Phases 10-12) and the optional extra features (Phase 13) come next. See `PLAN.md` for the plan and `PROGRESS.md` for what was decided and verified in each phase.

## What it does

- **Households:** create one or join with an invite code; owner, admin and member roles; archive and restore.
- **Expenses and settlements:** equal, custom or percentage splits to the smallest currency unit; balances computed in the database; suggested payments; settlements are *recorded*, never sent.
- **Chores:** one-off or recurring, optional rotation, mark done and reopen, in-app reminders.
- **Groceries:** needed and bought lists, duplicate check, soft delete with undo.
- **Announcements, activity and settings:** pinned notices, an activity centre with unread counts, notification preferences, profile, data export.
- **Moving out:** a review of what is outstanding before leaving, with notes and disputes that are never settled automatically.

Plain-language promises the app keeps: it never claims to move money, send push notifications, scan receipts or use AI; every control either works or is disabled with a stated reason; a failed save never clears what you typed.

## Prerequisites

- Node 22 or newer (`node -v`)
- Git
- Docker Desktop, **running** (`docker info` should print details, not an error)
- Nothing else: the Supabase CLI is a dev dependency (`npx supabase --version`)

## One-time setup

```bash
npm ci
npx supabase start               # first run downloads images; takes a few minutes
npx supabase status              # prints the API URL and keys
cp .env.example .env.local       # then paste the *publishable* key (never the secret key)
npx playwright install chromium  # only for the end-to-end tests
```

Then:

```bash
npm run seed:dev   # optional: a demo household with data on every screen
npm run dev        # http://localhost:5173
```

## Trying it

1. Open http://localhost:5173.
2. **With demo data:** after `npm run seed:dev`, log in as `aarav@roomsync.test` with password `roomsync-local-1` (also `riya@`, `kunal@`, `sneha@roomsync.test`, same password). Aarav is the owner, Riya an admin, Kunal and Sneha members. These accounts exist on your local stack only. Use separate browser profiles to be two people at once.
3. **From scratch:** sign up with any email. Local email confirmation is off, so you are signed in straight away. Choose **Create a household**, or **Join a household** with a code (Settings → Invite roommates shows a code once).
4. Password-reset and confirmation emails are caught by the local inbox at http://127.0.0.1:54324.
5. `docs/MANUAL_TEST_GUIDE.md` is a step-by-step script covering every feature.

**On your phone (same Wi-Fi):** find this computer's address (`ipconfig`), then start a second copy of the app that points at it:

```powershell
$env:VITE_SUPABASE_URL = 'http://<your-ip>:54321'
$env:VITE_SUPABASE_PUBLISHABLE_KEY = '<the publishable key>'
npm run dev -- --host 0.0.0.0 --port 5174 --strictPort
```

and open `http://<your-ip>:5174`. If it will not open, Windows may be treating the network as Public and blocking it; set it to Private or allow Node.js through the firewall. The address changes when you join a different network.

## Daily commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server at http://localhost:5173 |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm test` | Vitest unit and component tests, including the architecture and contrast tests |
| `npm run build` | Typecheck + production build |
| `npm run db:test` | pgTAP database tests (`supabase/tests`) |
| `npm run db:explain` | Checks the query plans of every list the app loads, on 30,000+ rows, in a rolled-back transaction |
| `npm run e2e` | Playwright end-to-end tests against the local stack (starts the dev server itself) |
| `npm run verify` | **Everything above in order**, and stops at the first failure. `npm run verify -- --reset` also rebuilds the local database first (wipes local data) |
| `npm run db:reset` | Re-apply all migrations from zero (wipes local data) |
| `npm run db:types` | Regenerate `src/lib/database.types.ts` after a migration |
| `npm run seed:dev` | Create the four demo users and the household "Flat 4B" (local only) |
| `npx supabase stop` | Stop the local stack |

## How the tests fit together

| Layer | Where | What it proves |
|---|---|---|
| Pure rules | `src/domain/*.test.ts` | Money, splits, balances, rotation, notification rules. The same test vectors run in SQL, so the TypeScript and database versions cannot drift apart. |
| Screens | `src/features/**/*.test.tsx` | Loading, empty, error and success states; disabled-with-a-reason controls; a failed save keeps your input. The data layer is mocked. |
| Architecture and contrast | `src/architecture.test.ts`, `src/ui/contrast.test.ts` | Layering rules hold (domain is pure, only `src/api` talks to Supabase, no secrets in client code) and every text colour meets WCAG AA. |
| Database | `supabase/tests/*.test.sql` (pgTAP) | Row-level security, every permission, the RPCs, activity events, reminders, move-out, pruning. |
| Query plans | `scripts/explain-lists.sql` | No list scans a whole table; each runs in well under 50 ms at realistic volumes. |
| Journeys | `e2e/*.spec.ts` | Real browsers and real accounts: households, expenses, chores, groceries, announcements, realtime, move-out, an automated WCAG scan of every screen, keyboard-only use, narrow and zoomed layouts, and failure injection (server errors and dropped connections on every save form). |

CI (`.github/workflows/ci.yml`) runs `npm run verify -- --reset` on every push and pull request.

## Environment variables

Only the Supabase URL and the **publishable** key reach client code (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`; `VITE_BASE_PATH` is for hosted builds). The app refuses to start, with a readable screen, if a secret or service key is supplied. Never commit `.env*` except `.env.example`, and never give a secret key a `VITE_` prefix. The seed script and the end-to-end setup read the *local* secret key at run time from `supabase status`; they never write it anywhere and refuse non-local URLs.

## Project layout

```
src/domain      pure business rules (no React, no Supabase)
src/api         the only code that talks to Supabase
src/lib         env, Supabase client, error mapping, formatting
src/ui          shared presentational components
src/features    one folder per product area: screens, hooks, form rules, tests
src/copy.ts     every user-visible sentence
supabase/       migrations and pgTAP tests
e2e/            Playwright journeys
scripts/        seed, verify, query-plan checks
docs/           architecture, security review, manual test guide, product spec
```

`docs/ARCHITECTURE.md` explains the layers, where logic lives, state, errors, naming and how to add a feature.

## Who can do what

The database enforces this (row-level security and function checks); hiding a button is never the protection.

| Action | Owner | Admin | Member |
|---|---|---|---|
| Read household data | yes | yes | yes (own household only) |
| Edit household settings | yes | yes (not the currency once money exists) | no |
| Archive or restore the household, transfer ownership, change roles | yes | no | no |
| Create or revoke invites | yes | yes | no |
| Add an expense | yes | yes | yes |
| Edit, delete or restore an expense | any | any | only ones they created |
| Record a settlement | yes | yes | only if they are the payer or the recipient |
| Reverse a settlement | any | any | only one they recorded |
| Dispute a settlement | yes | yes | only if they are the other party and did not record it |
| Create a chore | yes | yes | yes |
| Edit or reassign a chore | any | any | creator or assignee |
| Complete or reopen a chore | any | any | assignee or creator; anyone if unassigned |
| Cancel a chore | any | any | creator |
| Grocery add, edit, buy, delete | yes | yes | yes |
| Post an announcement | yes | yes | yes |
| Edit or delete an announcement | any | any | own |
| Pin an announcement | yes | yes | no |
| Start a move-out | self or anyone | self or anyone except the owner | self |

Also: a `left` member can't be added to new expenses or chores but their history stays; an owner can't leave while others are active (transfer first); a sole member archives instead of leaving; an archived household is read-only for everyone.

## Accessibility

Light theme only. Every text colour meets WCAG AA (checked by a test that reads the real colour tokens). Touch targets are at least 44 px. Dialogs trap focus, close on Escape and return focus to what opened them. Toasts are announced politely and errors assertively. Animations stop under `prefers-reduced-motion`. Layouts hold at 320 px, at 200% text size and with the on-screen keyboard open, and the main screens have no automated WCAG A/AA violations (`e2e/a11y.spec.ts`).

## Known limitations

- **No real payments.** Settlements are recorded after people pay each other themselves; the app never moves money or computes deposits, and it never says a payment was "sent".
- **No push, email or SMS notifications.** Reminders and updates are in the app only: a chore reminder appears the first time someone opens the app that day, because there is no scheduler. Quiet hours only hide the unread number on the bell.
- **No receipt scanning, no AI features, no chat.**
- **Nothing is saved while offline.** A banner says so, and a save attempted offline fails with a message and keeps what you typed. There is no offline queue.
- **Activity events are readable by every member of the household** (security is per household, not per recipient). They hold titles and amounts only, never free text such as announcement messages.
- **Deleting an account is not self-service yet.** The Privacy page says so and explains the steps.
- **Free-tier hosting.** When hosted (Phases 10-12) the free Supabase plan limits storage, users and project activity and pauses idle projects, and its built-in email sender has a low hourly limit. Check the current limits on the pricing page. Storage is kept small on purpose: no cached copies of data, activity older than 90 days is pruned, and financial history is never pruned.
- **Local only for now.** The hosted project and the public website are Phases 10-12.

## Troubleshooting

| Problem | What to do |
|---|---|
| `npx supabase start` fails or hangs | Docker Desktop must be running (`docker info`). On a first run it downloads images, which can take several minutes. |
| The app shows "RoomSync isn't configured" | `.env.local` is missing or wrong. Copy `.env.example` to `.env.local` and paste the publishable key from `npx supabase status`. A secret key is rejected on purpose. |
| Blank or "couldn't reach RoomSync" in the browser | The local stack is not running (`npx supabase status`), or the URL in `.env.local` points somewhere else. |
| Port 5173 is already in use | Another dev server is running. Stop it, or use `npm run dev -- --port 5175`. |
| Ports 54321-54329 are in use | Another Supabase project is running. Stop it (`npx supabase stop` in that project). |
| Changes by another person don't appear live | The live channel falls back to refreshing every 30 seconds and when you return to the tab. A hard reload also works. |
| Seed says "Already seeded" | Run `npm run db:reset`, then `npm run seed:dev` for a clean slate (this wipes local data). |
| `npm run verify` fails at the database step | Run `npm run db:reset`, or `npm run verify -- --reset`. |
| End-to-end tests fail strangely right after your PC slept or changed network | Re-run; a dropped connection mid-test is not an app failure. |
| Git prints "LF will be replaced by CRLF" | Harmless on Windows. |
| A phone on the same Wi-Fi can't open the app | See "On your phone" above: the firewall or a different network is the usual cause. |
