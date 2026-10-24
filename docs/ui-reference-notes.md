# UI reference notes (from the `UI/` mockups) — for Phase 3 onward

Source: 29 PNGs in `UI/` (iPhone 17 frames, ~402×874 @2x). Reviewed: welcome, join home, QR scan, home feed (message/activity), shopping (to buy/bought, add sheet), expenses (empty, add), tasks (list, new), plus avatar/ellipse assets. Frames not yet viewed in detail: the remaining numbered screens (settings, finance detail, onboarding extras).

## Look and feel
- **Warm peach/coral on cream.** Page background ≈ `#FDF7F1`; cards white or peach tint (`#FDE8D6`/`#FFE5DC`); primary coral ≈ `#FF8F77`/`#FF9C82` (buttons, active tab, FAB, links); brand wordmark coral, bold rounded sans.
- **Marketing/onboarding CTAs are amber** (`#FFB800`): pill buttons, one outlined (white + amber border), one filled. Soft coral radial glow behind flat illustrations.
- **Accent colours used for meaning:** green `#12A36B` (checkboxes, progress, "Cleaning", done/receive amounts), purple (bills/announcements), yellow/gold (achievements), red (urgent counts such as "3").
- **Shapes:** large radius (≈ 16–20px) on cards, inputs and buttons; full-pill for onboarding CTAs; bottom sheets with grab handle; circular avatars with white ring and overlap in groups; FAB circle bottom-right above the tab bar.
- **Type:** rounded humanist sans (looks like Nunito); large titles bold; labels small grey-brown; secondary text warm grey (`#B8A89A`-ish).
- **Layout patterns:** top app bar with title + share icon; tab strips with coral underline and counts "(05)"; collapsible "House Feed" banner with avatars; section headers with icon + count chip; list rows with leading checkbox and trailing assignee avatar; sticky bottom action bar (secondary white button + primary coral button).
- **Bottom nav (5):** Home (pin icon), Shopping, Tasks, Finance, Settings. Active = coral icon and label, inactive = muted rose-grey.
- **Tone of copy:** friendly and short, an emoji now and then ("Nice…", 👋, 🏠, 🎉), e.g. "One Home, One Team", "Create a task to keep our home running".
- **States seen:** empty states use a faded chat-bubble logo plus one sentence; modals/sheets dim the page.

## Where the mockups differ from the spec/plan (needs an owner decision before the relevant phase)
1. **Navigation:** mockups use Home / Shopping / Tasks / Finance / Settings; spec §6 and PLAN use Home / Expenses / Chores / House / You. Groceries and announcements would need a home in the mockup structure.
2. **Chat ("Message" tab, "Your message…" box):** spec §8.9 says do not build chat. Needs a decision (announcements only vs. a real chat feature, which has its own schema and moderation scope).
3. **Points, leaderboard, "#1 this week", scoreboard, achievements, "2 pts ahead of you":** spec §8.6 and principle 4 say avoid public rankings; gamification optional and secondary, opt-out. Needs a decision.
4. **QR scan to join and "Scan Home QR":** spec allows QR "if supported"; not in PLAN Phase 4. Needs a camera-permission and QR-library decision.
5. **Photos/receipts upload** (item photo, expense receipt): needs Supabase Storage + RLS; receipt OCR is Phase 13. Receipt "reference" upload isn't in the plan.
6. **"We'll notify them to settle up", "Remind others to settle up":** push/notifications don't exist (plan: in-app only). Copy must not promise reminders unless built.
7. **Task extras:** priority, time of day, repeat-by-weekday chips, "Ask for help"/"I will help", categories (Cleaning, Cooking, Shopping), "Mark as checked", "Set reminder", "Repeat", "Add to Favorites" on grocery items. The data model has none of these (only daily/weekly/biweekly/monthly recurrence and a due date).
8. **Grocery:** items have an assignee ("Harshal", "Anyone") and category groups (Fruits and Veggies, Dairy) with a progress bar. Model has no assignee column and category is free text.
9. **Expenses tabs "To Pay / To Receive"** and "You will receive ₹0 / per person" differ slightly from the single net-balance view in spec §8.5/D3.
10. **Currency:** mockups use ₹ (matches default INR).
