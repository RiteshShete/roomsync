# RoomSync — Progress

Read this at the start of every session; update it at the end.

## Status
| Phase | State |
|---|---|
| 0 Bootstrap | Done (`phase-0`) |
| 1 Schema and security | Done (`phase-1`) — awaiting owner "continue" |
| 2–13 | Not started |

## Phase 1 decisions and deviations
- **`expense_shares.household_id` added** (not in PLAN §6) and `unique (id, household_id)` on `household_members`, `expenses`, `chores`. This allows composite foreign keys, so the database itself guarantees payer, participants, assignees, settlement parties and activity actors belong to the row's household. Phase 2 RPCs must fill `household_id` on shares. The deferred constraint trigger therefore only checks sums, equal spread (≤ 1 minor unit), percentage totals (10000 bp) and that each percentage share is within 1 minor unit of its exact value.
- **`created_by`, `recorded_by`, `completed_by`, `deleted_by`, `status_changed_by` are `auth.users` ids**; `*_member_id` columns are member ids.
- **Direct writes** (chores, grocery, announcements, notification prefs, profiles) are restricted by column-level grants + RLS `with check` + guard triggers. A pgTAP test pins the exact list of tables with direct INSERT/UPDATE; nothing has DELETE. Chores are only directly editable while `open`; complete/reopen is RPC-only. Cancelling needs admin or creator (enforced in the policy `with check`).
- **Activity/audit emission for the direct-write tables** (grocery, announcements, chore create/edit/cancel) is NOT built yet. PLAN §6 says triggers should emit them; PLAN §8 places activity emission in Phase 6/7. I will add those triggers in Phase 6 unless told otherwise.
- **Error codes:** invariant violations raise `23514` with message `validation:<field>:<code>`; vocabulary errors (`currency_locked`, `permission_denied`) raise `P0001`.
- **Owner rules:** unique partial index (one non-left owner) + deferred trigger (a household with non-left members must have an owner at commit). Ownership transfer must demote first, then promote, in one transaction.
- **Left members** lose all read access. Phase 8 needs an RPC for the "You've left <household>" screen.
- **Realtime** publication: `activity_events, expenses, settlements, chores, grocery_items, announcements`.
- **Test layout:** `supabase/tests/*.test.sql` are picked up by `supabase test db` (208 assertions across `rls_enabled`, `isolation`, `constraints`). Tests were mutation-checked: opening a policy, granting DELETE and dropping a trigger each made them fail.
- **Not yet done:** pgTAP parity vectors for splits/balances/rotation (Phase 2). `docs/security-review.md` lists every definer function so far.

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
