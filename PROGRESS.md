# RoomSync — Progress

Read this at the start of every session; update it at the end.

## Status
| Phase | State |
|---|---|
| 0 Bootstrap | Done — awaiting owner "continue" |
| 1–13 | Not started |

## Decisions and deviations (Phase 0)
- **No starter zip.** `src/domain` (money, splits, balances, dates, rotation, invites, types) was written from scratch with 49 Vitest tests, instead of the 42 the plan assumed. These are the shared vectors that the pgTAP tests in Phase 2 must mirror.
- **Node 24.19.0** installed locally (plan targets 22). `engines` is `>=22`. CI will use 22.
- **Supabase CLI as an npm devDependency** (`supabase@2.122.x`), run via `npx supabase` / npm scripts. No global install.
- **Local ports are the Supabase defaults** (API 54321, DB 54322, Studio 54323, Mailpit 54324), `project_id = "roomsync"`. An older local Supabase project that held those ports was stopped at the owner's request (containers stopped, not deleted).
- Spec moved to `docs/RoomSync_Product_Spec_for_Claude.md` as PLAN.md expects.
- Pinned versions as installed: TypeScript 7.0.2, Vite 8.3.5, Vitest 5.0.5, Tailwind 4.3.3, React 19.3.1, Zod 4.6.7. No tool needed pinning lower.
- `@types/node@22` added so `vite.config.ts` typechecks.

## Open questions
- None.

## Ideas (out of scope for the current phase)
- (none yet)
