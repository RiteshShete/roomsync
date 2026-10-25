# RoomSync architecture

How the code is organised and why. `src/architecture.test.ts` enforces the layering rules below, so they hold as features are added.

## Layers (dependencies point down only)

```
 screens (features/*/XxxScreen.tsx)   what the user sees; no data logic
        │ call
 hooks (features/*/hooks.ts)          TanStack Query: fetching, caching, invalidation
        │ call
 api (src/api/*.ts)                   the ONLY code that talks to Supabase; maps errors
        │ use
 lib (src/lib)                        env, Supabase client, error mapping, formatting
 domain (src/domain)                  pure business rules; no React, no Supabase
 ui (src/ui)                          shared presentational components (no data access)
```

| Folder | Holds | May import |
|---|---|---|
| `src/domain` | money, splits, balances, rotation, chore buckets, notification rules. Pure functions with shared test vectors (the same vectors run in pgTAP, rule 9). | itself, `zod` |
| `src/api` | one file per area (`expenses`, `chores`, `activity`, …). Returns plain typed objects, throws `AppError`. `guard.ts` is the shared optimistic-concurrency tail. | `lib`, `domain` |
| `src/lib` | `env.ts` (the only reader of `import.meta.env`), `supabase.ts`, `errors.ts` (`toAppError`, `errorMessage`), `format.ts`, `download.ts`. | — |
| `src/ui` | Button, Field, Sheet, Toast, Header, … Accessible, themed with CSS-variable tokens. | `copy`, `lib` |
| `src/features/<area>` | one folder per product area: screens, hooks, pure `formModel.ts` modules, tests. | `api`, `domain`, `ui`, `lib`, `copy`, and the shared areas below |
| `src/copy.ts` | every user-visible sentence (so wording is reviewed in one place, and tests assert on it). | — |
| `src/test` | test helpers (`renderApp`, `mockApi`, fixtures). | anything |

Shared feature areas other features may import from: `household` (membership, access, member directory), `shell` (layout, realtime), `auth` (session), `activity` (bell and notification hooks). `you` and `moveout` aggregate other areas' hooks (personal summary; the move-out review).

## Where logic lives (rule 2)

- **Rules** (what is valid, how money splits, who is next) → `src/domain`, unit-tested.
- **Form rules** (is Save enabled, why not, what payload) → a pure `formModel.ts` per form, unit-tested; the screen only renders its result.
- **Server access** → `src/api`, never in a component.
- **Authorisation** → the database (RLS and RPC checks). The UI only explains (disabled button + reason).

## State (rule 7)

- **Server state:** TanStack Query, keyed by household/member, `staleTime: 0` for anything another person can change. Realtime (`shell/useRealtime.ts`) invalidates queries when the household's data changes, and falls back to polling every 30 s if the channel drops; window focus refetches too.
- **Session and access:** React context (`auth/Session`), and `useHouseholdAccess()` derives role, archived state and the reason writes are blocked.
- **Form state:** local to the form; a failed save never clears it.
- No global client store is needed; there is no client-only state that several screens share.

## Storage

No cached or derived data is kept in the database: balances and summaries are computed when asked. Tables that grow on their own are bounded (activity events 90 days, invite attempts one day; see `20261025120001_bounded_storage.sql`), and financial and audit history is never pruned. In the browser, unused query data is dropped after a minute.

## Errors (rule 5)

Every `api/` function throws a mapped `AppError` (`toAppError`), never a raw Supabase error. Screens show `errorMessage(err)` (copy from `copy.ts`) in a retryable error state, a form-level alert, or a toast. Version conflicts and permission refusals are distinguished (`conflict`, `permission_denied`). Best-effort background work (reminder sync, realtime) retries or degrades quietly and never interrupts the user. An error boundary catches render crashes.

## Configuration (rule 6)

Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` reach the browser, read in `lib/env.ts`, which also rejects a secret key. `.env.example` documents them; real values live in `.env.local` (git-ignored). Nothing else is hardcoded.

## Naming (rule 4)

Components and screens `PascalCase.tsx`; hooks `useThing`; modules and helpers `camelCase.ts`; tests next to the code as `Thing.test.ts(x)`; SQL migrations `YYYYMMDDHHMMSS_topic.sql`; database objects `snake_case`; copy keys `camelCase`.

## Adding a feature

1. Table + RLS + isolation test + (if members write directly) guards; or an RPC. Regenerate types (`npm run db:types`).
2. Pure rules in `src/domain` with tests (shared vectors if SQL mirrors them).
3. `src/api/<area>.ts` wrappers (use `guard.ts` for versioned updates).
4. `src/features/<area>`: `hooks.ts`, a `formModel.ts` if there is a form, screens, copy in `copy.ts`.
5. Route in `App.tsx`; loading, empty, error and success states; disabled-with-reason for anything not allowed.
6. Component tests with `mockApi`, a Playwright journey with real accounts, and a mutation check on the rule that matters.
