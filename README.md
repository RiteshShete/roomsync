# RoomSync

Shared living, simplified. Shared expenses, chores, groceries, announcements and move-out in one mobile-first app.

> Status: Phase 5 of 13 (expenses and settlements). You can create or join a household, add and split expenses (equal, custom, percentage), see balances and suggested payments, and record, reverse or dispute settlements. Chores, groceries, the activity centre and move-out arrive phase by phase. See `PLAN.md` and `PROGRESS.md`.

## Prerequisites
- Node 22+ (`node -v`)
- Git
- Docker Desktop, running (`docker info`)
- The Supabase CLI is a dev dependency: `npx supabase --version`

## One-time setup
```bash
npm ci
npx supabase start          # first run pulls images
npx supabase status         # shows the API URL and keys
cp .env.example .env.local  # then paste the *publishable* key (never the secret key)
npx playwright install chromium   # only needed for end-to-end tests (Phase 4+)
```

## Daily commands
| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server at http://localhost:5173 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit and component tests |
| `npm run build` | Typecheck + production build |
| `npm run e2e` | Playwright end-to-end tests against the local stack (starts the dev server itself) |
| `npm run db:reset` | Re-apply all migrations from zero |
| `npm run db:test` | pgTAP tests (`supabase/tests`) |
| `npm run db:types` | Regenerate `src/lib/database.types.ts` |
| `npm run seed:dev` | Create four test users and the demo household "Flat 4B" (local only) |
| `npx supabase stop` | Stop the local stack |

## Trying it locally
1. `npx supabase start`, then `npm run dev`, and open http://localhost:5173.
2. Sign up with any email. Local email confirmation is off, so you are signed in straight away and land on "Set up your household". Choose **Create a household**, or **Join a household** with a code from someone else (You → Invite roommates shows codes once).
3. Or run `npm run seed:dev` and log in as `aarav@roomsync.test` with password `roomsync-local-1` (also riya, kunal, sneha). These accounts exist on your local stack only.
4. Password-reset emails are caught by the local mail inbox at http://127.0.0.1:54324.

## Environment variables
Only the Supabase URL and the *publishable* key reach client code. The app refuses to start (with a readable screen) if a secret/service key is supplied. Never commit `.env*` except `.env.example`, and never give a secret key a `VITE_` prefix. The seed script reads the local secret key at run time from `supabase status`; it never writes it anywhere and refuses non-local URLs.

## Known limitations
RoomSync never moves money: settlements are *recorded*, not sent. There are no push notifications, receipt OCR or AI features. Nothing is saved while offline. More detail is added in Phase 9.
