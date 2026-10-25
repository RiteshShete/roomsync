# RoomSync — project rules (auto-loaded by Claude Code)

Product: shared-living app (expenses, chores, groceries, announcements, move-out). Source of truth for product behaviour: `docs/RoomSync_Product_Spec_for_Claude.md`. Engineering plan and phases: `PLAN.md`. Current status and decisions: `PROGRESS.md` (read it at the start of every session; update it at the end).

## Commands
- `npm run typecheck` · `npm test` · `npm run build` · `npm run dev`
- `supabase start` / `supabase stop` / `supabase status` · `npm run db:reset` · `npm run db:test` · `npm run db:types`
- Gate before calling any phase done: typecheck + unit tests + `supabase test db` + build (+ e2e when it exists).

## Rules that must never be broken
1. Money is integer minor units. No floats. Use `src/domain/money.ts` for parsing and formatting.
2. Authorisation lives in the database (RLS + RPC checks). Hiding a button is not security.
3. Never commit or bundle a secret/service key. Only the Supabase URL and publishable key may reach client code. Never use a `VITE_` prefix for anything secret. Never commit `.env*` except `.env.example`.
4. Never claim an unimplemented capability (payments, sync, push, OCR, AI). Settlements are "recorded", not "sent".
5. Every visible control works, or is disabled with a stated reason. Every data screen has loading, empty, error/retry and success states, using copy from `src/copy.ts`.
6. A failed save must never clear the user's input.
7. Financial history is never silently overwritten: edits and deletes write audit rows; deletes are soft.
8. Every new table gets RLS and an isolation test. Every new `security definer` function sets `search_path = ''` and checks `auth.uid()` and membership itself.
9. TypeScript/SQL logic that must agree (splits, balances, rotation) shares test vectors. Do not change one side without the other.
10. Work one phase at a time, stop at the checkpoint, and ask when blocked by credentials or an undecided question. Do not build features from later phases.

## Conventions
- Architecture, layering and naming live in `docs/ARCHITECTURE.md`; `src/architecture.test.ts` enforces the layering. Keep logic out of components, delete dead or duplicate code as you go, and record decisions in PROGRESS.md.
- TypeScript strict; `src/domain` stays pure (no React, no Supabase imports).
- UI talks to Supabase only through `src/api/*`. Components never call `supabase.from(...)` directly.
- Conventional commits; tag finished phases `phase-N`.
- Tailwind with tokens defined as CSS variables (spec §9). Touch targets ≥ 44px. Respect `prefers-reduced-motion`.
