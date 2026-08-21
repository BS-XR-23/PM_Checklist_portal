# PM Checklist Portal — User Guide

A knowledge-transfer reference for BS23's XR Project Management Portal. This
document explains **every feature**, **who can see and do what**, and **how
the numbers on screen are actually calculated** — written so a PM can use it
to onboard a new teammate without needing to read code.

---

## Table of Contents

1. [What this portal is for](#1-what-this-portal-is-for)
2. [Roles & Permissions](#2-roles--permissions)
3. [Getting started](#3-getting-started)
4. [Projects List](#4-projects-list)
5. [Inside a Project — Dashboard](#5-inside-a-project--dashboard)
6. [PM Checklist & DevOps Checklist](#6-pm-checklist--devops-checklist)
7. [Milestones & Payments](#7-milestones--payments)
8. [Risk & CR (Risk Register + Change Requests)](#8-risk--cr-risk-register--change-requests)
9. [Budget Tracker](#9-budget-tracker)
10. [PM Plan](#10-pm-plan)
11. [Decisions & Action Items](#11-decisions--action-items)
12. [Team & Resourcing](#12-team--resourcing)
13. [Escalations](#13-escalations)
14. [Activity Log](#14-activity-log)
15. [Presales Pipeline](#15-presales-pipeline)
16. [My Engagement](#16-my-engagement)
17. [Portfolio (Management aggregate view)](#17-portfolio-management-aggregate-view)
18. [Notifications / Reminders](#18-notifications--reminders)
19. [Admin Tools](#19-admin-tools)
20. [Login & Account](#20-login--account)
21. [Cheat sheet: how the numbers are calculated](#21-cheat-sheet-how-the-numbers-are-calculated)
22. [Quick answers to "why can't I see X?"](#22-quick-answers-to-why-cant-i-see-x)

---

## 1. What this portal is for

The portal is a **daily working tool for a Project Manager**, not a
reporting-only dashboard. It replaces the old spreadsheet-based PM Checklist
with a live, role-aware, multi-project system that:

- Tracks the standard delivery checklist (PM + DevOps) stage by stage, with
  owners, dates, and status per item.
- Rolls that data up automatically into financials (SPI/CPI, budget burn),
  milestones/payments, risk register, change requests, and a project health
  (RAG) status — so a PM doesn't maintain those separately.
- Tracks the **presales pipeline** (pitches before a project exists) and,
  when a deal is won, hands the pitch's decisions/action items/checklist
  straight into the newly created project.
- Surfaces what's overdue or due soon across every project a user can see,
  in one place (Notifications), instead of a PM having to remember to check
  each project.
- Keeps a full audit trail of every change, per project and portal-wide.

## 2. Roles & Permissions

Every user has exactly one global **Role**. Roles decide what a user can
reach at all; for `PM`/`CLIENT`/`LIMITED`, actual project access is then
governed by whether (and how) they're added to that specific project's
**Team** tab.

Role *names* shown throughout the portal (Super Admin, Admin, Management,
PM, Client, Guest) are display labels only — the underlying system role
(`ADMIN`, `TPM`, `PROGRAM_MANAGER`, `CLIENT`, `PM`, `LIMITED`, shown in
code font below) is unchanged, so this table always names both.

| Role (display name) | System role | Can open individual projects? | Write access | Notes |
|---|---|---|---|---|
| **Super Admin** | `ADMIN` | Every project | Full write on every module, every project | Only role that can create/archive/delete projects, edit Users/People, edit checklist templates, see the global Audit Log, and permanently delete anything. Also the only role that can see actual $ rate / competency multiplier figures on the People registry. |
| **Admin** | `TPM` | Every project (read) | Read-only on the 10 delivery modules; write only on **Escalations** and via the audited **Override** control on checklist items | Also has read-only access to the Users and People directories (rate figures hidden). Deliberately can't quietly edit a PM's real project data — every write is either on the Escalations tab or logged as an explicit override. |
| **Management** | `PROGRAM_MANAGER` | Every project (read) | None — read-only everywhere it can reach | Read-only drill-down into every project's delivery modules **except** Decision Log and Action Items (off limits, same as Escalations/Activity/Budget Tracker). Read-only on the People directory (rate figures hidden) but **no access to Users at all**. Also confined to the aggregate **Portfolio** page and a read-only view of **Presales**; excluded from My Engagement and Notifications. |
| **PM** | `PM` | Only projects they're a member of | Full write on all modules of their own projects (except Budget Tracker — Super Admin-only for every role) | The working role for most day-to-day use. Also has write access to Presales opportunities, and read-only access to the Users and People directories (rate figures hidden). |
| **Client** | `CLIENT` | Only projects they're added to | Per-module, set by whoever manages that project's Team tab | Starts locked-down by default (see below) — a Super Admin opens up specific modules as needed, or applies a preset. |
| **Guest** | `LIMITED` | Only projects they're added to | Per-module, set by whoever manages that project's Team tab | Starts at **READ_LIMITED on every module** (Budget Tracker excluded — Super Admin-only for every role) — a broader baseline than Client, narrowed or widened per project as needed. |

**Per-module access levels** (used for Client/Guest members): `NONE` →
`READ_LIMITED` → `READ_FULL` → `WRITE`. `READ_LIMITED` hides financial
fields and Notes on most pages — a member at this level sees status and
dates, not cost or internal commentary. A Team tab **preset** dropdown
(Standard Client, Full Visibility Read-Only, No Access) can set a whole
member's grid in one click, still freely editable per-module afterward.

**Default access for a newly-added Client**: Dashboard and both Checklists
at `READ_LIMITED`, Milestones at `READ_FULL`, everything else (Risk & CR,
Budget, PM Plan, Decisions, Action Items) at `NONE`. **Default access for a
newly-added Guest**: `READ_LIMITED` on every module except Budget Tracker
(`NONE`). Either can be adjusted per member on the project's Team tab.

**"BA" isn't a separate system role.** Business Analysts who run presales
opportunities are simply given the `PM` role — that role already has
exactly the write access presales work needs (create/edit/archive/delete
opportunities), so no dedicated role was added.

## 3. Getting started

- **No self-service signup.** Accounts are created by a Super Admin (Admin
  → Users). If you don't have a login, ask your Super Admin.
- **Log in** with your email and password at the login page.
- **Sidebar** — your persistent navigation on the left. It only shows the
  sections your role can actually reach (e.g. a Guest (`LIMITED`) user with
  no memberships mostly just sees "My Engagement").
- **Change your password** any time via the account menu in the sidebar
  (requires your current password, new password minimum 8 characters).
- **Notifications bell** — shows a live count of overdue/due-soon items
  relevant to you (see [§18](#18-notifications--reminders)).

## 4. Projects List

The landing page for Super Admin, Admin, Management, and PM — Management
(`PROGRAM_MANAGER`) now sees this list too (read-only, same as Admin),
having gained project drill-down.

**Top stats**: Active Projects count, Average Completion % (active projects
only), Total Contract Value (active projects only) — archived projects are
deliberately excluded so they don't dilute "what's currently in flight."

**Filter pills**: Active / Archived / All / Deleted (Deleted is Super Admin-only),
plus a **Stage** dropdown to jump straight to "everything currently in
Kickoff," etc.

**Each project card shows**:
- Name, client, a colored avatar
- A red **"⚠ N overdue"** badge — count of this project's overdue
  checklist/action items (same feed as Notifications)
- A **RAG badge** (Red/Amber/Green — see [§21](#21-cheat-sheet-how-the-numbers-are-calculated)) with the completion %
- A progress bar and stat chips: items completed/total, contract value,
  start date, end date (latest forecast date across the checklist), and
  current PM stage

**Super Admin-only actions on a card**: Archive/Unarchive, Delete (soft —
moves it to the Deleted tab), and from the Deleted tab: Restore or
**Permanent Delete** (only reachable after it's already soft-deleted — you
can't skip straight to a permanent delete).

**Create Project** (Super Admin only): name, client, contract value, planned
man-days. This seeds the full standard PM Checklist (51 items), DevOps
Checklist (18 items), milestone rows for any milestone-tagged items, and a
PM Plan pre-filled with default stakeholders/comms/RACI rows. This is the
same creation path used automatically when a presales opportunity is Won.

## 5. Inside a Project — Dashboard

The first tab of every project, and the only one visible at `READ_LIMITED`
(in which case everything financial/risk-related below is hidden, leaving
just the completion hero, current stage, end date, and recent decisions).

- **Overall % Complete** — computed across PM + DevOps checklist items
  combined, with `Not Applicable` items excluded from both the numerator
  and denominator (they neither count as done nor as "still to do").
- **Current Stage** — the first stage that still has an incomplete item;
  shows "Complete" once none remain.
- **End Date** — not a stored field; it's the latest Forecast Date across
  every applicable checklist item.
- **Overdue & Due Soon panel** — this project's slice of the Notifications
  feed (checklist + action items only; hidden below `READ_FULL`).
- **Recent Decisions** — last 5 Decision Log entries.
- **Financial stat tiles** (hidden below `READ_FULL`): Latest SPI, Latest
  CPI (green ≥1.0 / red <1.0), Open High Risks count, Active CR Value in
  man-days, Next Payment Due date + amount.
- **Contract value tiles**: Total Contract Value, Paid to Date, Invoiced
  (Awaiting Payment).
- **Charts**: Status Breakdown (pie), % Complete by Checklist (PM vs
  DevOps), Budget Burn (PV/EV/AC line chart, financials-visible only).
- **Stage/Category Breakdown** — per-stage progress bars, PM and DevOps
  shown separately.
- **Timeline strip** — planned→forecast date range per stage.
- **Key Milestones table** — every milestone-tagged checklist item with its
  forecast date and status.

## 6. PM Checklist & DevOps Checklist

The backbone of the portal — the digitized version of BS23's standard
delivery checklist.

- **PM Checklist**: 51 fixed items across 7 stages, in order —
  *Pre-Sales & Initiation, Planning, Kickoff, Creative Huddle, Development,
  Release, Closing & Maintenance*. (An 8th stage, **Presales**, only
  appears on projects that were won from a presales opportunity — see
  [§15](#15-presales-pipeline).)
- **DevOps Checklist**: 18 fixed items across 5 categories — *Infrastructure,
  CI/CD, Security, Reliability, Release & Ops*.

**Each item has**:
- **Item text** — editable only if it's a custom item you added; the
  wording of a fixed template item can only be changed by a Super Admin
  (from the Checklist Template, affecting future projects — not retroactively).
- **Status**: `Not Started`, `In Progress`, `Completed`, `At Risk`,
  `Delayed`, `Blocked`, `Not Applicable`. Color-coded pills. `Not
  Applicable` lets you exclude an out-of-scope step (e.g. a 3D-only step on
  a 2D project) from the completion % without deleting a fixed item.
- **Owner** — picked from the People registry (or legacy free text if not
  linked to a person).
- **Planned Date** and **Forecast Date**. If the Forecast slips past the
  Planned date on an incomplete item, a red **⚠ slipped** icon appears —
  that's a "the estimate moved" signal, separate from overdue/due-soon.
- **Notes** — hidden at `READ_LIMITED`.
- A **Milestone badge** if the item carries a payment tranche, and a
  **Custom** badge if you added it.

**Stage tabs** across the top show a live `completed/applicable` count per
stage, turning green once every applicable item in that stage is
Completed. The page opens on the **first incomplete stage** by default, so
you land on current work rather than always Stage 1.

**Actions**: anyone with `WRITE` can inline-edit status/owner/dates/notes.
**"+ Add Item"** adds a project-specific custom item to a stage (only
custom items can be deleted — fixed items can only be marked `Not
Applicable`). An **Admin** (`TPM`) with read access sees an **Override**
button instead — a modal requiring a typed reason, logged distinctly in
Activity as a "TPM Override," never blended in as if the PM made the edit.

## 7. Milestones & Payments

Milestones aren't created separately — any checklist item (PM or DevOps)
tagged with a milestone name automatically becomes a payment row here.
**"+ Add Milestone"** creates a new custom checklist item and its payment
tranche in one step (pick checklist, stage, and name).

**Per milestone**: name, source checklist/stage (read-only — edit status
and forecast date on the checklist itself), **Payment %**, **Tranche
Amount** (= Total Contract Value × Payment %, auto-computed), **Invoice
Status** (`Not Invoiced` / `Invoiced` / `Paid`), **Client Signoff**
(`Pending` / `Signed` / `Acknowledged` / `N/A`), Notes (hidden at
`READ_LIMITED`).

**Payment Summary panel**: Total % Allocated (flagged red if it doesn't sum
to 100%), Paid Amount, Invoiced (Awaiting Payment), Not Yet Invoiced.

## 8. Risk & CR (Risk Register + Change Requests)

Two tabs under one sub-nav, because the CR rate policy is set in the PM
Checklist's Planning stage and both pages remind you to keep them
consistent.

### Risk & Issue Register
Type (`Risk` / `Opportunity` / `Issue`), Category, Description,
**Probability** & **Impact** (`Low`/`Medium`/`High` each), Owner,
Mitigation Plan, **Status** (`Open, Monitoring, Mitigated, Closed,
Realized, Not Pursued`), Date Raised/Closed, Notes.

**Risk Score** = Probability × Impact (Low=1, Med=2, High=3 → range 1–9),
shown as a colored badge: **1–2 Low** (green), **3–4 Medium** (amber),
**6–9 High** (red). The "Open High Risks" number used on the Dashboard and
Portfolio counts risks (not Issues/Opportunities) with status not
Closed/Mitigated and score ≥ 6.

### Change Request (CR) Log
CR Code (auto), Title, Date Raised, Description, Man-Days Planned, Billable
Man-Days, Rate (hidden at `READ_LIMITED`), Type (`Paid, Free, Exchange`),
Client Signoff, WBS Updated, **Status** (`Proposed, Approved, In Progress,
Completed, Rejected`), Notes. **Amount** = Billable Man-Days × Rate
(hidden at `READ_LIMITED`).

**KPI tiles**: Upcoming CR # (sum of planned man-days across `Proposed`),
Work Order CR # (sum of billable man-days across `Approved`+`In Progress`),
Remaining CR # (sum of billable man-days across `In Progress` only).

## 9. Budget Tracker

Formulas shown on-page: `EV = %Actual Complete × Contract Value`,
`PV = %Planned Complete × Contract Value`, `SPI = EV/PV`, `CPI = EV/AC`
(≥1.0 favorable, <1.0 unfavorable).

**Top inputs** (WRITE only): Total Contract Value, Total Planned Man-Days
→ auto-computed Man-Day Rate = Contract Value ÷ Planned Man-Days.

**Weekly Entries** — one row per week: % Planned Complete and % Actual
Complete (cumulative inputs), PV/EV computed, Actual Cost (input, hidden at
`READ_LIMITED`), CV = EV − AC, SPI, CPI (both hidden at `READ_LIMITED`,
colored green/red by ≥1.0), Notes. Rows are addable/deletable by WRITE
users.

**Charts** (hidden at `READ_LIMITED`): Budget Burn (PV/EV/AC), SPI/CPI
Trend.

## 10. PM Plan

One record per project, structured to match BS23's `PMP_Template.docx`
exactly, in 8 independently-editable sections:

1. **Project Details** — Prepared By, Date, Version
2. **Rationale** — why the project, ROI, alignment
3. **Stakeholders & Access** — table, pre-filled with 6 default rows
   (Sponsor, Client/Product Owner, PM, Dev Team, QA Team, Ops/DevOps)
4. **Charter** — Objective, Scope In/Out, Success Criteria, Timeline,
   Budget, Assumptions & Constraints, PM Authority
5. **Methodology** — Approach, Cadence, Ceremonies, Tools, Roles, Change
   Management
6. **Test Plan** — Levels, Environments, Entry/Exit Criteria, Defect
   Management, UAT Process, Deliverables
7. **Deployment Plan** — Environments, Release Strategy, Steps, Rollback,
   Go-Live Checklist, Post-Deployment Monitoring
8. **Communications Plan** — table, pre-filled with 4 default rows, plus
   Escalation Path
9. **RACI Matrix** — 17 default activity rows × 5 role columns (PM, TL, BA,
   Lead Eng, Creative Lead)

**Export .docx** regenerates the plan back into the original Word template
format — useful for sharing outside the portal.

## 11. Decisions & Action Items

### Decision Log
Date, Decision, Rationale, Decided By, Notes. **Append-only** — no status
field, since it's a permanent record of "what we decided and why," not a
task to close out. Distinct from Change Requests (scope changes with a
cost/date impact) and the Checklist (the fixed, stage-gated backbone).

### Action Items
Description, Owner, Due Date, **Status** (`Open` / `Done`, one-click
toggle), Notes. Positioned as "small follow-ups with an owner and a due
date — too lightweight for the Checklist, still too easy to forget."
Feeds the Notifications/Reminders system exactly like checklist items.

## 12. Team & Resourcing

Two tabs.

### Access
Who can log into this specific project, and what Client/Guest members
can see. Visible to Super Admin/Admin/Management/PM; **only Super Admin can
edit**. You assign `PM`, `CLIENT`, or `LIMITED` (Super Admin/Admin/
Management never need a row here — their global role already governs their
access). The person being added must already exist as a User (create them
under Admin → Users first). PM members get full read/write on everything
automatically; Client/Guest members get a per-module dropdown grid
(NONE/READ_LIMITED/READ_FULL/WRITE) — an **Apply preset…** dropdown
(Standard Client, Full Visibility Read-Only, No Access) sets the whole grid
in one click, still editable per-module afterward.

### Engagement (Resourcing)
A lightweight staffing record — who's working on this project, in what
capacity. Visible to Super Admin/Admin/Management/PM; editable by Super
Admin anywhere, or by the project's own PM for that project (Management
sees it read-only, same as the Access tab). Fields: Person, Role on Project
(free text), **Intensity %** (presets Low=25/Med=50/High=90, or any custom
value), Start/End Date, Notes. New people are created only under Admin →
People — this tab just assigns existing ones.

**Overload & conflict badges** (also drive the Portfolio panel):
- 🔴 **Overloaded** — a person's summed intensity across all their
  currently-active engagements (across *every* project, not just this one)
  exceeds 100%.
- 🟠 **Overlap conflict** — two or more of a person's engagements are each
  individually ≥60% intensity *and* their date ranges overlap, even if the
  combined total doesn't cross 100%. This catches "the same senior person
  needed hard by two projects in the same sprint" even when neither
  engagement alone looks unusual. Pairs within the same project don't
  count as a conflict.

## 13. Escalations

Visible **and writable only by Super Admin and Admin (`TPM`)** — everyone
else is redirected to the Dashboard, including Management (`PROGRAM_MANAGER`)
despite its new project drill-down elsewhere. This is deliberately Admin's
own write surface, separate from the delivery data itself: an Admin
raises/tracks a concern here rather than editing the PM's
checklist/risk/budget data directly (that's what the audited Override
control on checklist items is for). Fields:
Type, Title, Notes, **Status** (`Open, Acknowledged, Resolved`), Raised By
(auto-set).

## 14. Activity Log

Per-project change history, visible to Super Admin/Admin/PM (Management
still excluded, same as Escalations). Shows the last 200 actions: When,
Actor (name + role), Action type (`create, update, delete, override,
role_change`), Summary. Admin (`TPM`) overrides get a distinct amber "TPM
Override" tag so they're never mistaken for a normal PM edit. Every write
anywhere in the app is captured here (and in the portal-wide Audit Log —
see [§19](#19-admin-tools)), including a before/after diff stored
internally.

## 15. Presales Pipeline

A separate tracker for **deals that haven't become projects yet**. Visible
to Super Admin, PM, Admin (`TPM`), Management (`PROGRAM_MANAGER`) — never
Client/Guest; only Super Admin and PM can create/edit/delete — Admin and
Management see it read-only.

### List (`Presales`)
Stats: Open Opportunities count, Open Pipeline Value, Win Rate
(`Won / (Won + Lost)`). Filter pills: Open / Won / Lost / All / Deleted
(Deleted = Super Admin only). Each card shows name, client, estimated value,
expected close date, an outcome badge, and — for still-Open opportunities
— an ⚠ overdue/due-soon badge if the expected close date has passed or is
within 7 days.

### Detail page
- **Overview** — editable Name, Client, Description, Estimated Value,
  Expected Close Date.
- **Presales Checklist** — a flat (no stages — presales is a short,
  single-phase process) checklist auto-seeded from a Super Admin-managed
  template when the opportunity is created. Same status set as the real
  Checklist, editable the same way.
- **Decision Log** and **Action Items** — same shape as the project-level
  versions.
- **Outcome actions**:
  - **Mark as Won** — confirms, then runs the Win flow (below).
  - **Mark as Lost** — prompts for a "why was this lost?" reason.
  - **Reopen** (if Lost) — resets to Open and clears the reason.
  - Once Won, the card just links to the resulting project instead.

### What happens when you mark an opportunity Won
1. A brand-new real **Project** is created (name/client/contract value
   from the opportunity) — same seeding as manually creating a project:
   full PM + DevOps checklist, milestone rows, default PM Plan.
2. All presales **Decisions** and **Action Items** are copied into the new
   project's Decision Log and Action Items, so nothing discussed during
   the pitch is lost.
3. The presales **Checklist items** are copied into the new project's PM
   Checklist as their own **"Presales" stage** (shown first, before
   Pre-Sales & Initiation) — with their existing status/dates/owner/notes
   intact, and **counted toward the project's overall % complete**.
4. The opportunity is marked `WON` and linked to the new project. Opening
   the new project's Dashboard/Checklist shows a small "↳ Won from
   presales opportunity" link back to the original pitch record.

### Delete / Restore
- **Delete** (PM/Super Admin) — soft delete, moves to the Deleted tab.
- **Restore** (PM/Super Admin) — brings it back.
- **Permanent Delete** (Super Admin only) — irreversible, only reachable
  from the Deleted tab.

## 16. My Engagement

A personal-only page: your own project assignments, role, and current
allocation — nothing about anyone else. It's resolved through your linked
**Person** record, so even a Guest (`LIMITED`) user with no project
memberships at all can still see this (as long as a Super Admin has linked
their account to a Person under Admin → People). Shows total current
allocation % and a table of every engagement (Project, Role, Intensity %,
dates). If your account isn't linked to a Person yet, the page tells you
to ask a Super Admin. **Management (`PROGRAM_MANAGER`) is excluded** — redirected
to the Projects list instead, even if linked to a Person.

## 17. Portfolio (Management aggregate view)

Visible only to Super Admin, Admin, Management. A deliberate dead end — no
links into any project's detail pages from *here*, so this view stays
aggregate-only even though Management can now open individual projects
directly from the Projects list (§4).

- **Stats**: Total Projects, Total Contract Value, Exceptions (Red count).
- **Exceptions panel** — every RED project with the reason (open high
  risks and/or SPI/CPI below 0.9).
- **Overload & Conflicts panel** — Super Admin/Admin only (not Management):
  every person over 100% allocation and every cross-project overlap
  conflict, computed across the whole People registry.
- **Project table** — RAG, Project, Client, Contract Value, Latest SPI,
  Latest CPI, Open High Risks, one row per non-deleted project.

## 18. Notifications / Reminders

One page collecting everything overdue or due within 7 days, from exactly
four sources:

1. **Checklist items** — not Completed/N/A, with a Planned Date, on active
   projects you can see.
2. **Action items** — not Done, with a Due Date, same scoping.
3. **Presales opportunities** — still Open, with an Expected Close Date.
4. **Presales action items** — not Done, with a Due Date, only while the
   opportunity is still Open (once Won they're already living in the real
   project's Action Items; once Lost there's nothing left to chase).

Sorted Overdue first, then soonest due date. Only `ADMIN`, `TPM`, `PM` get
reminders at all — a PM sees only their own projects' items; Admin/TPM see
everything active. Program Manager (aggregate-only) and Client/Limited
(not meant to be chasing internal deadlines) never see this page.

## 19. Admin Tools

Users and People are no longer Super Admin-only — the other two sections
below still require `ADMIN` (Super Admin).

### Users (`Admin → Users`)
**Super Admin edits**; Admin (`TPM`) and PM see the same directory
**read-only** (Management/`PROGRAM_MANAGER` has no access here at all).
Every account: Name/Email (inline editable, Super Admin only), **Role**
(dropdown, Super Admin only — you can't change your own role or deactivate
your own account), Reset Password (Super Admin only — generates a new temp
password shown once), Active/Inactive toggle (view-only for non-Super
Admin). A deactivated account is blocked **immediately**, not just on next
login — every request re-checks the user's status fresh from the database.
Assigning someone to a specific project happens on that project's Team
tab, not here.

### People (`Admin → People`)
The canonical registry that Owner fields, "Decided By," and PM Plan
stakeholder rows all pick from, instead of free-typed names. **Super Admin
edits**; Admin (`TPM`), Management (`PROGRAM_MANAGER`), and PM see it
**read-only**, with the Avg. Rate stat tile and the actual $ / multiplier
figures in the Role Rates and Competencies panels hidden — only Super Admin
sees those numbers. Fields: Name, Title, Email, Phone, and an optional link
to a portal User account (so that person can see their own My Engagement
page). Shows each person's current active engagements as intensity badges.
New people and account links are created only here; assigning a person to
a project's roster happens on that project's Resourcing tab.

### Checklist Template (`Admin → Checklist Template`)
Super Admin only. The master template new projects/opportunities are
seeded from — **editing here only affects future projects**, not ones
that already exist. Three sections:
1. **PM Checklist template** — grouped by stage (excluding "Presales,"
   which only ever comes from a Win, never from this seedable template).
   Add/edit/delete/reorder items within a stage.
2. **DevOps Checklist template** — same, grouped by category.
3. **Presales Checklist template** — flat list used to seed every new
   presales opportunity's checklist.

### Global Audit Log (`Admin → Audit Log`)
Super Admin only. Every write across every project plus user/role and
project-creation events, paginated. Filterable by Project, Actor, and
Action type. A permanently-deleted project's history stays visible but can
no longer be filtered by name (the row is gone).

## 20. Login & Account

- Email + password login (no SSO). No self-service signup — a Super Admin
  creates accounts (one at a time, or bulk-imported from a CSV/XLSX —
  both Super Admin only; Admin and PM can view the directory but not add
  to it).
- Deactivated accounts get the same generic "Incorrect email or password"
  message as a wrong password — no hint given about why.
- Change your own password any time from the sidebar (needs your current
  password; new password minimum 8 characters).
- Role changes and deactivation take effect on your **very next request**,
  not your next login.

## 21. Cheat sheet: how the numbers are calculated

| Metric | Formula / rule |
|---|---|
| **Overall % Complete** | Completed items ÷ (all items − Not Applicable), across PM + DevOps checklists |
| **Current Stage** | First stage (in fixed order) with any item not Completed/N/A; "Complete" if none |
| **End Date** | Latest Forecast Date across all applicable checklist items |
| **Slipped ⚠** | Forecast Date has moved past Planned Date on an incomplete item |
| **Overdue** | Item not done, and its Planned/Due/Expected date is already in the past |
| **Due Soon** | Item not done, and its date falls within the next 7 days |
| **Risk Score** | Probability × Impact (Low=1, Medium=2, High=3) → 1–9. 1–2 Low, 3–4 Medium, 6–9 High |
| **Open High Risks** | Type = Risk, status not Closed/Mitigated, score ≥ 6 |
| **CR Amount** | Billable Man-Days × Rate |
| **PV (Planned Value)** | % Planned Complete × Contract Value |
| **EV (Earned Value)** | % Actual Complete × Contract Value |
| **CV (Cost Variance)** | EV − Actual Cost |
| **SPI** | EV ÷ PV — ≥1.0 favorable, <1.0 unfavorable |
| **CPI** | EV ÷ Actual Cost — ≥1.0 favorable, <1.0 unfavorable |
| **Man-Day Rate** | Contract Value ÷ Total Planned Man-Days |
| **Tranche Amount** | Total Contract Value × Payment % |
| **RAG status** | RED if any open high risk exists or worse of SPI/CPI < 0.9; AMBER if worse of SPI/CPI is 0.9–0.99; GREEN otherwise |
| **Overloaded (person)** | Sum of intensity % across all currently-active engagements, any project, > 100% |
| **Overlap conflict (person)** | Two+ engagements each ≥60% intensity, with overlapping date ranges (same-project pairs excluded) |

## 22. Quick answers to "why can't I see X?"

- **"I don't see Risk/Budget/CR on this project."** You're probably a
  Client at the default access level — those modules default to `NONE`.
  Ask a Super Admin to raise your access (or apply a broader preset) on the
  project's Team tab.
- **"I can't edit anything, only view it."** Check your role and access
  level (§2). Admin (`TPM`) and Management (`PROGRAM_MANAGER`) are
  intentionally read-only outside their own dedicated write surfaces
  (Escalations/Override for Admin, nothing for Management); Client/Guest
  depend entirely on what's been granted on the project's Team tab.
- **"I can't open this project at all."** As PM/Client/Guest you need an
  explicit membership row on that project's Team tab. Management
  (`PROGRAM_MANAGER`) and Admin (`TPM`) always get in, read-only, no
  membership row needed.
- **"I don't get any Notifications."** Only `ADMIN`/`TPM`/`PM` receive
  reminders. Also check the item actually has a date set — items with no
  Planned/Due date never generate a reminder.
- **"A checklist item is stuck as 'Presales'."** That stage only appears
  on a project won from a presales opportunity, and only for items copied
  over from the pitch — it's expected, not a bug.
- **"I can't permanently delete something."** Only Admins can, and only
  after it's already been soft-deleted (moved to the Deleted tab) first.
