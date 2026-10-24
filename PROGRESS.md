# RoomSync — Progress

Read this at the start of every session; update it at the end.

## Status
| Phase | State |
|---|---|
| 0 Bootstrap | Done (`phase-0`) |
| 1 Schema and security | Done (`phase-1`) |
| 2 Database functions | Done (`phase-2`) — awaiting owner "continue" |
| 3–13 | Not started |

## Phase 2 decisions and deviations
- **`preview_invite` / `join_household` return `{ok:false, error:'invalid_invite:<reason>'}` instead of raising.** PLAN §6 says RPCs raise these. A raised error rolls back the failed-attempt row, so the 10-failures/hour throttle could never trigger. The `src/api` wrapper (Phase 3/4) must turn `ok:false` into the matching client error. Other errors (`already_member`, auth) still raise.
- **Argument style:** typed `p_*` parameters; shares are a JSON array `[{member_id, share_amount_minor, percent_bp?}]`. Return values: `create_invite` → `{invite_id, code, expires_at}` (code shown once), `edit_expense` → `{version, settlements_exist, impact[]}`, `complete_chore` → `{next_chore_id, next_assignee_member_id, skipped_member_ids}`, `reopen_chore` → `{cancelled_successor_id}`; mutating RPCs on versioned rows return the new `version`.
- **`private.ctx()`** is the single entry point for auth, reconcile, membership and archive checks. Non-members always get `not_found`.
- **Rotation only considers `active` members** (a `leaving` member is skipped; they can still receive a manually assigned chore or expense).
- **Settlements may involve `left` members** so their unresolved balance can be settled explicitly; balances of left members stay listed.
- **Settlement transitions:** recorded→reversed (admin/recorder), recorded→disputed (admin, or the other party who did not record it; reason required), disputed→reversed (admin/recorder), disputed→recorded (admin, or whoever raised the dispute). `reversed` is final.
- **Audit snapshots omit expense notes**; activity metadata has titles/amounts only.
- **Deferred constraints:** RPCs that depend on them call `set constraints all deferred` first and `immediate` after (found by tests: a mode change earlier in a transaction broke `transfer_ownership` and the second `add_expense`).
- **SQL mirrors:** `private.next_occurrence` and `private.next_assignee` mirror `src/domain/rotation.ts`; `private.compute_balances` mirrors `src/domain/balances.ts`. Shared vectors: `rotation.test.sql` and `balances.test.sql` vs `domain.test.ts`. Splits are validated (not computed) in SQL; the ₹1,000/3 vector is in `expenses.test.sql` and `constraints.test.sql`.
- **Test design:** each RPC test file starts from the same fixture (4-member House A created through the real RPCs, House B, an outsider) and logs in as each user via `set_config('role'/'request.jwt.claims')`. 700 assertions in 11 files. Mutation-checked (breaking the balance rule, the recurrence rule and the admin check each failed tests).
- **Generated types:** `npm run db:types` → `src/lib/database.types.ts` (unformatted; the CLI suggests `npx oxfmt`, not applied).
- **UI mockups received** (`UI/`, 29 PNGs): notes and conflicts with the spec are in `docs/ui-reference-notes.md`; decisions needed before Phase 3/4/6/7.

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
