# RoomSync — Product Requirements & Build Specification
**Version:** 1.0  
**Purpose:** Product brief and implementation guide for an AI coding agent (Claude or similar) to build a working RoomSync application.

> **Implementation instruction:** Treat this document as the product source of truth. Build a working, coherent application—not just static mockups. Where details are not specified, choose sensible defaults, document decisions, and keep the architecture extensible. Do not claim integrations or AI functionality work unless they are implemented. Use realistic demo data only when clearly labelled.

## 1. Product Overview

**Product:** RoomSync  
**Tagline:** Shared living, simplified.

RoomSync is a mobile-first shared-living management app for roommates, flatmates, partners, and co-living spaces. It brings everyday shared-household logistics into one place:
- Shared expenses and settlements
- Chores and rotating responsibilities
- Shared grocery lists and household inventory
- House announcements and a shared calendar
- Calm, structured ways to raise household concerns
- Personal activity and household settings
- Move-out and final-settlement process

**Vision:** Help people coordinate shared living with less confusion, fewer forgotten tasks, and less interpersonal friction.

**Value proposition:** “Know what needs attention, see who is responsible, and keep your household running smoothly.”

### Product principles
1. Clarity before decoration: every screen makes the next action obvious.
2. Fairness and transparency: show how amounts, assignments, and decisions were calculated.
3. Low-friction daily use: common tasks should be quick and accessible.
4. Respectful communication: never shame or publicly rank people unnecessarily.
5. Progressive disclosure: keep common actions simple; reveal advanced options when needed.
6. Trustworthy states: distinguish saved, pending, failed, and completed actions.
7. Accessible by default: readable type, adequate contrast, accessible controls, and no reliance on color alone.
8. Honest automation: predictions are estimates unless backed by real data.

## 2. Target Users and Personas
These are initial design hypotheses, not validated research findings. Validate through user interviews and usability testing.

### Persona A — Aarav, the time-poor working professional
- Age: 26; shares an apartment with colleagues and has a demanding work schedule.
- Goals: record shared spending quickly, receive useful reminders, avoid repeated follow-ups.
- Pain points: forgotten bills, manual calculations, unclear chore ownership.
- Needs: quick expense entry, clear balances, useful notifications, scannable dashboard.

### Persona B — Riya, the social student flatmate
- Age: 21; shares a flat with friends and coordinates much through chat.
- Goals: make grocery and chore coordination easy and collaborative.
- Pain points: duplicate grocery purchases, missed messages, forgotten chores.
- Needs: shared lists, fast updates, friendly feedback, lightweight chore rotation.

### Persona C — Kunal, the budget-conscious flatmate
- Age: 24; carefully manages monthly spending.
- Goals: understand what he owes, what others owe him, and how household spending changes.
- Pain points: unclear splits, hidden costs, settlement disputes.
- Needs: expense history, split breakdowns, settlement summaries, change history.

### Persona D — Sneha, the conflict-averse housemate
- Age: 25; values a peaceful household and finds direct confrontation uncomfortable.
- Goals: raise concerns respectfully and understand how they will be addressed.
- Pain points: passive-aggressive messages, unclear expectations, fear of being blamed.
- Needs: neutral language, private concern submission, transparent status, control over identity visibility.

## 3. Primary Jobs to Be Done
1. When I pay for something shared, I want to record it and calculate each person’s share so nobody has to remember or calculate manually.
2. When a household task needs doing, I want the owner and due date to be clear so responsibilities are not silently transferred to one person.
3. When we run out of an essential, I want to add it to a shared list so the next person shopping can buy it.
4. When household information changes, I want everyone who needs to know to see it in a structured place.
5. When something bothers me, I want to communicate it constructively without the app escalating the situation.
6. When I leave the household, I want a transparent record of outstanding balances and shared-item ownership.

## 4. Scope and Prioritization

### MVP — build these first
- Authentication or clearly labelled local demo mode
- Create a household and join via invite code/link
- Home dashboard
- Expense creation, participant selection, split calculation, expense history
- Balances and manual settlement recording
- Chores: create, assign, rotate, complete, and view history
- Shared grocery list with needed/purchased states
- Basic household announcements
- In-app activity centre
- Profile, household settings, notification preferences
- Move-out initiation and final balance summary
- Loading, empty, validation, error, offline, and success states

### Phase 2
- Receipt scanning/OCR
- Itemized grocery-bill splitting
- Smart low-stock and consumption suggestions
- Shared inventory quantities
- Calendar integrations
- Advanced analytics
- Optional chore points/badges
- Concern-resolution board with identity controls
- AI-assisted tone rewriting, with explicit user approval

### Not in MVP unless a real integration exists
- Real money transfers or payment gateway operations
- Automatic utility-bill fetching
- Live location tracking
- Automatic consumption prediction without history
- Background monitoring of users
- AI that sends messages or files complaints without confirmation

**Important:** Never simulate a real payment. “Record settlement” means a user records a payment completed externally unless a genuine payment integration exists.

## 5. Platform and Technical Direction
Build a responsive mobile-first application. If supported, a maintainable stack could be:
- Frontend: React + TypeScript
- Mobile-ready UI: responsive web app/PWA, or React Native/Expo if native mobile is supported
- Styling: Tailwind CSS or equivalent token-driven system
- Backend/data: platform-supported backend; Supabase is a reasonable option for auth, relational data, and realtime updates if credentials and environment support it
- Validation: schema-based validation such as Zod
- Charts: lightweight, accessible charts only where useful

Inspect the environment before implementation and choose the simplest stack that can genuinely run there. If backend credentials are unavailable, build functional local/demo mode with persistent local storage and document limitations. Keep data access behind a service layer so a real backend can be added later.

### Engineering quality
- TypeScript types for core entities
- Reusable components and shared design tokens
- Form validation and useful error messages
- No dead buttons or decorative controls pretending to work
- No hardcoded secrets in client code
- Loading, empty, success, and failure states
- Realistic demo seed data
- README with setup, run, test, and deployment instructions
- Tests for important calculations and critical flows

## 6. Information Architecture

### Primary navigation
Use five-item bottom navigation on mobile:
1. **Home** — overview and actions
2. **Expenses** — shared costs and settlements
3. **Chores** — responsibilities and rotation
4. **House** — groceries, inventory, announcements, calendar, concerns, emergency contacts
5. **You** — personal profile, preferences, household settings, move-out

Notifications/activity should be reachable from a clear icon in the header. A global quick-action button may provide shortcuts but must not obscure content or conflict with navigation.

### Full hierarchy
```text
RoomSync
├── Authentication
│   ├── Welcome / onboarding
│   ├── Sign up / log in
│   ├── Verification
│   └── Demo mode (if auth is not configured)
├── Household Setup
│   ├── Create household: name, optional avatar, preferences, invite roommates
│   └── Join household: invite code/link, preview household, confirm join
├── Home
│   ├── Household overview
│   ├── Today's priorities
│   ├── Upcoming due dates
│   ├── Recent activity
│   └── Quick actions
├── Expenses
│   ├── Balance summary
│   ├── Add expense: manual entry, payer, participants, split method, review/save
│   ├── Receipt scan (Phase 2)
│   ├── Expense details and edit history
│   ├── Expense history and filters
│   ├── Balances
│   ├── Record settlement
│   └── Spending insights
├── Chores
│   ├── Today / upcoming / completed
│   ├── Chore details
│   ├── Create / edit chore
│   ├── Assign person
│   ├── Rotation settings
│   ├── Completion history
│   └── Optional points / achievements
├── House
│   ├── Grocery list: needed, purchased, add/edit item, quantity/notes
│   ├── Shared inventory (Phase 2)
│   ├── Announcements
│   ├── Shared calendar (basic MVP or Phase 2)
│   ├── Household concerns (Phase 2)
│   └── Emergency contacts
├── Activity & Notifications
│   ├── Unread activity
│   ├── Expense updates
│   ├── Chore reminders
│   ├── Grocery updates
│   └── Announcements
└── You / Settings
    ├── Personal profile and contribution overview
    ├── Notification preferences
    ├── Privacy settings
    ├── Household settings, members, invitations
    ├── Help / support
    └── Move-out: review balances, shared items, confirm leave, final status
```

## 7. Core User Journeys

### Journey A — First-time user creates a household
1. Open RoomSync.
2. View concise welcome screen.
3. Sign up/log in, or enter clearly labelled demo mode.
4. Choose Create a household or Join a household.
5. Enter household name and optional settings.
6. Invite roommates via shareable code/link or QR if supported.
7. Show invitation-pending state; do not assume invitees have joined.
8. Land on Home with helpful empty states and suggested next actions.

**Acceptance criteria:** optional setup can be skipped; invite code/link can be copied/shared; invalid or expired invites explain the problem; user can continue before roommates join; empty states explain next steps.

### Journey B — User joins an existing household
1. Select Join a household.
2. Enter invite code or open invite link.
3. Preview household name and relevant details without exposing private member data.
4. Confirm joining.
5. Household appears in app and Home reflects current data.

**Edge cases:** invalid, expired, revoked, or already-used invite; user already belongs; household full/archived; network failure; multiple household invitations.

### Journey C — Add and split an expense
1. Open Expenses or quick action.
2. Tap Add expense.
3. Enter title, amount, date, category, and payer.
4. Select participants.
5. Choose equal, custom-amount, percentage, or itemized split if supported.
6. Review exact share for every participant.
7. Validate split total equals expense total within currency precision.
8. Save.
9. Show success and update balances/history.
10. Add in-app activity for affected members.

**Acceptance criteria:** amount > 0; currency is explicit and consistent within a household; use integer minor units (e.g. paise); rounding differences are deterministic and transparent; payer and participants are visible; edits update balances and record actor/time; deleted expenses leave active balances but retain appropriate audit history.

### Journey D — Record a settlement
1. Open balance summary.
2. Select suggested payer/recipient pair.
3. Review amount and current balance.
4. Select Record settlement.
5. Choose date and optional note/reference.
6. Confirm, update balance, and show a receipt-like record.

This records an externally completed payment unless a real payment integration exists. Never imply RoomSync transferred money when it did not.

### Journey E — Manage a chore
1. Open Chores and view Today, Upcoming, Completed.
2. Create a chore with title, optional description, due date, assignee, recurrence/rotation settings.
3. Save; assigned person sees it on Home and Chores.
4. Assigned person marks it complete.
5. Completion history and household activity update.

**Edge cases:** assignee no longer a member; concurrent edits; overdue/repeatedly skipped task; recurring duplicates; accidental completion with undo/reopen; rotation skips inactive/removed members and explains changes.

### Journey F — Add groceries
1. Open House → Grocery list.
2. Add item name, optional quantity/category/note.
3. Item appears under Needed.
4. A roommate marks it purchased.
5. It moves to Purchased with purchaser and timestamp.
6. User can undo or move it back to Needed.

**Edge cases:** duplicate item; concurrent addition; unknown quantity; item purchased outside app; accidental deletion; offline changes with clear sync status.

### Journey G — Raise and resolve a concern (Phase 2)
1. Open House → Concerns.
2. Choose category: cleanliness, noise, shared costs, guests, or other.
3. Enter concern.
4. Choose identity visibility; explain exactly who can see the author.
5. Optionally request tone rewrite.
6. Review and approve rewritten message before posting.
7. Submit and track status: Needs discussion, In progress, Resolved.
8. Allow update/withdrawal where appropriate.

**Trust requirements:** explain what “anonymous” really means; never promise anonymity if admins/backend records can identify author; AI never auto-publishes; avoid public shame scores; provide report/mute/moderation paths if needed; limit access to intended household members.

### Journey H — Move out
1. Open You → Household settings → Leave household.
2. Explain consequences before proceeding.
3. Show expenses, outstanding balances, settlements, and shared items requiring resolution.
4. Allow review or dispute.
5. Ask for explicit confirmation.
6. Mark user as leaving/inactive according to workflow.
7. Stop assigning new chores/expenses after effective exit.
8. Preserve historical records for remaining members.
9. Show final status and unresolved items.

Do not automatically declare dues paid or calculate deposit entitlement unless amounts and agreed rules are provided. Label estimates and disputed items clearly.

## 8. Screen-by-Screen Requirements

### 8.1 Welcome / onboarding
- Brand: RoomSync
- Headline: “Shared living, simplified.”
- Supporting copy: “Keep shared expenses, chores, groceries, and house updates in one place.”
- Primary CTA: Get started
- Secondary CTA: I have an invite
- Keep onboarding concise; do not force a long marketing carousel.
- Provide skip/continue controls with accessible labels.

### 8.2 Authentication
- Sign up and log in forms
- Email/phone verification only if supported by backend
- Password reset if password auth is implemented
- Terms/privacy links if available
- Helpful validation and retry states
- Demo mode clearly labelled; do not imply secure sync

### 8.3 Create / join household
- Clear choice cards
- House name and optional image
- Optional settings: currency, default expense split, chore reminders
- Invite/share controls
- Copy invite link with success feedback
- Pending invite list with revoke/resend where supported

### 8.4 Home dashboard
**Header:** household name/avatar, member avatars/count, notifications icon.

**Overview:** “Your household at a glance”; amount you owe; amount owed to you; upcoming due items. Avoid one ambiguous “house balance.”

**Today's priorities:** chores assigned to current user, expenses requiring attention, grocery alerts only if inventory data exists, upcoming events.

**Recent activity:** expense added/edited, chore completed, grocery item added/purchased, announcement posted.

**Quick actions:** Add expense, Add chore, Add grocery, Post announcement.

**Empty state:** “Your house is ready” / “Add your first expense, chore, or grocery item to get everyone organised.” / CTA: “Add your first item”.

Do not invent a “house health score” in MVP unless its formula is transparent, validated, and useful. If shown as a concept, label it optional/future.

### 8.5 Expenses
**Summary:** You owe, You are owed, recent expenses, View all.

**Expense fields:** title/description, amount, currency, date, category, paid by, participants, split method, optional notes/receipt reference.

**Split methods:**
- Equal: distribute evenly across selected participants.
- Custom amounts: shares must sum exactly to total; show remaining difference.
- Percentage: percentages must total 100%; use deterministic rounding.
- Itemized: Phase 2 unless robust item model is implemented.

**Expense details:** split breakdown, status, created/updated by and timestamp, permission-aware edit/delete, change history.

**Filters:** date range, category, payer, participant.

**Empty state:** “No shared expenses yet” / “Add a bill or purchase to keep household spending clear.” / CTA: “Add expense”.

### 8.6 Chores
**Views:** Today, Upcoming, Completed.

**Fields:** title, optional description, assignee, optional due date/time, optional recurrence, optional rotation order, status, creator, timestamps.

**Actions:** create, edit, reassign, mark complete, undo/reopen, delete/cancel with confirmation.

**Copy:** “What needs doing?”; “This chore is still waiting to be completed.”; “Nice work — task completed.”

Gamification is optional and secondary. Users can manage chores if they disable it. Avoid punitive public leaderboards by default.

### 8.7 House → Grocery list
**Sections:** Needed, Purchased.

**Fields:** name, optional quantity/unit, category, note, status, added by, purchased by and timestamp.

**Actions:** add, edit, mark purchased, move back to Needed, delete with undo where possible.

**Empty state:** “Nothing on the shopping list” / “Add items before your next grocery run.” / CTA: “Add grocery”.

### 8.8 Shared inventory (Phase 2)
- Categories: Kitchen, Bathroom, Cleaning, Other
- Item quantity/unit, optional low-stock threshold, last updated by/date
- Do not claim automatic stock detection without a connected data source.
- Keep grocery-list items distinct from inventory stock records.

### 8.9 Announcements
- Create announcement with title/message and optional event/date
- Author and timestamp
- Pin important posts if supported
- Edit/delete permissions
- Distinguish announcements from direct messages; do not build full chat unless scoped

### 8.10 Shared calendar
- Upcoming events list first; calendar grid optional
- Event title, date/time, optional location/note
- Event types: rent, cleaning, guest, repair, other
- Consistent time zone; edit/cancel controls; reminder preferences

### 8.11 Concerns (Phase 2)
- Category, message field, identity visibility, optional AI rewrite preview, review-before-submit, status/history, privacy explanation
- No automatic diagnosis of roommate intent or emotional state

### 8.12 Activity / notifications
- Read/unread states
- Group related events when useful
- Deep-link each item to relevant screen
- Preferences by category and quiet hours
- Avoid duplicate notifications
- Support in-app notifications if push is unavailable

### 8.13 Profile / settings
- Name, avatar, contact details
- Personal expense/chore summary
- Notification preferences, privacy
- Household members/invitations and defaults
- Currency/locale, help/support, leave household, sign out

### 8.14 Move-out
- Consequence explanation
- Balance summary and shared-item ownership review
- Dispute/notes, confirmation, leaving/pending/finalized status
- Preserve past records for remaining members

## 9. Design System

### Visual direction
Polished, warm, modern consumer app. Aim for clarity, hospitality-like warmth, and productivity-tool simplicity without copying another brand directly.

### Suggested color tokens
**Light theme**
- Primary: `#4F46E5`
- Primary pressed: `#4338CA`
- Success: `#15803D`
- Warning: `#B45309`
- Danger: `#B91C1C`
- Background: `#F8FAFC`
- Surface: `#FFFFFF`
- Text primary: `#0F172A`
- Text secondary: `#475569`
- Border: `#E2E8F0`

**Dark theme**
- Background: `#0B1220`
- Surface: `#111827`
- Elevated surface: `#1F2937`
- Text primary: `#F8FAFC`
- Text secondary: `#CBD5E1`
- Border: `#334155`

Check text/background contrast; these are starting tokens, not a guarantee every combination passes accessibility.

### Typography
- Prefer Inter or platform native font.
- Establish tokens for display, title, heading, body, label, caption.
- Avoid unnecessarily small text; support dynamic text sizing where possible.

### Spacing and layout
- 4-point spacing increments, with an 8-point rhythm for most layouts.
- Consistent page gutters and card padding.
- Aim for 44–48 CSS px touch targets where practical.
- Respect safe areas and bottom navigation; avoid dense dashboards.

### Reusable component library
- Buttons: primary, secondary, tertiary, destructive, loading, disabled
- Text fields, amount input, dropdown/select, date picker
- Cards and section headers
- Avatar and avatar group
- Status and category chips
- Bottom navigation, header/back navigation
- Modal/dialog/bottom sheet
- Toast/snackbar, empty state, loading skeleton, error/retry
- Expense row and split breakdown
- Chore card
- Grocery row with status control
- Activity item, confirmation dialog, validation message

### Interaction rules
- Visible pressed, focused, disabled, loading, success, error states
- Confirm destructive actions and explain consequences
- Prefer undo for reversible actions
- No hover-only interactions
- Respect reduced-motion settings
- Never rely on color alone for status
- Preserve form values after recoverable errors

## 10. UX Copy Strategy

### Voice
Friendly, calm, clear, helpful, collaborative, emotionally aware.

### Principles
- Concise, human language
- Explain consequences before irreversible actions
- Never blame or shame a roommate
- Use specific action labels instead of generic “Submit” where possible
- Be transparent when data is estimated or unsynced

### Example copy
- Welcome: “Shared living, simplified.”
- Home section: “What needs attention today”
- Expense creation: “Split a new expense”
- Receipt scanning: “Reading your receipt…” (only if scanning exists)
- Chore reminder: “This chore is still waiting to be completed.”
- Chore completion: “Nice work — task completed.”
- Grocery empty state: “Nothing on the shopping list”
- Concern entry: “Would you like to raise a household concern?”
- Offline: “You’re offline. Your latest changes may not be synced.”
- General error: “Something went wrong. Please try again.”
- Settlement: “Settlement recorded,” not “Payment sent” unless the app actually sent payment.

### CTA examples
Get started; Join a household; Create a household; Invite roommates; Add expense; Review split; Save expense; Record settlement; Create chore; Mark as done; Add grocery; Mark purchased; Post announcement; Review balances; Leave household.

## 11. Five Critical Edge Cases

### 1 — Disputed expense
- Show original amount, payer, participants, exact calculation.
- Only authorised users can edit.
- Record change history and notify affected participants when split changes.
- If a settlement was already recorded, explain impact on balances.
- Never silently overwrite financial history.

### 2 — Chore avoidance or reassignment
- Show overdue state without shaming.
- Allow reassignment or reopening.
- Preserve completion history.
- Update rotation when members are removed.
- Avoid opaque or punitive fairness scores.

### 3 — Roommate leaves unexpectedly
- Stop new assignments after effective exit.
- Preserve history.
- Display unresolved amounts and disputed items separately.
- Do not automatically mark dues paid.
- Let remaining members continue managing the household.

### 4 — Notification fatigue
- Category-level preferences and quiet hours
- In-app-only option
- Avoid duplicate notifications
- Bundle low-priority activity where useful
- Keep critical security/account notices separate

### 5 — Sensitive household concern
- Explain identity visibility clearly
- Never promise true anonymity if it cannot be guaranteed
- Require review before AI-rewritten text is submitted
- Avoid auto-posting or accusatory wording
- Restrict access to intended members and allow withdrawal/editing where appropriate

**Additional edge cases:** invalid/expired invitation; duplicate grocery items; concurrent edits; currency rounding; offline sync conflict; accidental completion/deletion; empty first-run states; permission denied; account deletion/export; household archived while open.

## 12. Suggested Data Model
Use relational data or equivalent with clear ownership and household boundaries.

### User
`id`, `displayName`, `email` or phone identifier, optional `avatarUrl`, `createdAt`, `updatedAt`.

### Household
`id`, `name`, optional `avatarUrl`, `createdBy`, `currencyCode`, `status` (active/archived), timestamps.

### HouseholdMember
`id`, `householdId`, `userId`, `role` (owner/admin/member), `status` (invited/active/leaving/left), `joinedAt`, optional `leftAt`.

### Invitation
`id`, `householdId`, `createdBy`, secure token reference/hash, `expiresAt`, optional `maxUses`, `useCount`, `status` (active/revoked/expired), `createdAt`.

### Expense
`id`, `householdId`, `title`, `amountMinor` (integer in smallest currency unit), `currencyCode`, `category`, `paidByMemberId`, `expenseDate`, optional `notes`, `createdBy`, timestamps, optional `deletedAt`.

### ExpenseShare
`id`, `expenseId`, `memberId`, `shareAmountMinor`, `splitMethod`, `createdAt`.

### Settlement
`id`, `householdId`, `fromMemberId`, `toMemberId`, `amountMinor`, `currencyCode`, `settlementDate`, optional `note`, `recordedBy`, `status` (recorded/reversed/disputed), `createdAt`.

### Chore
`id`, `householdId`, `title`, optional `description`, nullable `assigneeMemberId`, optional `dueAt`, optional `recurrenceRule`, optional `rotationConfig`, `status` (open/in_progress/completed/cancelled), `createdBy`, optional `completedAt`, timestamps.

### GroceryItem
`id`, `householdId`, `name`, optional `quantity`, `unit`, `category`, `note`, `status` (needed/purchased), `addedByMemberId`, optional `purchasedByMemberId`, optional `purchasedAt`, timestamps.

### Announcement
`id`, `householdId`, `title`, `body`, `createdBy`, timestamps, optional `pinnedAt`.

### ActivityEvent
`id`, `householdId`, nullable `actorMemberId`, `eventType`, `entityType`, `entityId`, structured non-sensitive `metadata`, `createdAt`. Per-user read state may be a separate table.

### HouseholdConcern (Phase 2)
`id`, `householdId`, `category`, `body`, restricted `authorMemberId` if identity visibility requires it, `visibilityMode`, `status`, timestamps, optional `resolvedAt`.

### AuditEvent
`id`, `householdId`, `actorUserId`, `entityType`, `entityId`, `action`, limited before/after snapshots, `createdAt`.

**Data integrity:** enforce household membership on every query; prevent cross-household access by ID manipulation; use transactions/constraints for balance-changing operations; store currency as integer minor units; avoid sensitive data in logs/metadata; enforce access controls server-side.

## 13. Expense Calculation Rules

### Equal split
1. Convert total to integer minor units.
2. Divide among selected participants.
3. Distribute remainder deterministically (e.g. one minor unit at a time in stable participant order).
4. Ensure shares sum exactly to total.

### Custom split
- Each share must be non-negative.
- Shares must sum exactly to total.
- Show remaining difference before enabling save.

### Percentage split
- Percentages must total 100% within documented tolerance.
- Convert to minor units using deterministic rounding.
- Allocate remainder deterministically.
- Show final amounts for review.

### Balance calculation
For each expense, credit the payer for the amount paid and charge each participant their recorded share. Net balance combines expense shares and settlements. Document the model consistently. If implementing simplified settlements, calculate suggested transfers that settle net balances while preserving the total. Label them suggestions; user confirms before recording.

## 14. Security, Privacy, and Permissions
- Authenticate users if real backend is configured.
- Enforce server-side access controls for all household data.
- Validate input on server and client.
- Use secure, expiring invite tokens; never log raw secrets.
- Avoid leaking private data through push notifications.
- Make roles/permissions explicit.
- Confirm leaving/archiving household.
- Keep audit history for important expense and membership changes.
- Never implement fake auth that implies data is secure.
- Clearly label local demo mode and do not present it as production-secure.
- Provide a basic privacy notice explaining stored data and household visibility.
- Do not collect precise location or background behavioral data; RoomSync does not need it.

## 15. Accessibility and Quality
- Aim for WCAG 2.2 AA contrast where applicable.
- Keyboard navigation and visible focus in web builds.
- Accessible names for icon-only controls.
- Labels/helper text for forms; announce errors/status to assistive technology.
- Support reduced motion.
- Never rely on color alone for status.
- Locale-aware dates, numbers, and currency.
- Ensure bottom navigation does not cover content.
- Test small screens and large-text layouts.

## 16. Error, Loading, and Empty States
Every data-backed screen needs loading, empty, error/retry, success, permission-denied where relevant, and offline/sync states if supported.

Example copy:
- No expenses: “No shared expenses yet. Add a bill or purchase to keep household spending clear.”
- No chores: “No chores assigned yet. Add a task to get started.”
- No groceries: “Nothing on the shopping list. Add items before your next grocery run.”
- Offline: “You’re offline. Your latest changes may not be synced.”
- Save error: “We couldn’t save that change. Your information is still here—please try again.”
- Invalid invite: “This invite link is no longer valid. Ask a household member for a new one.”
- Permission error: “You don’t have permission to make this change.”

Never clear a form after a failed save unless the user chooses to discard it.

## 17. Analytics Events (Optional)
Track necessary product events only; never log sensitive concern/message contents.
- `signup_completed`
- `household_created`
- `invite_created`
- `invite_accepted`
- `expense_created`
- `expense_edited`
- `settlement_recorded`
- `chore_created`
- `chore_completed`
- `grocery_item_added`
- `grocery_item_purchased`
- `announcement_created`
- `moveout_started`
- `moveout_completed`

Use analytics to find friction, not to shame or rank roommates.

## 18. Testing Plan

### Unit tests
- Equal split and remainder handling
- Custom split validation
- Percentage split and rounding
- Net balance calculations
- Settlement recording/reversal
- Chore rotation rules
- Invitation expiry and membership checks

### Integration tests
- Create household → invite → join
- Add expense → verify shares/balances
- Record settlement → verify balances
- Create chore → assign → complete
- Add grocery → mark purchased → move back to Needed
- Leave household → preserve history and remove future assignments

### UI tests
- Onboarding and empty states
- Form validation
- Tab navigation
- Loading/error recovery
- Responsive layout and accessible controls

### Manual usability scenarios
1. First-time user creates household without help.
2. User adds a ₹1,000 expense split across three people.
3. User explains why they owe a particular amount.
4. Roommate finds and completes today’s chore.
5. User adds milk to grocery list and marks it purchased.
6. User finds notification settings.
7. User starts move-out and explains the consequences.

## 19. Suggested Implementation Milestones

### Milestone 1 — Foundation
Project setup, routing, tokens, components, responsive app shell, five-tab navigation, demo data, loading/empty/error states.

### Milestone 2 — Household and membership
Auth/demo mode, create household, join via invite, member list and permissions.

### Milestone 3 — Expenses
Add/edit/delete, split calculation, details/history, balances, record settlement, financial unit tests.

### Milestone 4 — Chores and groceries
Chore CRUD/assignments/completion/rotation basics, grocery CRUD/purchase state, activity updates.

### Milestone 5 — House coordination
Announcements, notification preferences, basic calendar if feasible, settings/member management.

### Milestone 6 — Lifecycle and polish
Move-out flow, permissions/edge cases, accessibility pass, responsive QA, integration tests, README/deployment notes.

### Milestone 7 — Phase 2
Receipt scanning, inventory prediction, concern resolution, optional AI rewriting, advanced analytics.

## 20. Definition of Done
A feature is done only when:
- Primary journey works end-to-end.
- Data persists after refresh/reopen according to storage mode.
- Validation prevents invalid data.
- Loading, empty, success, and error states exist.
- Permissions are enforced.
- Important calculations have tests.
- UI works on common mobile viewport sizes.
- Accessibility basics are implemented.
- No visible button is inert.
- README accurately explains setup and limitations.

### MVP acceptance checklist
- [ ] User enters through real auth or clearly labelled demo mode.
- [ ] User can create a household.
- [ ] User can join with a valid invitation.
- [ ] User can add, edit, and view expenses.
- [ ] Splits are accurate to smallest currency unit.
- [ ] User sees balances and records a settlement without fake payment claims.
- [ ] User creates, assigns, completes, and reopens chores.
- [ ] User adds, edits, purchases, and restores grocery items.
- [ ] Home updates after changes.
- [ ] Activity feed reflects important actions.
- [ ] Notification preferences work.
- [ ] Move-out shows outstanding records and consequences.
- [ ] Household data is isolated.
- [ ] Errors do not silently discard input.
- [ ] Tests and setup documentation are included.

## 21. Instructions to the AI Coding Agent
1. Read this entire document before coding.
2. Inspect the existing project/environment first; do not overwrite useful work blindly.
3. Propose a concise implementation plan and identify missing credentials/platform constraints.
4. Implement in small, testable milestones.
5. Prioritize a functioning MVP over dozens of disconnected screens.
6. Use reusable components and the design tokens above.
7. Every visible control must perform a real action or be clearly disabled with an explanation.
8. Use a service/data-access layer so demo storage can later be replaced with a backend.
9. Add realistic demo seed data for a four-member household; label demo mode clearly.
10. Never hardcode secrets, API keys, or credentials.
11. Do not claim sync, AI, OCR, payments, or push notifications work unless implemented/configured.
12. Run available tests and fix errors before calling a milestone complete.
13. Include exact install, run, test, and build commands in README.
14. Summarize what is implemented, what is not, assumptions, and required configuration.
15. If the task is too large for one pass, complete MVP in milestone order instead of stopping at a visual prototype.

**Final product standard:** RoomSync should feel calm, trustworthy, polished, and practical. Build the simplest reliable product that solves real shared-living problems before adding decorative or speculative features.
