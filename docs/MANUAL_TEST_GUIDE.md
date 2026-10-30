# Manual test guide (phases 0–8)

Everything here runs on your own machine against a local database, so nothing you do touches real data. Plan about 40 minutes for all of it; each scenario also stands alone.

## 1. Set up

1. Start Docker Desktop.
2. In the project folder: `npx supabase start`, then `npm run db:reset`, then `npm run seed:dev`, then `npm run dev`.
3. Open http://localhost:5173.
4. Four ready accounts (password `roomsync-local-1`): `aarav@roomsync.test` (owner), `riya@roomsync.test` (admin), `kunal@roomsync.test` (member), `sneha@roomsync.test` (member). The demo household is "Flat 4B".
5. You need several people logged in at once, so use **separate browser profiles** (or one normal window plus Incognito, plus another browser). Sessions in the same profile share one login.
6. Make the browser window phone-sized (about 400 px wide) to see the real layout.

To start over at any time: `npm run db:reset` then `npm run seed:dev`.

## 2. Scenarios (what to do → what you should see)

### A. Account and household (phases 3–4)
1. Sign up a brand-new person (any email, password of 8+ characters) → you land on "Hi, <name>" with Create / Join choices.
2. Create a household "Test Flat" → step 2 shows an invite code **once** with a copy button.
3. In a second profile, sign up another person → Join with the code → both see two members.
4. Try a wrong code, then a revoked code → each gives a clear, different message.
5. As owner: Settings → Members → Manage → make someone admin; transfer ownership; Settings → Household settings → archive. While archived you should see a banner and every add/edit button disabled **with a reason**. Restore it.

### B. Expenses and settlements (phase 5)
1. Aarav: Finance → + → "Dinner", 1000, equal split between three → the review shows ₹333.34 / ₹333.33 / ₹333.33 and "₹0.01 extra assigned to Aarav".
2. Everyone's balance matches (Aarav is owed ₹666.66; the others owe ₹333.33). On Balances, tap "Why do I owe this?" → the lines add up to your balance.
3. Kunal: Record this payment → review says "This records a payment made outside RoomSync. RoomSync does not move money." → confirm → a receipt appears and Kunal's balance is ₹0.
4. Edit the expense amount → you are told what the change does to balances. Delete it → Undo from the toast brings it back.
5. As Riya, try to edit Aarav's expense → the button is disabled with a reason.
6. Dispute a recorded settlement with a reason → it leaves the balances and shows in its own section.

### C. Chores and groceries (phase 6)
1. Chores → + → "Take out trash", weekly, due today, rotate between two people → it appears under Today.
2. The assignee marks it done → "Nice work — task completed." and it names who is next; Upcoming shows next week's chore. Undo reopens it.
3. A plain member trying to complete someone else's chore → disabled with a reason.
4. Shopping → add "Milk 2 l" → add "milk" again → "Already on the list" with Update existing / Add anyway.
5. Two people tick the same item at nearly the same time → one wins; the other sees "Someone else already updated this item. We refreshed the list."
6. Delete an item → Undo brings it back.

### D. Announcements, activity, settings (phase 7)
1. Home → House Feed → the announcements line → + → post "Water off Tuesday" (the feed line then shows it). The others' bell shows **1**. The author's does not.
2. Open the bell → Activity → tap the item → you land on Announcements and the count drops. "Mark all as read" works; it is disabled with a reason when nothing is unread.
3. A plain member cannot edit or delete someone else's announcement (disabled with a reason) and sees no Pin button. An admin can pin; everyone else gets a "pinned" update.
4. Settings → Notifications → switch **Announcements** off, Save → new announcements no longer appear for you or count on your bell. Turn quiet hours on around the current time → the bell number disappears but updates are still listed, and the page says plainly there are no push notifications.
5. Reminders: create a chore due today for someone, then open the app **as that person** → Activity shows "<chore>: this chore is still waiting to be completed." once only (reload again: no duplicate). These are in-app only.
6. Realtime: keep Aarav on Home; as Kunal add a grocery → Aarav's Home shows it **without reloading**, with a brief "Updated".
7. Settings → Profile: change name and colour → others see it. Settings → Privacy, help and your data → **Download my data** gives a JSON file (names only, no emails). Account deletion text is honest ("not available yet").
8. Turn the network off (browser dev tools → Offline), try to post an announcement → it fails with "We couldn't reach RoomSync…" and **what you typed stays**.

### E. Moving out (phase 8)
1. As Kunal: Settings → Household settings → **Leave household**. Step 1 explains the consequences, including that RoomSync does not move money or work out deposits.
2. Review → you see your balance (labelled an estimate), your open chores, payments in dispute, and grocery items you added. Pick a date 3 days ahead, add a note, tick the box → **Leave household**.
3. You are still fully active: a banner shows on every page, the status screen shows the date, and you can add notes or disputes. Others see "Moving out" on the member list and an activity line.
4. Cancel move-out (it asks first) → you are back to normal.
5. Start again, then simulate the date arriving. Open the local database page (http://127.0.0.1:54323 → SQL editor) and run (use the person's real name):
   ```sql
   update public.household_members set move_out_effective_date = current_date - 1
   where status = 'leaving'
     and user_id = (select id from public.profiles where display_name = 'Kunal' limit 1);
   ```
   Then reload the app as Kunal → "You've left Flat 4B" (name and date only), then Continue → create or join. Opening the old pages shows nothing from the household.
6. As the others: Kunal is gone from Members, his chores moved to the next person (or are flagged for an admin to assign), and his old expenses are still in the history. He can no longer be picked for new expenses.
7. Try it as the **owner**: Leave household → you are told to transfer ownership first. As an **admin**: Members → Manage → Start move-out for a member works; the owner has no Manage button.
8. Choosing today as the date makes it take effect immediately.

### G. Home and the bottom bar (from the Figma design)
1. Open Home. You see the RoomSync logo and name, the **House Feed** card, and below it **Activity** with a "See all activity" link. The household's name is not shown as a title (it is the page heading for screen readers).
2. The feed has a money line ("You owe ₹… / You are owed ₹… / You're all settled up"), tap it → Balances. The next line shows the latest announcement and who posted it, tap it → Announcements. Alone in a household as the owner, a third line invites roommates.
3. The round button at the card's top-right collapses and expands the card (keyboard: Tab to it, Enter). The caret flips.
4. The overlapping circles at the card's corner are your housemates; tap them → Members.
5. The bottom bar reads **Home, Shopping, Tasks, Finance, Settings**. Shopping is the grocery list, Tasks is chores, Finance is expenses and settlements, Settings is your profile and household. The current tab's icon is coral and its label bold; page titles match the tab names.
6. There is **no chat tab, no message box and no points**: they are deliberately not built. The bell is on Home (top right) so notifications stay one tap away.

### F. Look and feel (all phases)
- Light theme only, even if your computer is in dark mode.
- Buttons: ready ones are coral with dark text; disabled ones are grey, and each says why.
- Every list has a loading, an empty and an error state (turn the network off and reload to see the error with "Try again").
- Everything reachable by keyboard (Tab / Enter / Escape in dialogs).

## 3. Automated checks you can run
`npm run typecheck`, `npm test`, `npm run db:test`, `npm run build`, `npm run e2e` (needs the stack running).

## 4. Tell me
Anything confusing, anything that felt wrong, or anything that did not match what you expected. Screenshots help.
