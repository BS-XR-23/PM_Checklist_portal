# Portal Fix Plan

Source: full-portal audit, 2026-10-14 (code review + every route crawled as all 5 roles,
desktop and mobile). Five phases, each shippable on its own, ordered by risk.

> The Supabase DB is shared with production (see `lib/constants.ts`). Every schema or data
> migration (Phases 3-4) runs against a staging copy first, with a `pg_dump` backup.

## Target model (agreed)

| | **Gates** (was: checklist "milestones") | **Milestones** (Delivery) |
|---|---|---|
| Purpose | Fixed internal governance checkpoints, from the checklist template | PM-defined, client-facing delivery commitments |
| Audience | Internal | Shared with the client |
| Carries | Done / not done | Planned/Forecast/Actual dates, status, **payment %, invoice, client sign-off** |

Rule going forward: **each concept is stored in one place; every other screen only reads it.**

---

## Phase 0 — Safety net (½ day)

- [ ] Staging Supabase project; local `.env` points at it; prod data copied via `pg_dump`/`pg_restore`
- [ ] Backup before every data migration (Phases 3-4)
- [ ] One test user per role in staging; refresh the stale seed admin password in `.env`
- [ ] Add a role smoke crawler (`scripts/smoke-roles.mjs`): every route x every role, fail on 500 or horizontal overflow

## Phase 1 — Quick fixes, no schema change (1-2 days)

- [x] 1. Unauthorized pages return `notFound()` instead of throwing (Team, Activity, others); add `app/error.tsx` + `app/not-found.tsx`
- [x] 2. `updateProjectFinancials`: `contractValue` needs MILESTONES write only (PMs can save Contract Value again); story points/man-days stay BUDGET_TRACKER
- [x] 3. Delivery → Tasks: Title column min width (titles were collapsed to 1 character)
- [x] 4. Mobile overflow: Dashboard Overdue card, Sprints header, PM Plan section nav, Portfolio attention cards
- [x] 5. Checklist stats: "On Track" → "Completed"; Overdue uses `reminderBand()` (same as Dashboard); legend built from `ITEM_STATUSES`
- [x] 6. Resourcing: one threshold set in `lib/constants.ts` drives the legend, signals, and presets
- [x] 7. Resourcing Assign form: placeholder instead of a pre-selected person/role
- [x] 8. Portfolio: archived projects excluded from totals and health counts
- [x] 9. PM Plan: Risk owner from linked Person; "Dependency & Decision Management" → "Dependency Management"; section status reflects real completeness
- [x] 10. Stale text: Milestones help box, login hint, SQLite comment, Management-access comments (README/schema/layout)

Done when: smoke crawler shows zero 500s / zero overflow; a PM can save Contract Value.

**Status (2026-10-14): done on branch `fix/phase-1-audit`, uncommitted.** Verified: former 500s now 404, zero mobile/desktop overflow on re-crawled pages, typecheck + lint + 118 unit tests pass. Also fixed the same missing-mobile-column grid bug in 21 other places. Not click-tested: the PM Contract Value save (it would write to the shared DB) — verified by code path only.

## Phase 2 — One health and progress definition (2-3 days)

- [x] New `lib/project-health.ts`, used by Dashboard, Delivery Overview, Projects cards, Portfolio; delete local `deliveryHealth()`
- [x] Baseline = Σ WBS story points (computed) instead of `project.plannedStoryPoints` (0 on every project today → CPI 0.00 → false RED)
- [x] Cumulative Actual Cost in `budgetEntriesFromSprints`; no data → `null` → grey "No data", never 0.00 / RED
- [x] Health = schedule (sprint SPI) + open high risks + overdue milestones; currency CPI removed from Health
- [x] Delivery's competency CPI renamed "Effort Index"
- [x] Two named progress numbers everywhere: **Governance %** (checklist) and **Delivery %** (story points); remove the unweighted "Overall Delivery" average
- [x] Unit tests: zero baseline, cumulative AC, no-data health, same numbers on all four pages

Done when: one project shows identical health and percentages on every page.

**Status (2026-10-14): done on branch `fix/phase-1-audit`, uncommitted.** Verified in the browser: DED reads SPI 1.00 / Effort 1.29 and Omnizia SPI 0.45 / Effort 0.60 identically on Dashboard, Delivery, Projects, and Portfolio; health tiles state their reasons. Typecheck + lint clean; 133 unit tests pass (15 new). Integration tests not run (they write `[TEST]` rows to the shared DB).

Notes carried forward:
- Health's milestone input still reads the checklist-tagged payment milestones — Phase 3 re-points it to the Milestone model.
- Budget Tracker's dollar CPI (now 5.47 on DED) divides contract-value EV by internal cost, so it reads as a margin ratio, not classic EVM CPI. It no longer affects Health; revisit only if Budget Tracker becomes a real feature.
- `Project.plannedStoryPoints` column is now unused (kept to avoid a migration; drop in a later cleanup).

## Phase 3 — Milestone restructure (3-5 days)

- [ ] Expand: `MilestonePayment.checklistItemId` optional, `milestoneId` the anchor (plan already noted in `schema.prisma`)
- [ ] Dry-run report of copied milestones per project; **keep** any with real data (payment > 0, invoice/sign-off set, dates, non-default status), **delete** empty copies only after review; resolve the unlinked payment row
- [ ] Checklist tagging stops creating payment rows (`create-project.ts`, tag action); UI label "Milestone" → "Gate" (DB column unchanged)
- [ ] "Milestones & Payments" tab lists Delivery milestones with dates/status/payment/invoice/sign-off; "+ Add Milestone" creates a real Milestone; PM Plan Milestone section becomes read-only + link
- [ ] Optional: milestone shows required gates ("2/3 gates done") via existing `ChecklistItem.milestoneId`
- [ ] Re-point Dashboard (Next Milestone, Next Payment Due) and Portfolio (Upcoming Milestones) to the Milestone model; overdue shown separately from "next"
- [ ] Permissions: Client MILESTONES = READ_FULL (client list), DELIVERY stays NONE; PM Plan Milestone section gated on MILESTONES
- [ ] Contract (later release): drop `MilestonePayment.checklistItemId`

Done when: a Client sees only client milestones + sign-off; gates live only on the checklist; Dashboard, Portfolio, and `.docx` export read the same milestones.

## Phase 4 — Checklist cleanup (1-2 days)

- [ ] `isRecurring` on template + checklist items; mark standups, sprint review demo, weekly CPI/SPI, monthly retro, status meeting
- [ ] Recurring items excluded from `currentStage()` and completion %; shown in an "Ongoing cadence" block with last-done date
- [ ] PM Plan "PMO Health & Control Gates" becomes a read-only view of the checklist Gates stage (GateRow editor hidden, data kept)
- [ ] Content review with the team: de-duplicate Delivery & QA vs Development checklist templates

## Phase 5 — Docs and regression (1 day)

- [ ] Update `docs/USER_GUIDE.md` (checklists, milestones, budget, PM Plan, health formulas) and README module list
- [ ] Update in-page help boxes (PageGuide) to match
- [ ] Rerun smoke crawler + unit + integration tests on staging; release

---

## Decisions (defaults — change any before its phase starts)

1. Currency CPI removed from Health (Budget Tracker is testing-only) — **Yes**
2. Delete empty copied milestones after dry-run review, keep any with real data — **Yes**
3. PM Plan Gates section reads from the checklist Gates stage — **Yes**
4. Rename TPM display label "Admin" (read-only, confused with Super Admin) — **"TPM"**
5. Treat the current Supabase DB as production; migrations go to staging first — **Yes**

Estimated total: ~9-14 working days.
