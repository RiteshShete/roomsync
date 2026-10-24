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

Guard triggers `guard_grocery_purchaser`, `guard_announcement_pin`, `bump_version`, `set_updated_at`, `forbid_household_change` run as the invoker on purpose, so they see the real caller.

## Known limits
- A chore can only be edited if its assignee is still active/leaving; reassign first (RLS `with check`).
- Realtime tables inherit RLS; verify in Phase 7 that a non-member subscription receives nothing.
