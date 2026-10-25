# Security review log

Every `security definer` function, what it checks, and why it is safe. Add a row whenever one is added (CLAUDE.md rule 8). `supabase/tests/rls_enabled.test.sql` fails if a definer function lacks `search_path = ''` or if anon can execute any function.

## Model
- Read access = non-left member of the row's household (`private.is_member`).
- Money, membership, invitations, activity and audit tables have **no direct write privilege**; only RPCs (Phase 2) write them.
- Direct writes exist only for `chores`, `grocery_items`, `announcements`, `notification_prefs`, `profiles`, limited by column grants, RLS `with check`, and guard triggers.
- `anon` has no privilege on any table or function. No role can `DELETE`.

## Phase 1 functions (schema `private`, not exposed via the API)
| Function | Definer | Checks | Notes |
|---|---|---|---|
| `is_member(hid)` | yes | caller (`auth.uid()`) has a non-left row in `hid` | Used by every read policy |
| `is_active_member(hid)` | yes | caller has an `active` row | Reserved for RPCs |
| `is_admin(hid)` | yes | caller is non-left owner/admin | |
| `my_member_id(hid)` | yes | returns caller's member id in `hid` or null | |
| `is_my_member(mid)` | yes | `mid` belongs to caller | Own-row policies |
| `is_member_of_member(mid)` | yes | `mid` is in a household the caller belongs to | |
| `household_is_active(hid)` | yes | household not archived | Returns a boolean only |
| `is_assignable_member(mid, hid)` | yes | `mid` is active/leaving in `hid` | Takes no caller identity; boolean only |
| `all_members_in_household(mids, hid)` | yes | every id is active/leaving in `hid` | boolean only |
| `shares_household_with(uid)` | yes | caller shares a household with `uid` | Profile visibility |
| `handle_new_user()` | yes | trigger on `auth.users` insert | Creates profile only |
| `create_default_prefs()` | yes | trigger on member insert | |
| `check_household_has_owner()` | yes | deferred trigger | |
| `lock_currency()`, `check_money_currency()` | yes | triggers | Read `households`/`expenses`/`settlements` regardless of RLS |
| `check_expense_invariants()` | yes | deferred trigger | Share sum, equal spread, percentage totals |

## Phase 2 RPCs (schema `public`, all `security definer`, `search_path = ''`, EXECUTE only for `authenticated`; `health` also for `anon`)
Every RPC starts with `private.ctx(household_id)`: `auth.uid()` must be set (`permission_denied`), the household is reconciled (lazy move-out), the caller must be a non-left member (else `not_found`, so foreign ids look missing), and writes to an archived household raise `household_archived`. Role checks below are on top of that.

| RPC | Role check | Other checks |
|---|---|---|
| `create_household` | any authenticated user | no existing non-left membership (`already_member`) |
| `update_household` | owner/admin | `expected_version`; currency lock trigger |
| `set_household_archived` | owner | allowed while archived (restore) |
| `set_member_role` | owner | target not owner/left; only admin/member |
| `transfer_ownership` | owner | target active, not self; demote-then-promote with deferred owner check |
| `start_move_out` / `cancel_move_out` | self, owner for anyone, admin for non-owners | date 0–90 days; owner → `owner_must_transfer` / `sole_member` |
| `add_move_out_dispute` | the leaving member only | status must be `leaving` |
| `reconcile_household` | anyone who ever belonged | idempotent; also runs inside every RPC |
| `household_balances` | member | |
| `create_invite` / `revoke_invite` | owner/admin | ≤ 20 active invites; code returned once, only SHA-256 stored |
| `preview_invite` / `join_household` | logged-in non-member | throttle 10 failures/hour; failures are returned (not raised) so attempts persist; max 12 members |
| `add_expense` | member | participants active/leaving; shares validated by deferred trigger |
| `edit_expense` / `delete_expense` / `restore_expense` | owner/admin any, member own | `expected_version`; audit before/after; soft delete |
| `record_settlement` | owner/admin any pair, member only as payer or recipient | date not in the future; parties belong to the household |
| `set_settlement_status` | see transition table in the function | reason required to dispute; `reversed` is final |
| `complete_chore` / `reopen_chore` | admin, creator, assignee (any member if unassigned) | successor handling; `later_occurrence_completed` |
| `mark_activity_read` / `mark_all_activity_read` | member | only the caller's own read state |
| `export_my_household_data` | member | no emails, no invitation data |
| `health` | public | returns `'ok'` |

Private internals (`ctx`, `reconcile`, `emit_*`, `compute_balances`, `next_*`, `resolve_invite`, code generation/hashing) are not executable by API roles; `rls_enabled.test.sql` pins the exact list of private functions `authenticated` may run.

Transaction note: RPCs that rely on deferred constraints run `set constraints all deferred` before writing and `all immediate` after, so they behave the same even if an earlier statement in the transaction changed the mode.

Guard triggers `guard_grocery_purchaser`, `guard_announcement_pin`, `bump_version`, `set_updated_at`, `forbid_household_change` run as the invoker on purpose, so they see the real caller.

## Phase 7 additions
| Object | Who | Notes |
|---|---|---|
| `sync_chore_reminders(household, today)` | member of that household | `security definer`, `search_path = ''`, enters through `private.ctx`; only inserts `chore.reminder` events addressed to each chore's own assignee; metadata is title and dates only; `today` must be within one day of the server date; idempotent via a unique index; silent for archived households or when reminders are off |
| `private.announcement_activity()` trigger | none (trigger only) | emits `announcement.posted` and `announcement.pinned` to the other members; metadata is the title only, never the message |

Realtime was verified end to end (`e2e/realtime-isolation.spec.ts`): a member subscribed to a household receives its changes; a signed-in outsider subscribed to the same household filter receives nothing. `supabase_realtime` publishes exactly the tables the app listens to (pinned in `announcements_reminders.test.sql`).

## Phase 8 additions
| Object | Who | Notes |
|---|---|---|
| `my_left_households()` | any signed-in user | `security definer`, `search_path = ''`, `private.require_uid()`; returns only `household_id`, `name`, `left_at` for the caller's **own** memberships with status `left` (at most 10). A person who left gets no other access; their RLS visibility of the household is unchanged (none). |
| `private.prune_old_rows(household)` | none (private) | Called from `sync_chore_reminders`. Deletes activity events older than 90 days for that household and invite attempts older than one day, 500 rows per call. Never touches expenses, settlements or `audit_events`. |

The end-to-end tests change a member's `move_out_effective_date` with the local **service-role key obtained from `supabase status`**, only to simulate time passing; the key is never in the app, the repo or `.env` files.

## Known limits
- A chore can only be edited if its assignee is still active/leaving; reassign first (RLS `with check`).
- Activity events are readable by every member of the household (RLS is per household, not per recipient); addressing is applied in the client. Events hold titles and amounts only, never free text such as announcement messages. A per-recipient policy is an option if that is not acceptable.
- Reminders are created lazily when someone opens the app; there is no scheduler.
