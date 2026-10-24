# RoomSync — Progress

Read this at the start of every session; update it at the end.

## Status
| Phase | State |
|---|---|
| 0 Bootstrap | Done (`phase-0`) |
| 1 Schema and security | Done (`phase-1`) |
| 2 Database functions | Done (`phase-2`) |
| 3 App foundation and auth | Done (`phase-3`) |
| 4 Households and membership | Done (`phase-4`) — awaiting owner "continue" |
| 5–13 | Not started |

## Theme (changed after Phase 4, owner request)
- **Light mode only.** The app never follows the OS dark mode (`color-scheme: light only`, no dark tokens). Verified in a browser forced into dark mode: the page stays `#FDF8F2`.
- **Tokens are sampled from the UI mockups' pixels**, not approximated: page `#FDF8F2`, surface `#FFFFFF`, card border `#EFF0F1`, coral `#FF9B85` (fills, active tab/nav, FAB, underline), logo tile `#FE8D76`, amber `#FEB801`, peach banner `#FFEBD5`/`#FFD7C1`, ink `#3D3D3D`, secondary `#6B7280`, green `#0DA576`, muted nav icon `#D5CCCB`.
- **Shapes and type follow the mockups:** 12px radii on cards/inputs/buttons, hairline 1px borders, white header with a rounded bottom edge and soft shadow, regular-weight section titles, pale-pink form fields, pill buttons for onboarding, **Nunito** (bundled via `@fontsource-variable/nunito`, self-hosted: no external font request).
- **Illustrations** on the welcome, set-up and join screens are cut from the mockup frames (`public/illustrations/*.png`, feathered edges). If you have the original illustration files, drop them in at the same names for crisper output.
- **Known accessibility gap, kept on purpose to match the design:** white text on coral (`#ff9b85`, about 2.2:1) and on amber (`#feb801`, about 1.9:1) is below WCAG AA 4.5:1. Small coral *text* (links, labels) uses a slightly deeper coral (`--coral-text #e4573d`, about 3.7:1). To reach AA, change `--primary`/`--on-primary` and `--on-amber` in `src/index.css` (one-line each); say the word and I'll do it.
- Screens that have no mockup (sign up, log in, settings, members) reuse the same components, so they match by construction.

## Phase 4 decisions and deviations
- **Where things live:** household pages sit under the **You** tab (`/you/members`, `/you/invites`, `/you/household`), as in the spec's IA (You → household settings, members, invitations). Create and join are full-screen flows at `/start/create` and `/start/join`, outside the tab shell.
- **Create flow:** step 1 is name only (currency, default split, chore reminders are under "More options"); step 2 invites roommates and is skippable. The invite code is shown once with a copy button; the screen says it's pending and lets the user continue immediately. Household and invite creation are two RPCs, so a user can end up with a household and no invite if step 2 fails; that is fine because invites can be created later from You → Invite roommates.
- **Join flow:** code → preview (name, member count, expiry only) → confirm. The UI checks the code format locally first (so typos don't count toward the 10-failures/hour throttle), then maps every `invalid_invite:*` reason to its own message. `preview_invite`/`join_household` `ok:false` results are converted to thrown errors in `src/api/invites.ts`, as planned in Phase 2. A user who already has a household is redirected home from the join and create screens. `?code=` prefills the field. The invite is a code, not a link: a link would be lost across the login redirect.
- **Roles:** only the owner sees Manage; admin/member get an explanation. Ownership transfer shows the consequences and defaults focus to Cancel. A member who is moving out cannot be made owner (UI) — the server also requires `active`.
- **Settings:** owner/admin edit; everyone else sees read-only values with one explanation at the top (not repeated per field). The currency select locks (with the reason on screen) once an expense or settlement exists. Edits are kept across a failed save or a version conflict, with a Refresh button.
- **Archived households:** a banner on every page; invite create/revoke, role changes, settings save are disabled with the reason; only the owner can restore (an admin sees it disabled with "Only the owner can…").
- **Home:** the spec §8.4 empty state ("Your house is ready") plus the member avatars; the "Add your first item" button is disabled with a visible reason until Phases 5–7 provide the screens. An owner/admin who is alone gets an "Invite roommates" shortcut.
- **Cache freshness:** found by the browser test — members, invites, household and has-money queries use `staleTime: 0`, so opening a screen always refetches. Without it, Alice would not see Bob after he joined for up to 30 seconds. Realtime (Phase 7) will make this live.
- **New UI primitives:** `SelectField` and `Toggle` (both keep a disabled control focusable and show the reason).
- **Tests:** 322 unit/component tests (87 new), plus **5 Playwright e2e tests** against the local stack with two real browser contexts: create → invite → join → both see two members; invalid/revoked/unknown codes; one household per user; promote → transfer ownership → archive → restore with writes disabled; settings edit visible to another member and read-only for a plain member. Run twice with no flakes. Mutation-checked (showing owner controls to all, ignoring archived state, skipping the local code check each failed tests).
- **e2e prerequisites:** `npx supabase start` and `npx playwright install chromium`. `npm run e2e` starts the dev server itself and creates unique users each run (no reset needed). Never run it against a hosted project.

## Phase 3 decisions and deviations
- **Open design questions were not answered, so spec/plan defaults were used** (owner replied "continue"): navigation is Home / Expenses / Chores / House / You (not the mockups' Shopping/Tasks/Finance/Settings); no chat tab, no points/leaderboard, no QR scan, no photo/receipt upload, no reminders. **Visual style comes from the mockups** (warm cream/peach/coral, rounded cards, amber onboarding pills). Any of the skipped features can be added later as its own phase; see `docs/ui-reference-notes.md` for the list.
- **Two accessibility departures from the mockups:** action buttons use a deeper coral (`#C8432B`, white text 4.9:1) because the mockup's `#FF9C82` with white text is ~2.2:1; amber buttons carry dark text. Brand coral is kept for the logo, tints, and icons.
- **Fonts:** system/rounded stack with Nunito if installed. No external font requests (PLAN §8 Phase 3).
- **Offline copy** is "You’re offline. Changes you make now won’t be saved." instead of spec §16's "may not be synced", because nothing syncs (CLAUDE.md rule 4).
- **Not-yet-built controls are disabled with a visible reason**: Create/Join household cards ("Household setup arrives in the next update."), the notifications bell ("The activity centre arrives in a later update."). Tabs other than You show a plain "Coming soon" state. Disabled controls use `aria-disabled` (stay focusable, reason via `aria-describedby`).
- **"I have an invite"** goes to sign-up with a hint (join needs an account; the join screen is Phase 4).
- **Auth:** email + password, PKCE, `HashRouter`; password-reset emails return to the app root (`?code=` is exchanged by supabase-js). Password minimum is 8 on the client **and** enforced by the server (`supabase/config.toml` `minimum_password_length = 8`; hosted project must be set the same in Phase 10).
- **Env safety:** `readEnv` rejects a `sb_secret_…` or `service_role` key in the client env and shows a readable screen instead. Build output was scanned: only the publishable key is in the bundle.
- **Error mapper** (`src/lib/errors.ts`) covers the whole PLAN §6 vocabulary, auth errors, network failures, Postgres `42501`/`23505`; unknown errors show the generic message and raw text is never shown. `preview_invite`/`join_household` `ok:false` results will be converted in Phase 4's `src/api`.
- **Seed script** `npm run seed:dev` (`scripts/seed-dev.mjs`): refuses non-local URLs; gets the local keys from the environment or `supabase status` at run time (never stored); creates Aarav, Riya, Kunal, Sneha (`@roomsync.test`, password `roomsync-local-1`) and "Flat 4B" through the real RPCs: 10 expenses (equal/custom/percentage, one edited), 1 settlement, 5 chores (weekly rotation, one completed so the next was spawned), 4 groceries, 2 announcements (one pinned). Idempotent: re-running just prints the accounts. Split math in the script duplicates the rule from `src/domain/splits.ts` (the DB validates it).
- **Testing:** 235 unit tests (domain 49 + UI primitives, auth validation/screens, routing guards, env, errors, offline, error boundary). A scratch Playwright run (not committed) confirmed in a real browser: validation, sign-up → set-up screen, session survives reload, log in as the seeded user, sign out, wrong password keeps the typed email, no console errors. Real e2e specs start in Phase 4.
- **Known follow-ups:** bundle is ~625 kB (code-splitting in Phase 9); the set-up screen's greeting appears after the profile loads (brief generic title first).

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
