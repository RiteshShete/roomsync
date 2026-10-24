# RoomSync

Shared living, simplified. Shared expenses, chores, groceries, announcements and move-out in one mobile-first app.

> Status: Phase 0 (bootstrap). The app UI is not built yet. See `PLAN.md` and `PROGRESS.md`.

## Prerequisites
- Node 22+ (`node -v`)
- Git
- Docker Desktop, running (`docker info`)
- Supabase CLI is installed as a dev dependency: `npx supabase --version`

## One-time setup
```bash
npm ci
npx supabase start          # first run pulls images
npx supabase status         # shows API URL and publishable key
cp .env.example .env.local  # then paste the publishable key
```

## Daily commands
| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests |
| `npm run build` | Typecheck + production build |
| `npm run db:reset` | Re-apply all migrations from zero |
| `npm run db:test` | pgTAP tests (`supabase/tests`) |
| `npm run db:types` | Regenerate `src/lib/database.types.ts` |
| `npx supabase stop` | Stop the local stack |

## Environment variables
Only the Supabase URL and the publishable key reach client code. Never commit `.env*` except `.env.example`, and never give a secret key a `VITE_` prefix.

## Known limitations
RoomSync never moves money: settlements are *recorded*, not sent. No push notifications, receipt OCR or AI features exist. More detail is added in Phase 9.
