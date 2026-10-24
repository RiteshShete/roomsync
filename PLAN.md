# RoomSync — Build Plan for Claude Code

**Read first:** `docs/RoomSync_Product_Spec_for_Claude.md` is the product source of truth (screens, copy, edge cases, acceptance criteria). This file is the *engineering* plan: stack, architecture, phases, tests, deployment. If the two conflict on product behaviour, the spec wins; if they conflict on engineering, this plan wins and you note it in `PROGRESS.md`.

## 0. How to work

1. Work **one phase at a time**, in order. Do not start phase N+1 until phase N's exit criteria pass.
2. At the end of every phase run the gate: `npm run typecheck && npm test && npm run build && supabase test db` (the database part only from Phase 1 onward; `build` only once the app exists in Phase 3).
3. Then **stop and report** using the checkpoint template in §9. Wait for the owner to say continue.
4. Keep `PROGRESS.md` current: phases done, decisions made, deviations, open questions. Read it at the start of every session.
5. One commit per logical change, conventional-commit messages. Tag each finished phase `phase-N`.
6. If something needs credentials, a paid service, or a decision not covered here: **stop and ask**. Never invent credentials, and never mock a result and present it as real.

## 1. Product in one paragraph

RoomSync is a mobile-first shared-living app: shared expenses with exact splits and settlements, chores with rotation, a shared grocery list, announcements, an activity centre, notification preferences, household settings, and a move-out flow. Tagline: "Shared living, simplified." Payments are **never** executed by the app; "Record settlement" records a payment made outside the app. See spec §1, §7, §8.

## 2. Non-negotiable rules

- **Money is integer minor units** (paise/cents) everywhere: database `bigint`, TypeScript `number` within `Number.MAX_SAFE_INTEGER`. No floats, no `numeric` with fractions. Max amount: 1e8 major units.
- **Never claim what isn't implemented**: no "payment sent", no fake sync, no fake AI/OCR/push. Settlement copy is "Settlement recorded".
- **Authorisation is enforced in the database** (RLS + RPC checks). The client hides buttons for UX only.
- **No secrets in the repo or bundle.** Only the Supabase URL and the *publishable* (formerly "anon") key may appear in client code. The secret/service-role key is used only by local dev scripts, read from the environment, never committed, never prefixed `VITE_`.
- **Every visible control works or is disabled with an explanation.** No dead buttons.
- **Every data screen has loading, empty, error/retry, and success states**, using the exact copy in spec §10 and §16. Centralise copy in `src/copy.ts`.
- **Preserve user input on failed saves.** Never clear a form after an error.
- **Financial history is never silently overwritten**: edits and deletes write audit rows and keep soft-deleted data.
- **Accessibility**: labelled controls, visible focus, 44px touch targets, status not conveyed by colour alone, errors announced (`role="alert"` / `aria-live`), `prefers-reduced-motion` respected.
- Do not add features outside the current phase. Do not build spec Phase 2 items (receipt OCR, inventory, concerns, AI rewrite, calendar) before Phase 13; if shown at all in the UI they are disabled with a stated reason.

## 3. Decisions already made (do not relitigate without evidence)

| # | Decision | Reason / known downside |
|---|---|---|
| D1 | **Supabase first** (Postgres + Auth + RLS + Realtime); develop on the **local Supabase stack**, then a hosted free project, then GitHub Pages | Relational integrity for money. Downside: needs Docker locally. |
| D2 | **No user-facing "demo mode".** Dev data comes from a seed script with local test accounts | Avoids a second code path. Downside: reviewers on the hosted site need an account. |
| D3 | **Net balance model** (spec §13): payer credited full amount, participants charged shares, settlement from A to B credits A and debits B. Plus *suggested* transfers (greedy, deterministic) | Matches spec. Downside: someone may be told to pay a person they never bought from; mitigated by a per-member breakdown whose lines sum to the balance. |
| D4 | **Client computes split shares** (using `src/domain/splits.ts`); the **database validates invariants** (sum = total, shares ≥ 0, participants in household, equal-split spread ≤ 1 minor unit, percentage bp total 10000) | Avoids duplicating split math in SQL. Downside: a crafted request can submit a valid-but-unfair custom split; the audit log records it. |
| D5 | **Chore rotation and next-occurrence are implemented in SQL** (inside `complete_chore`), mirroring `src/domain/rotation.ts`; both must pass the same test vectors | Completion must be atomic and server-trusted. |
| D6 | **One active household per user** in the MVP | Resolves "already belongs" and multi-invite edge cases. Enforced by a partial unique index. |
| D7 | **Invite codes**: 8 chars from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, stored as SHA-256 hash (pgcrypto), shown once, expiring, optional max uses; create/revoke by owner/admin only; preview/join require login and are throttled per user | Code guessing is the realistic attack. "Resend" = revoke + create new. |
| D8 | **Disputed settlements do not count toward balances** and are listed separately; reversed ones are excluded; nothing is auto-marked paid | Spec §7 Journey H, §11. |
| D9 | **Currency is fixed once any expense or settlement exists** (DB trigger) | One currency per household (spec §7 C). |
| D10 | **Move-out reconciliation is lazy**: `reconcile_household()` runs on app load and at the start of every RPC; no cron | Simpler. Downside: a "leaving" member flips to "left" only when someone opens the app. |
| D11 | **Auth**: email + password, PKCE flow, password reset. Local: email confirmation off. Hosted: on | PKCE avoids URL-hash token conflicts with HashRouter on Pages. |
| D12 | **Routing**: `HashRouter`, Vite `base` from `VITE_BASE_PATH` | Static hosting without rewrite rules. |
| D13 | **Server state**: TanStack Query; forms: controlled inputs + Zod; generated DB types via `supabase gen types` | Gives consistent loading/error/cache behaviour. |

## 4. Stack and pinning

React 19, TypeScript, Vite, Tailwind CSS v4, `react-router-dom` (HashRouter), `@supabase/supabase-js`, `@tanstack/react-query`, Zod, Vitest + Testing Library, Playwright (e2e), Supabase CLI (local stack, migrations, pgTAP).

The starter was verified with: Node 22, TypeScript 7.0.x, Vite 8.x, Vitest 5.x, Tailwind 4.3.x. **TypeScript 7 removed `baseUrl`**; the starter's `tsconfig.json` already uses `paths` with `./src/*`. If any tool breaks on these newest majors, pin that tool one major lower and record it in `PROGRESS.md`.

Prerequisites on the owner's machine: Node 22, Git, Docker Desktop (running), Supabase CLI. Verify with `node -v`, `docker info`, `supabase --version`.

## 5. Repo layout

```
docs/RoomSync_Product_Spec_for_Claude.md
PLAN.md  CLAUDE.md  PROGRESS.md  README.md
supabase/
  config.toml
  migrations/            # timestamped SQL, one concern per file
  seed.sql               # non-auth reference data only
  tests/                 # pgTAP: *.test.sql
scripts/
  seed-dev.mjs           # local only: creates 4 users + demo household via the real RPCs
src/
  domain/                # PURE TS from starter: money, splits, balances, rotation, invites, dates, types
  lib/                   # supabase client, query client, env, error mapping, database.types.ts (generated)
  api/                   # thin typed wrappers around table reads + RPC calls, one file per feature
  ui/                    # design tokens + components (Button, Field, AmountInput, Sheet, ConfirmDialog, Toast, Avatar, Chip, EmptyState, Skeleton, ErrorState, BottomNav, Header)
  features/              # auth, household, expenses, chores, groceries, announcements, activity, settings, moveout
  copy.ts                # all user-facing strings from spec §10/§16
  App.tsx  main.tsx
e2e/                     # Playwright specs
.github/workflows/       # ci.yml, deploy.yml, keepalive.yml
```

## 6. Data model (public schema; helper functions in a `private` schema)

All tables: `id uuid pk default gen_random_uuid()`, `created_at timestamptz default now()`, RLS **enabled**. Entities that can be edited concurrently carry `version int not null default 1`, incremented on every update; edit RPCs take `expected_version` and raise `conflict` on mismatch.

- `profiles(id → auth.users, display_name, avatar_color, updated_at)`; row created by a trigger on `auth.users` insert.
- `households(name, currency_code, status active|archived, default_split, chore_reminders_enabled, created_by, updated_at, version)`.
- `household_members(household_id, user_id, role owner|admin|member, status active|leaving|left, joined_at, left_at, move_out_requested_at, move_out_requested_by, move_out_effective_date, move_out_note, move_out_acknowledged_balance_minor)`. Partial unique index: one non-`left` row per `user_id` (D6). Exactly one `owner` per active household.
- `member_move_out_disputes(member_id, note, created_at)`.
- `invitations(household_id, created_by, code_hash, code_hint, expires_at, max_uses, use_count, status)` and `invite_attempts(user_id, attempted_at, succeeded)`.
- `expenses(household_id, title, amount_minor bigint check 1..10_000_000_000, currency_code, category, paid_by_member_id, expense_date, notes, split_method, created_by, updated_by, updated_at, deleted_at, deleted_by, version)`.
- `expense_shares(expense_id, member_id, share_amount_minor bigint check >= 0, split_method, percent_bp, pk(expense_id, member_id))`. A **deferred constraint trigger** verifies: sum of shares = expense amount; every share member and the payer belong to the expense's household; equal splits differ by at most 1 minor unit; percentage splits total 10000 bp.
- `settlements(household_id, from_member_id, to_member_id, amount_minor, currency_code, settlement_date, note, recorded_by, status recorded|reversed|disputed, status_changed_by, status_changed_at, status_reason, version)`; check `from <> to`, `amount > 0`.
- `chores(household_id, title, description, assignee_member_id null, due_date null, recurrence_frequency null, rotation_member_ids uuid[] null, status open|completed|cancelled, created_by, completed_at, completed_by, spawned_next_id, cancel_reason, updated_at, version)` + `chore_completions(chore_id, chore_title, assignee_member_id, completed_by_member_id, due_date, completed_at, reopened_at)`.
- `grocery_items(household_id, name, quantity numeric null, unit, category, note, status needed|purchased, added_by_member_id, purchased_by_member_id, purchased_at, deleted_at, updated_at, version)`.
- `announcements(household_id, title, body, created_by, updated_at, pinned_at, deleted_at, version)`.
- `activity_events(household_id, actor_member_id, event_type, entity_type, entity_id, metadata jsonb, recipient_member_ids uuid[])` — **written only by RPCs/triggers**; metadata holds titles and amounts only, never free-text sensitive content. `activity_reads(member_id, event_id, read_at)`.
- `audit_events(household_id, actor_member_id, entity_type, entity_id, action, before jsonb, after jsonb)` — written only by RPCs/triggers; members of the household can read, nobody can write directly.
- `notification_prefs(member_id pk, categories jsonb, quiet_enabled, quiet_start, quiet_end)`.

Helper functions (`security definer`, `set search_path = ''`, in schema `private`): `is_member(hid)`, `is_active_member(hid)`, `is_admin(hid)`, `my_member_id(hid)`. Policies call these; they never query the table they protect without these definer helpers (avoids recursive RLS).

**Write paths**
- Through **RPC only** (direct INSERT/UPDATE/DELETE revoked): households, household_members, invitations, expenses, expense_shares, settlements, chore complete/reopen, activity_*, audit_*.
- Through **RLS-gated direct writes** plus triggers that emit activity/audit: grocery_items, announcements, chore create/edit/cancel (chore edits that change assignee also emit an event).

### RPC catalogue (names are binding; arguments are jsonb or typed params, your choice)

`create_household`, `update_household`, `set_household_archived`, `create_invite`, `revoke_invite`, `preview_invite` (returns household name, member count, expiry only — no member identities), `join_household`, `set_member_role`, `transfer_ownership`, `start_move_out`, `cancel_move_out`, `add_move_out_dispute`, `reconcile_household`, `add_expense`, `edit_expense`, `delete_expense`, `restore_expense`, `record_settlement`, `set_settlement_status`, `complete_chore`, `reopen_chore`, `mark_activity_read`, `mark_all_activity_read`, `export_my_household_data`, `health` (public, returns `ok`, for keep-alive).

### Error vocabulary (RPCs raise with these messages; client maps them to spec §16 copy)

`permission_denied`, `not_found`, `conflict`, `validation:<field>:<code>`, `invalid_invite:<revoked|expired|used_up|household_archived|household_full|not_found|throttled>`, `already_member`, `household_archived`, `owner_must_transfer`, `sole_member`, `currency_locked`, `later_occurrence_completed`.

## 7. Permission matrix (enforce in RPC/RLS; test each cell)

| Action | Owner | Admin | Member |
|---|---|---|---|
| Read household data | ✔ | ✔ | ✔ (own household only) |
| Edit household settings | ✔ | ✔ (not currency after money exists) | ✖ |
| Archive / restore household, transfer ownership, change roles | ✔ | ✖ | ✖ |
| Create / revoke invites | ✔ | ✔ | ✖ |
| Add expense | ✔ | ✔ | ✔ |
| Edit / delete / restore expense | any | any | only ones they created |
| Record settlement | ✔ | ✔ | only if they are payer or recipient |
| Reverse settlement | any | any | only if they recorded it |
| Dispute settlement | ✔ | ✔ | only if they are the other party and did not record it |
| Create chore | ✔ | ✔ | ✔ |
| Edit / reassign chore | any | any | creator or assignee |
| Complete / reopen chore | any | any | assignee or creator; any member if unassigned |
| Cancel chore | any | any | creator |
| Grocery add / edit / purchase / delete | ✔ | ✔ | ✔ |
| Post announcement | ✔ | ✔ | ✔ |
| Edit / delete announcement | any | any | own |
| Pin announcement | ✔ | ✔ | ✖ |
| Start move-out | self; others | self; others except owner | self |

Additional rules: payer/participants of a **new** expense and assignees of a **new** chore must be `active` or `leaving` members; `left` members can't be added, but their history stays and their balances stay visible as unresolved. An owner cannot leave while other active members exist (`owner_must_transfer`); a sole member cannot leave, only archive (`sole_member`). When household is `archived`, every write RPC raises `household_archived`.

## 8. Phases

Each phase lists **Tasks**, **Tests**, and **Exit criteria**. Do not skip tests to save time; the money and isolation tests are the point of this architecture.

---

### Phase 0 — Bootstrap and environment

**Tasks**
- Create the repo from the starter zip. Place the spec at `docs/RoomSync_Product_Spec_for_Claude.md`. Run `npm ci`; confirm `npm run typecheck` and `npm test` pass (42 domain tests).
- Add scripts to `package.json`: `typecheck`, `test`, `build`, `dev`, `e2e`, `db:reset` (`supabase db reset`), `db:test` (`supabase test db`), `db:types` (`supabase gen types typescript --local > src/lib/database.types.ts`).
- `supabase init`; configure `supabase/config.toml`: auth email confirmations **off** for local, site URL `http://localhost:5173`, additional redirect URLs for later.
- Run `supabase start`; record the API URL and publishable key printed by `supabase status` into `.env.local` (never committed; `.env.example` is committed).
- Create `PROGRESS.md`, `README.md` skeleton.

**Exit:** `supabase start` is healthy, Studio opens, `docker info` works, repo builds `typecheck` + `test` green. Commit; tag `phase-0`.

---

### Phase 1 — Schema and security (SQL only)

**Tasks**
- Migrations, one concern each: extensions (`pgcrypto`), enums/checks, tables from §6, `profiles` trigger, `private` helper functions, RLS policies, indexes on every foreign key and on `(household_id, created_at)` for list queries, grants (revoke from `public`/`anon`, grant `select` to `authenticated` where RLS allows; revoke direct writes on RPC-only tables).
- Constraint triggers: expense share invariants, currency lock (D9), one-owner rule, partial unique index (D6).
- Enable Realtime publication only for tables the UI will subscribe to later (`activity_events`, `expenses`, `settlements`, `chores`, `grocery_items`, `announcements`) — RLS still applies.

**Tests (pgTAP, `supabase/tests/`)**
- `rls_enabled.test.sql`: every table in `public` has RLS enabled (fails the build if a future table forgets).
- `isolation.test.sql`: user in household A cannot select/insert/update/delete any row belonging to household B on every table, including by guessing UUIDs; unauthenticated role sees nothing.
- `constraints.test.sql`: share-sum mismatch rejected; negative share rejected; non-member participant rejected; amount ≤ 0 rejected; second active membership for a user rejected; second owner rejected.

**Exit:** `supabase db reset` applies cleanly from zero; `supabase test db` green. Tag `phase-1`.

---

### Phase 2 — Database functions and their tests

**Tasks**
- Implement every RPC in §6 with: auth check (`auth.uid()` not null), household membership and role check per §7, archived-household check, `reconcile_household` call, `expected_version` conflict check where relevant, audit row, activity event(s) with recipients (exclude the actor), and the error vocabulary.
- `join_household`: normalise code, hash with SHA-256, throttle failed attempts (e.g. 10 failures/hour/user → `invalid_invite:throttled`), evaluate status/expiry/max uses/archived/full (max members 12), insert member, increment `use_count`.
- `edit_expense`: return the settlements-exist flag and a before/after balance impact for affected members so the UI can explain the effect (spec §11.1).
- `complete_chore`: mark complete, write completion row, and if recurring create the next occurrence (due date per `src/domain/rotation.ts#nextOccurrence`, never in the past) with next assignee via rotation (skip non-active members; if none, leave unassigned and emit `chore.needs_assignee` to admins). `reopen_chore`: refuse with `later_occurrence_completed` if the spawned successor was completed; otherwise cancel the still-open successor so no duplicates remain.
- `reconcile_household`: any member with `status = leaving` and `move_out_effective_date <= current_date` becomes `left`; their open chores are reassigned by rotation or unassigned; they are removed from rotation lists (rotation with fewer than 2 members becomes null); emit `member.left` and `chore.needs_assignee` where needed.
- A SQL view/function `household_balances(hid)` returning net balance per member using the same rules as `src/domain/balances.ts` (D3, D8).

**Tests (pgTAP)**: one file per area — `expenses.test.sql`, `settlements.test.sql`, `invites.test.sql`, `chores.test.sql`, `moveout.test.sql`, `permissions.test.sql` (every cell of §7, both allowed and denied), `balances.test.sql` (sum of nets = 0; deleted/reversed/disputed excluded; same vectors as `domain.test.ts`), `rotation.test.sql` (same vectors as the rotation tests in `domain.test.ts`).

**Exit:** all pgTAP green; `npm run db:types` regenerates types and `typecheck` passes. Tag `phase-2`.

---

### Phase 3 — App foundation and authentication

**Tasks**
- Design tokens from spec §9 as CSS variables (light + dark via `prefers-color-scheme`), system font stack (no external font requests), 4/8-pt spacing, 44px targets. Build the component library listed in spec §9 with all states (pressed, focus, disabled, loading, error). `AmountInput` must use `parseAmount`/`minorToInput` from `src/domain/money.ts` and show currency.
- Supabase client (`flowType: 'pkce'`, `detectSessionInUrl: true`), env validation (fail loudly with a readable screen if env vars are missing), QueryClient with sensible retry, a global error boundary, an offline banner (`navigator.onLine` + `online/offline` events).
- Routing with `HashRouter`; five-tab bottom nav (Home, Expenses, Chores, House, You) that never covers content (safe-area padding); notifications bell in the header.
- Auth screens: Welcome (spec §8.1 copy), sign up, log in, forgot/reset password, sign out. Session provider; guarded routes. Clear validation and error copy.
- Error mapper: RPC/DB error → user-facing copy from spec §16, with a safe generic fallback ("Something went wrong. Please try again.").
- `scripts/seed-dev.mjs`: using the local secret key from the environment, create four users (Aarav, Riya, Kunal, Sneha; known local-only passwords), then sign in as Aarav and build the demo household **through the real RPCs** (household, invites + joins, ~10 expenses with mixed splits and one edit, one settlement, chores incl. one recurring with rotation, groceries, two announcements). Refuse to run unless the URL is localhost.

**Tests**: component tests for each UI primitive (renders, a11y name, disabled/loading), auth form validation, error-mapper table test, env-missing screen.

**Exit:** `npm run dev` → sign up locally → arrive at an empty "choose Create or Join" screen; seed script produces a household; `typecheck`, `test`, `build` green. Tag `phase-3`.

---

### Phase 4 — Households and membership

**Tasks**
- Create household (name, optional currency/default split/chore reminders; optional steps skippable) and invite roommates: create invite, show code **once**, copy-to-clipboard with success toast, pending invites list with revoke and "Create new invite", clear "pending" state (do not assume anyone joined).
- Join household: enter code → `preview_invite` (name, member count, expiry only) → confirm → join. Every invalid state from spec §7 Journey B shows its own message (revoked, expired, used up, archived, full, throttled, already a member, network failure).
- Members list (avatars, roles, status chips), role changes and ownership transfer (owner only, with confirmation), household settings, archive/restore with consequence text. Archived household shows a banner and all write controls disabled with an explanation.
- Home skeleton with the "Your house is ready" empty state (spec §8.4).

**Tests**: Vitest component tests with the Supabase client mocked at the `api/` boundary; Playwright: user A creates + invites, user B (second browser context) joins, both see two members.

**Exit:** spec Journeys A and B pass in the browser with two real local accounts. Tag `phase-4`.

---

### Phase 5 — Expenses and settlements

**Tasks**
- Expenses tab: summary (**You owe** / **You are owed**, never a single "house balance"), recent list, "View all", filters (date range, category, payer, participant), include-deleted toggle, empty state (spec §8.5).
- Add/edit expense ("Split a new expense"): title, amount, date, category, payer, participants, split method (equal / custom / percentage). Live per-person share preview via `buildShares`; show remaining difference for custom and percentage; "Save expense" disabled until valid; show the rounding note ("₹0.01 extra assigned to …"). Preserve input on failure. After save: success toast + balances refresh.
- Expense details: exact calculation, payer, participants, created/updated by + time, change history from `audit_events`, permission-aware Edit/Delete (delete = confirm dialog, then toast with Undo using `restore_expense`). After editing an expense that has settlements, show the before/after balance impact message.
- Balances screen: per-member net, suggested transfers labelled **Suggestion**, and a "Why do I owe this?" breakdown (lines from `explainBalance`, which must sum to the displayed net).
- Record settlement: pick suggested pair or choose manually, amount, date (not future), optional note; review step states "This records a payment made outside RoomSync. RoomSync does not move money."; warn when amount exceeds what is currently owed; confirm; show receipt-like record. Reverse and dispute actions per §7 with required reason for dispute; disputed items appear in their own section.

**Tests**: Vitest for forms (all validation paths, ₹1,000 across three people → 333.34/333.33/333.33); Playwright: add expense → balances correct → record settlement → balances update; edit after settlement shows impact; delete + undo; permission denied path (member editing another's expense sees disabled control and server rejection copy).

**Exit:** spec Journeys C and D and manual scenarios 2–3 pass. Tag `phase-5`.

---

### Phase 6 — Chores and groceries

**Tasks**
- Chores: tabs Today / Upcoming / Completed; create/edit (title, description, assignee, due date, recurrence, rotation order); reassign; "Mark as done" with success copy "Nice work — task completed." and Undo (reopen); overdue shown with the neutral "This chore is still waiting to be completed." — no shaming, no public rankings; cancel with confirmation; completion history; rotation note when someone was skipped. Assignee who is `leaving` shows a "moving out" chip.
- Groceries (House → Grocery list): Needed / Purchased sections; add with name, optional quantity/unit/category/note; duplicate detection against Needed (offer "Update existing" or "Add anyway"); mark purchased (purchaser + time; if someone else already did, show the conflict message and refresh); move back to Needed; edit; delete with Undo; empty state copy (spec §8.7).
- Activity events emitted for each action.

**Tests**: component + Playwright for chore lifecycle incl. recurring + rotation + reopen, and grocery add → purchase → move back; two-browser concurrent purchase conflict.

**Exit:** Journeys E and F and manual scenarios 4–5 pass. Tag `phase-6`.

---

### Phase 7 — House, activity, settings

**Tasks**
- Announcements: post (title, message), edit/delete per §7, pin (admin/owner), author + timestamp. Distinct from chat; no messaging features.
- House tab hub: Grocery list, Announcements; disabled, labelled entries for Inventory, Calendar, Concerns, Emergency contacts ("Not available in this version").
- Activity centre (bell): unread/read, grouped by category, deep links to the relevant screen, mark read / mark all read. Home "Recent activity" shows the household feed.
- You tab: profile (name, avatar colour), personal summary (owed/owe, open chores — no leaderboards), notification preferences per category + quiet hours (state precisely what they do: they pause the in-app unread badge only, because no push exists), privacy notice, help, sign out, **export my data** (`export_my_household_data` → JSON download), delete-account instructions that are honest about what is and isn't implemented.
- Realtime: subscribe to household-scoped changes and invalidate queries; show a subtle "Updated" state; fall back to refetch-on-focus if the channel fails.

**Tests**: unit tests for notification filtering and quiet hours (`inQuietHours`); Playwright: announcement permissions, unread count changes, deep link opens the right screen, preference toggle changes what appears.

**Exit:** manual scenario 6 passes; Home reflects changes made by another user without a manual reload (realtime) or after refocus. Tag `phase-7`.

---

### Phase 8 — Move-out

**Tasks**
- You → Household settings → Leave household: consequence explanation first; review screen with outstanding balance, open chores, disputed settlements, and shared-item notes; "Add a note or dispute" (never auto-resolved); effective-date picker (today to +90 days); explicit confirmation ("Leave household"); final status screen (leaving / left) with unresolved items listed separately and labelled as estimates/disputed where applicable. Do **not** compute deposits or mark dues paid.
- Admin can start move-out for another member (not the owner); owner must transfer first (`owner_must_transfer`); sole member is directed to archive (`sole_member`).
- After the effective date: member no longer selectable for new expenses/chores, open chores reassigned or flagged, history intact for everyone else; the departed user sees a "You've left <household>" screen with no access to household data.
- Cancel move-out while still `leaving`.

**Tests**: pgTAP already covers reconcile; Playwright: start move-out with a future date, verify still active until the date, simulate date passing (set `move_out_effective_date` via the secret key in the test setup only), verify chores reassigned and history preserved.

**Exit:** Journey H and manual scenario 7 pass. Tag `phase-8`.

---

### Phase 9 — Quality, accessibility, documentation

**Tasks**
- Tick every item in spec §20 "MVP acceptance checklist" and record evidence (test name or screenshot) in `PROGRESS.md`.
- Accessibility pass: keyboard-only walkthrough of every flow, focus management for sheets/dialogs (trap + restore), `aria-live` for toasts and errors, contrast check of tokens in both themes (fix tokens that fail AA), reduced motion, 200% text size, 320px and 390px widths with bottom nav and keyboard open.
- Failure injection: simulate network failure and RPC errors in tests; confirm forms keep their values and show "We couldn't save that change. Your information is still here—please try again."
- Performance sanity: no list queries without limit/pagination (expenses, activity); indexes verified with `EXPLAIN` on the main list queries.
- README: prerequisites, one-time setup, daily dev commands, test commands, env vars, how seed works, permissions matrix, known limitations (no real payments, no push, no OCR/AI, free-tier constraints), troubleshooting.
- CI (`ci.yml`): on PR/push run typecheck, unit tests, and — using the Supabase CLI action/docker — `supabase db reset` + `supabase test db` + Playwright against the local stack.

**Exit:** one command (`npm run verify`, which you add) runs typecheck + unit + pgTAP + e2e green on a clean clone. Tag `phase-9`. **This is the "MVP complete locally" milestone; stop and report with full evidence.**

---

### Phase 10 — Hosted Supabase project (free tier)

**Tasks** (owner creates the project in the Supabase dashboard; you guide them step by step)
- `supabase login`, `supabase link --project-ref <ref>`, `supabase db push`; then run the **pgTAP isolation tests against a branch/clone or by re-running the same assertions through the API with two real test accounts** (do not run destructive tests against the production project).
- Dashboard config: Auth → site URL and allowed redirect URLs (`http://localhost:5173/**` plus, after Phase 11, the Pages URL including the repo path); email confirmations **on**; password length/strength; confirm Realtime publication tables; review that **no table is exposed without RLS** in the Security Advisor.
- Point a local `.env.local.hosted` at the cloud project and run the app locally against it; execute the manual scenarios once with two real accounts.
- Note free-tier limits to the owner as of that day (check the pricing page; as of mid-2026 secondary sources list 500 MB database, 50,000 MAU, two projects, pause after 7 days idle) and that the built-in email sender has low hourly limits — if sign-ups stall, recommend a custom SMTP provider.

**Exit:** local frontend + hosted backend works end to end; no secret key anywhere in the repo (`git grep` check recorded). Tag `phase-10`.

---

### Phase 11 — GitHub Pages deployment

**Tasks**
- Public repo (required for free Pages). Settings → Pages → Source: GitHub Actions.
- `vite.config.ts`: `base: process.env.VITE_BASE_PATH ?? '/'`. Keep `HashRouter`.
- Repo **variables** (not secrets, because they are public): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`. Never add the secret key.
- `deploy.yml` (skeleton below; confirm current major versions of the official actions): test → build → upload artifact → deploy.
- Add the Pages URL (e.g. `https://<user>.github.io/<repo>/`) to Supabase Auth redirect URLs and as site URL for production.
- Verify PKCE: sign-up confirmation email link returns to the live site and logs the user in; password-reset link works; a hard refresh on a deep link (`/#/expenses`) works; assets load under the repo subpath.
- Post-deploy smoke test (Playwright against the live URL, using a dedicated test account): sign in, create expense, see balance.

```yaml
name: Deploy
on: { push: { branches: [main] }, workflow_dispatch: {} }
permissions: { contents: read, pages: write, id-token: write }
concurrency: { group: pages, cancel-in-progress: true }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4          # confirm latest majors
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ vars.SUPABASE_URL }}
          VITE_SUPABASE_PUBLISHABLE_KEY: ${{ vars.SUPABASE_PUBLISHABLE_KEY }}
          VITE_BASE_PATH: /${{ github.event.repository.name }}/
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

**Exit:** public URL works for a brand-new user from sign-up through adding an expense. Tag `phase-11`.

---

### Phase 12 — Keep-alive, PWA, polish

**Tasks**
- `keepalive.yml`: scheduled (e.g. every 3 days) call to the public `health` RPC. **Verify this actually prevents the free-tier pause** (check project status after 8+ days); if it doesn't, document it and tell the owner the pause is unavoidable on the free plan.
- PWA: manifest, icons, service worker for static assets only. The offline banner states changes are **not** saved while offline; do not build an offline write queue unless the owner asks (it adds conflict-resolution scope).
- Polish list: empty-state copy review against the spec, toast durations, skeleton shapes, dark-theme review.

**Exit:** installable on a phone; site works a week after last use (or the limitation is documented). Tag `phase-12`.

---

### Phase 13 — Spec "Phase 2" features (only on the owner's go-ahead, one at a time)

Order: shared calendar → inventory (kept distinct from the grocery list) → spending insights/analytics → concerns board (identity visibility explained honestly; never promise anonymity if admins/database can identify the author; any AI rewrite requires explicit approval and a real provider) → receipt OCR (needs a real provider; otherwise leave disabled). Each gets its own migrations, RLS, pgTAP tests, and e2e test before merge.

## 9. Checkpoint report (end of every phase)

Post exactly this, then stop:

```
PHASE N COMPLETE — <name>
Gate:      typecheck ✔/✖  unit ✔/✖ (n tests)  pgTAP ✔/✖ (n tests)  e2e ✔/✖  build ✔/✖
Built:     <3-8 bullets>
Not built / deferred: <bullets, with reason>
Deviations from PLAN.md: <none | list with justification>
Decisions needing owner input: <none | list>
How to verify by hand: <exact commands and clicks, 5 steps max>
Risks found: <none | list>
Next phase starts with: <one line>
```

Never write "complete" if any gate item is ✖ or untested. If something couldn't be run (for example no Docker), say exactly that.

## 10. Testing strategy

| Layer | Tool | What it proves |
|---|---|---|
| Money/balance/rotation logic | Vitest (`src/domain`) | Exact arithmetic, deterministic rounding, edge cases. Already 42 tests; extend, never weaken. |
| Database | pgTAP via `supabase test db` | RLS isolation, constraints, every RPC, every permission cell, balance parity with the TS domain tests. |
| UI components/forms | Vitest + Testing Library with the `api/` layer mocked | Validation, states (loading/empty/error/success), accessibility names. |
| Journeys | Playwright against the **local** Supabase stack, two browser contexts for multi-user | Real auth, real RLS, real RPCs. |
| Post-deploy | Playwright smoke test against the live Pages URL | Redirects, base path, env wiring. |

Rules: tests that touch the database use throwaway local data and reset between suites (`supabase db reset` or per-test transactions); **never** run destructive tests against the hosted project. When a bug is found, add a failing test first.

Parity requirement: split/balance/rotation vectors live in `src/domain/domain.test.ts`; the same vectors must appear in pgTAP files so TypeScript and SQL cannot drift apart silently.

## 11. Known risks and what to do about them

- **RLS mistakes leak data across households.** Mitigation: Phase 1 isolation tests run on every change to migrations; `rls_enabled.test.sql` blocks new tables without RLS. Treat any isolation failure as a stop-everything bug.
- **Security-definer functions bypass RLS.** Every one must set `search_path = ''`, check `auth.uid()`, and verify membership/role itself. Review each before merging; list them in `docs/security-review.md` with what they check.
- **Auth redirects on GitHub Pages.** Wrong redirect-URL entries are the most common failure (repo subpath, trailing slash, `http` vs `https`). Test the real email link in Phase 11.
- **Free-tier pausing and email limits.** Treat as product constraints, document in README; do not work around with hacks that violate provider terms.
- **Very new toolchain majors** (TypeScript 7, Vite 8, Vitest 5). Pin lower if a tool breaks; log it.
- **Lazy move-out reconciliation** (D10): a status only flips when someone opens the app. Acceptable for the MVP; revisit with `pg_cron` if the owner needs exact timing.
- **Suggested-transfer model** (D3) can confuse users. Keep the "Why do I owe this?" breakdown prominent; revisit pairwise balances only if usability testing shows confusion.
- **Scope creep.** Anything not in the current phase goes in `PROGRESS.md` under "Ideas", not in the code.

## 12. Definition of done (per feature)

Primary journey works end to end · data persists across refresh · validation prevents invalid data (client and database) · loading, empty, success and error states exist · permissions enforced in the database and tested · calculations have tests · works at 320–430px widths · accessibility basics implemented · no inert controls · README/PROGRESS updated.

## 13. Kickoff prompt (paste into Claude Code at the repo root)

> Read `CLAUDE.md`, `PLAN.md` and `docs/RoomSync_Product_Spec_for_Claude.md` in full. Then start **Phase 0** only. Check `node -v`, `docker info` and `supabase --version` first and tell me anything missing before installing or changing anything. Follow the working rules in PLAN.md §0, finish with the checkpoint report in §9, and wait for me to say "continue" before Phase 1.
