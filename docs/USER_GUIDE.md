# PM Checklist Portal — User Guide

A knowledge-transfer reference for BS23's XR Project Management Portal. It
explains **every feature**, **who can see and do what**, and **how the
numbers on screen are calculated** — written so a PM can onboard a new
teammate without reading code.

_Last updated: 2026-10-14 (after the audit fixes in [FIX_PLAN.md](FIX_PLAN.md))._

---

## Table of Contents

1. [What this portal is for](#1-what-this-portal-is-for)
2. [Three concepts to get right](#2-three-concepts-to-get-right)
3. [Roles & Permissions](#3-roles--permissions)
4. [Getting started](#4-getting-started)
5. [Projects list](#5-projects-list)
6. [Inside a project — Dashboard](#6-inside-a-project--dashboard)
7. [Checklists](#7-checklists)
8. [Milestones & Payments](#8-milestones--payments)
9. [Risk & CR](#9-risk--cr)
10. [Dependencies](#10-dependencies)
11. [Delivery (Tasks, Sprints, Dev Checklist, Releases, UAT)](#11-delivery)
12. [Budget Tracker](#12-budget-tracker)
13. [PM Plan](#13-pm-plan)
14. [Decisions & Action Items](#14-decisions--action-items)
15. [Team & Resourcing](#15-team--resourcing)
16. [Escalations](#16-escalations)
17. [Activity Log](#17-activity-log)
18. [Presales pipeline](#18-presales-pipeline)
19. [My Engagement](#19-my-engagement)
20. [Portfolio](#20-portfolio)
21. [Reminders](#21-reminders)
22. [Admin tools](#22-admin-tools)
23. [Login & account](#23-login--account)
24. [Cheat sheet: how the numbers are calculated](#24-cheat-sheet-how-the-numbers-are-calculated)
25. [Quick answers to "why can't I see X?"](#25-quick-answers-to-why-cant-i-see-x)

---

## 1. What this portal is for

A **daily working tool for a Project Manager** on fixed-budget XR projects —
it replaced the old `PM_Checklist_Tracker.xlsx` and generates the BS23
`PMP_Template.docx` Project Management Plan. It is **not** a task tracker for
the whole team: day-to-day engineering tasks stay in Jira; the portal holds
the governance, delivery, and commercial picture.

- **Checklists** — the standard stage-by-stage governance process (PM,
  Delivery & QA, DevOps, Creative & XR, plus a Development checklist inside
  Delivery).
- **Milestones & Payments** — what the project delivers to the client, when,
  and how it gets paid.
- **Delivery** — WBS tasks, sprints, releases, and UAT, with schedule
  tracking (SPI).
- **PM Plan** — the formal plan, exported back to Word.
- **Risks, CRs, Dependencies, Decisions, Action Items** — the PM's registers.
- **Presales** — deals before they become projects; a won deal becomes a
  project automatically.
- **Portfolio** — one health picture across every project for management.
- A full **audit trail** of every change.

## 2. Three concepts to get right

These are the ideas people most often mix up. Each has exactly one home.

| Concept | What it is | Example | Where it lives |
|---|---|---|---|
| **Milestone** | A client-facing delivery commitment. Carries dates, status, owner, **payment %, invoice status, client sign-off**. | "Phase 1 MVP delivered" | **Milestones & Payments** tab (everything else only reads it) |
| **Checkpoint** | An internal step tagged on a checklist item. Never carries payment. | "DoR Approved", "CI Pipeline Green" | **Checklist** tab ("Checkpoint" column) |
| **Gate (G0–G6)** | The PMO stage-gate framework — formal sign-off evidence per phase. | "G4 UAT Ready" | **PM Plan** → PMO Health & Control Gates |

And two progress numbers, always shown side by side:

| Number | Meaning | Calculated from |
|---|---|---|
| **Governance %** | How much of the process has been followed | Checklist items completed ÷ tracked items |
| **Delivery %** | How much of the actual product work is done | Story points done ÷ total WBS story points |

## 3. Roles & Permissions

Every user has one global **Role**. The portal shows display names; the
system role (in code font) is what the code checks.

| Display name | System role | Opens projects | Can write | Notes |
|---|---|---|---|---|
| **Super Admin** | `ADMIN` | Every project | Everything | Only role that creates/archives/deletes projects, edits Users/People/Checklist Template, sees the global Audit Log and Budget Tracker, reopens closed sprints, and sees rate/competency figures. |
| **Admin** | `TPM` | Every project (read) | Escalations, the audited **Override** on checklist items, and sprint names | Read-only on Users/People (rates hidden). Can't quietly edit a PM's data — every write is an Escalation or a logged override. |
| **Management** | `PROGRAM_MANAGER` | Every project (read) | Nothing | Read-only drill-down into every project except Decisions, Action Items, Escalations, Activity, Budget Tracker. Sees Portfolio and Presales (read-only) and People (read-only). No Users, Reminders, or My Engagement. |
| **PM** | `PM` | Projects they're a member of | Everything on their projects (except Budget Tracker) | Can also create/edit Presales opportunities. Read-only Users/People. |
| **Client** | `CLIENT` | Projects they're added to | Per module, as configured | Starts locked down (see below). |
| **Guest** | `LIMITED` | Projects they're added to | Per module, as configured | Starts at read-limited on every module except Budget Tracker. |

**Per-module access** (Client/Guest only), set on a project's Team tab:
`NONE` → `READ_LIMITED` → `READ_FULL` → `WRITE`. `READ_LIMITED` hides
financial fields and Notes. Presets: **Standard Client**, **Full Visibility
(Read-Only)**, **No Access**.

**Default for a new Client:** Dashboard and checklists read-limited,
**Milestones read-full** (so the client sees their milestones and sign-off),
Releases/UAT/Dev Checklist read-limited; Risk, CR, Budget, PM Plan,
Decisions, Action Items, Delivery, Dependencies hidden.

"BA" isn't a separate role — Business Analysts running presales use `PM`.

## 4. Getting started

- **No self-signup.** A Super Admin creates accounts (Admin → Users), one at
  a time or bulk-imported from CSV/XLSX.
- **Sidebar** shows only what your role can reach.
- **Change password** from the sidebar (needs your current password; new
  password at least 8 characters).
- **Reminders** badge — your count of overdue/due-soon items (§21).

## 5. Projects list

Landing page for Super Admin, Admin, Management, and PM (PMs see only their
own projects).

Opens on **Active** projects, sorted **worst health first** (Critical → At
Risk → No data yet → Healthy), so what needs you is at the top. Archived
projects always sort below live ones.

**Top stats (active projects only):** **Active projects** with a health
split bar · **Needs attention** (Critical + At Risk, plus overdue items;
click it to filter) · **Contract value in flight** with paid to date ·
**Avg. Delivery** (mean Delivery % across projects with WBS story points).

**Filters:** Active / Needs attention / Completed (every tracked checklist
item done) / Archived / All / Deleted (Super Admin only), a search box
(project, client, or PM), a **Filters** panel (PM, client, stage, health),
and **Sort** (health, name, delivery %, next milestone, contract value).
**Cards** or **Table** view; your choice is remembered in this browser. In
the table, click a column header to sort, click again to reverse.

**Each card:** a coloured left edge for health, name, client, PM, a
**health label** with its reasons (e.g. "3 open high risks · SPI 0.50"),
the current **stage**, a red **"⚠ N overdue"** badge (overdue checklist +
action items), **Governance** and **Delivery** bars, **SPI**, the **next
milestone** (red when overdue), and contract value with % paid.
Client and Guest viewers see health, stage and progress only — no health
reasons, money, or milestones.

**Super Admin actions** (card "…" menu): Archive/Unarchive, Delete (soft —
goes to the Deleted tab), Restore, and Permanent Delete (only from the
Deleted tab).

**New Project** (Super Admin) opens a dialog: name, client, contract value,
and optionally the **PM** (must be an active user with the PM role; others
are added on the Team tab). Seeds every checklist from the Checklist
Template (the dialog shows the live item counts) and a PM Plan with default
stakeholder/comms/RACI rows. **No milestones are created** — the PM adds
the real client milestones on Milestones & Payments. Planned man-days (only
used by the testing Budget Tracker) is set on the Budget Tracker page.
Winning a presales opportunity uses the same creation path.

## 6. Inside a project — Dashboard

The first tab. A read-limited viewer (Client default) sees the progress
hero and the "where are we" row only.

- **Governance gauge** — Governance % with per-checklist breakdown and item
  counts (total, completed, in progress, not started, overdue, at risk).
- **Health** — Red / Amber / Green with the **reasons** listed under it
  (e.g. "3 open high risks · 1 overdue milestone"). Reasons are only shown
  to viewers who can see the financial/risk tiles. See §24 for the rule.
- **Delivery** — Delivery % (story points).
- **Planned End** — the latest milestone date.
- **Next Milestone** — the next milestone due **today or later**; overdue
  milestones are counted separately underneath ("1 overdue"), never shown
  as "next".
- **Overdue & Due Soon** — this project's checklist and action items past
  or within 7 days of their date (recurring items excluded).
- **Recent Decisions** — last 5 Decision Log entries.
- **Financial tiles** (read-full and above): **SPI**, **Effort Index**, Open
  High Risks, Active CR Value (man-days), **Next Payment Due** (the
  earliest-due milestone with an un-invoiced tranche above 0%), Total
  Contract Value, Paid to Date, Invoiced (awaiting payment).
- **Detailed Reporting** (expand): status breakdown, completion by
  checklist, budget burn chart, per-stage breakdown and timeline, project
  Gantt (from PM Plan Timeline), and the **Key Milestones** table.

## 7. Checklists

The governance backbone. Five checklist types, each seeded from the
Checklist Template when a project is created:

| Checklist | Stages / categories | Where |
|---|---|---|
| **PM** | (Presales) · Governance · Planning · Approvals · Baselines · Closure | Checklist tab |
| **Delivery & QA** | Architecture · Development · Code Review · Performance · Technical QA · Test Planning · Functional Testing · Device Testing · Regression · UAT | Checklist tab |
| **DevOps** | Infrastructure · CI/CD · Security · Monitoring | Checklist tab |
| **Creative & XR** | Storyboard · 3D · UX · Assets · XR Validation | Checklist tab |
| **Development** | Development Readiness · Development Execution · Quality Gate · Development Completion | Delivery → Dev Checklist |

The **Presales** stage only exists on projects won from a presales
opportunity (its items are copied from the deal).

**Each item:** text, **Checkpoint** label (if tagged), owner (from the People
registry), planned date, actual date, link, notes (hidden at read-limited),
status: Not Started · In Progress · Completed · At Risk · Delayed · Blocked ·
Not Applicable. A ⚠ **slipped** flag appears when the actual date passed the
planned date on an incomplete item.

- **Not Applicable** removes an item from Governance % entirely.
- **Checkpoint** — an internal checkpoint tag (e.g. "DoR Approved"). It never
  carries payment; see §2.
- **Ongoing cadence** — recurring activities (weekly CPI/SPI report, monthly
  retro, status meetings, sprint demo, daily standups) sit in their own
  block above the stages with **Owner** and **Last done**. Update Last done
  each time it happens. They never count toward Governance %, current stage,
  or reminders. Any item can be moved in or out of the block from its row
  menu (•••).
- **Stage pills** show completed/tracked per stage and turn green when
  done. The page opens on the **current stage** — the first stage with
  unfinished tracked items.
- **+ Add Item** adds a custom item to a stage; only custom items can be
  deleted. Only a Super Admin can reword a template item.
- An **Admin (TPM)** sees an **Override** button instead of edit controls —
  a typed reason is required and the change is tagged "TPM Override" in the
  Activity log.

## 8. Milestones & Payments

The single home of the project's **client-facing milestones**. Dashboard,
Delivery, Portfolio, PM Plan, health, and the `.docx` export all read this
list.

**+ Add Milestone:** name, type (Planning · Design · Development · QA · UAT ·
Release · Custom), planned date.

**Each milestone row:** name, type, **Checkpoints n/m** (checklist
checkpoints linked to it, if any), owner, **planned / forecast / actual**
dates (⚠ when the forecast slips past the plan), status, **payment %**,
tranche amount (= contract value × payment %), invoice status (Not Invoiced ·
Invoiced · Paid), client sign-off (Pending · Signed · Acknowledged · N/A),
notes.

- **Total Contract Value** is editable here (PM or Super Admin) — the same
  single value Budget Tracker uses.
- Payment % across all milestones should total **100%**; the table flags it
  in red otherwise.
- A milestone that's already **Invoiced or Paid can't be deleted** until its
  invoice status is set back to Not Invoiced.
- **Stats:** total, completed, in progress, overdue (past due date), total
  paid, remaining.

## 9. Risk & CR

### Risk & Issue Register
Type (Risk · Opportunity · Issue), category, description, **probability** and
**impact** (Low/Medium/High), owner, mitigation, status (Open · Monitoring ·
Mitigated · Closed · Realized · Not Pursued), date raised/closed, notes.
**Risk score** = probability × impact (1–9): 1–2 Low, 3–4 Medium, 6–9 High.
An **open high risk** (type Risk, not Closed/Mitigated, score ≥ 6) makes the
project **Red**.

### Change Request Log
CR code (auto), title, date raised, description, man-days planned, billable
man-days, rate (hidden at read-limited), type (Paid · Free · Exchange), client
sign-off, WBS updated, status (Proposed · Approved · In Progress · Completed ·
Rejected), notes. **Amount** = billable man-days × rate. KPI tiles: Upcoming
(planned man-days of Proposed), Work Order (billable man-days of Approved +
In Progress), Remaining (billable man-days of In Progress).

## 10. Dependencies

What the project is waiting on from **outside the delivery team** — the
client, another internal team, or a third party. Category, description,
preferred format, responsible (organisation), priority (Low · Medium · High ·
Extreme), expected date, status (Due · Done · Blocked), notes. Blocked
dependencies appear as attention items on Portfolio.

## 11. Delivery

Sub-tabs: **Overview · Tasks · Sprints · Dev Checklist · Releases · UAT.**

### Overview
Nothing is entered here — everything is aggregated: Delivery %, planned
start/end (from sprints), forecast end, schedule variance (EV − PV, story
points), current sprint and milestone, **Health** (same rating as the
Dashboard, with reasons), task counts, current sprint progress, **SPI**,
**Effort Index**, and Milestone / Release / UAT summaries.

### Tasks (WBS)
The project-wide WBS, defined once: WBS #, title, **story points** (the
estimate unit), default assignee, sprint. Import from Excel, export to
Excel, bulk select, duplicate-title warnings. **Done points** = story points
× % complete. The sum of all story points is the project's **baseline**.

### Sprints
Lifecycle: **Draft** (plan freely; numbers are zero) → **Open** (started;
PV/EV/AV tracked live) → **Closed** (numbers frozen permanently; only a Super
Admin can reopen). In an open sprint, update each task's % complete, actual
hours (e.g. from Jira), and assignee. **0/100 rule:** a task earns its story
points only at 100%. Closing a sprint with unfinished tasks asks you to move
them to another sprint or accept them as spillover. A task that leaves an
open sprint keeps its contribution to that sprint. Each sprint shows PV, EV,
AV, **SPI** and **Effort Index**; per-person allocation and Jira hours are
reference only. Sprint Playbook and Excel export are on this tab.

**Renaming:** a PM renames a sprint while it's Draft or Open (Sprint
settings). Admin and Super Admin can rename any sprint, including a closed
one, from the **Admin — rename sprint** box. Only the name changes; a closed
sprint's dates and frozen numbers stay as recorded. An Admin (TPM) rename is
logged as an override in the Activity tab.

### Dev Checklist
The Development checklist (§7) — a quality/governance checklist, not a task
tracker.

### Releases
A shipped version/build ("1.4.0 deployed to UAT"): version, name, type
(Internal · Development · QA · Staging · UAT · Production · Hotfix),
environment, release date, owner, related milestone, build number, release
notes, deployment status (Planned · In Progress · Deployed · Rolled Back ·
Failed), approval (Pending · Approved · Rejected), rollback version,
post-release validation, known issues, and **UAT sign-off** (Pending · Signed
· Rejected) with date and feedback.

### UAT
Client acceptance testing, separate from internal QA.
**Test cases:** code, title, scenario, preconditions, steps, expected result,
priority, status (Not Started · In Progress · Passed · Failed · Blocked),
owner, executed date, actual result — optionally linked to a release and a
milestone. **Defects:** code, title, description, severity (Low · Medium ·
High · Critical), priority, status (Open · In Progress · Fixed · Retest ·
Closed · Rejected), owner, reported date, target fix date, retest result,
closed date.

## 12. Budget Tracker

**Super Admin only, testing purposes only** — real budget tracking lives in
a separate portal. It never affects project Health.

- Inputs: Total Contract Value (shared with Milestones & Payments) and
  Planned Man-Days (reference man-day rate only). **Baseline story points**
  are not typed in — they're the WBS total.
- One row per sprint: % planned / % actual complete (cumulative), PV, EV,
  **cumulative actual cost** (with this sprint's own cost and a per-role
  breakdown), CV, SPI, CPI.
- **CPI here is a dollar ratio** (EV ÷ actual cost), where EV is based on
  contract value — it behaves like a margin indicator, not classic EVM CPI.

## 13. PM Plan

One plan per project, matching BS23's `PMP_Template.docx`, in 15 sections
(each shows Completed / In Progress / Not Started by how much is filled in):

1. Rationale · 2. Stakeholders & Access (with influence/interest) ·
3. Charter · 4. Scope & Deliverables Baseline · 5. **Milestone** (read-only —
from Milestones & Payments) · 6. Timeline (phases with start/end) ·
7. Methodology · 8. Resource & Responsibility Plan · 9. **Risk & Issue
Management** (read-only — from the Risk Register) · 10. Test Plan ·
11. Deployment Plan · 12. Communications Plan (+ escalation path) · 13. RACI
Matrix · 14. **Dependency Management** (read-only — from Dependencies) ·
15. **PMO Health & Control Gates** (G0–G6, editable here).

Read-only sections link to their source tab. Long text fields are rich text
and can carry a reference link. **Export .docx** regenerates the Word plan.

## 14. Decisions & Action Items

**Decision Log** — date, decision, rationale, decided by, notes. A permanent
record; no status. **Action Items** — description, owner, due date, status
(Open/Done), notes. Overdue action items feed Reminders and the Dashboard.

## 15. Team & Resourcing

### Access (Team tab)
Who can log in to this project and, for Client/Guest members, which modules
they see. Visible to Super Admin, Admin, Management, PM; **only a Super Admin
edits**. Add existing users as PM, Client, or Guest; set Client/Guest module
access by dropdown or preset.

### Engagement (Resourcing)
Who is working on the project and how hard. Editable by a Super Admin, or by
the project's PM for their own project; read-only for Admin and Management.

- Assign an existing person (from Admin → People) with a role and optional
  start/end dates. Presets: Low 25% · Med 50% · High 90%.
- **Intensity is set per calendar month** — use the month strip to move
  between months.
- **Intensity on this project:** Low 0–39% · Medium 40–59% · High 60%+.
- **Signals (total utilization across all projects):** Healthy < 70% · High
  70–100% · **Over-utilized > 100%**; plus Ending Soon (within 7 days) and New
  to Project.
- An **overlap conflict** is flagged when one person has two or more ≥ 60%
  engagements on different projects with overlapping dates.

## 16. Escalations

Super Admin and Admin (TPM) only — the Admin's own write surface. Type,
title, notes, status (Open · Acknowledged · Resolved), raised by.

## 17. Activity Log

Per-project history for Super Admin, Admin, and PM: the last 200 changes with
who, role, action, and summary. TPM overrides are tagged distinctly.

## 18. Presales pipeline

Deals that aren't projects yet. Visible to Super Admin, PM, Admin,
Management; only Super Admin and PM edit.

- **Tiles:** Open pipeline, **Weighted forecast** (each deal's value × its
  stage's win probability), Closing in 30 days, **Needs attention**, Win
  rate (won ÷ won + lost). Values are converted to USD at a fixed 122 BDT/USD.
- **Win probability comes from the stage** and is never typed in: Lead 10% ·
  Qualifying 25% · Proposal 50% · Negotiation 75% (`lib/presales-pipeline.ts`).
  **Owner's forecast** (Likely to Win / Possible / Long Shot) is the deal
  owner's own read on top of that.
- **Needs attention** = an open deal that is past its expected close date,
  **stale** (no activity for more than 10 days, unless on hold), or has **no
  next step** (no open action item, unless on hold).
- **Board view** (default): one column per stage with its count, value and
  win %. Each card shows value, owner, close date (red when past), the next
  step, and badges for Past close date, Idle Nd, On hold, forecast and POC.
  Super Admin and PM drag a card to another column to change its stage.
  Won and Lost deals are under **Closed deals**. **Table view** has the
  Open / Won / Lost / All / Deleted filters, stage and owner filters, and
  sorting. The view you pick is remembered in your browser.
- **Deal page:** a header with value, win probability, close-date countdown,
  owner, a clickable **stage bar**, and warnings for anything that needs
  attention. Below it: **Next steps** (action items as a to-do list with
  quick-add; the earliest due one appears on the board card), **Decision
  log** (a dated timeline with quick-add), the **Presales checklist**, and
  **Deal details** grouped into Basics, Commercial, Timeline, People,
  Classification and Files.
- **New opportunity** asks for six things (name, client, owner, value, close
  date, stage); everything else is under **More details** or can be added
  on the deal page.
- **Mark as Won** creates a real project (same seeding as Create Project) and
  copies the deal's decisions and action items into it, and its checklist
  items into the PM checklist's **Presales** stage. The new project links
  back to the deal. **Mark as Lost** asks for a reason; **Reopen** reverses
  it. Delete is soft; Permanent Delete is Super Admin only.

## 19. My Engagement

Your own assignments only — project, role, intensity, dates, and your total
current allocation. Needs your account linked to a Person (Admin → People).
Not shown to Management.

## 20. Portfolio

Super Admin, Admin, and Management.

- **Stats:** total and active projects; Healthy / At Risk / Critical counts (projects with no data yet appear as their own grey slice in Portfolio Health)
  (active projects only); contract value, collected, outstanding.
- **Portfolio Health bars** (need ≥ 2 projects with data): Schedule (avg
  SPI), Effort (avg Effort Index), Checklist (share of remaining checklist
  work not overdue), Risk (share of projects with no open high risk).
- **Needs Management Attention** — every active non-green project with its
  reasons (high risks, overdue milestone, SPI, blocked dependencies, missing
  PM/contract value).
- **Overload & Conflicts** (Super Admin/Admin) — people over 100% or with
  overlapping high-intensity engagements.
- **Project table** — stage, health (hover for reasons; archived projects
  show none), Gov/Del progress, contract value, SPI, Effort, risks, next
  milestone. Export to Excel.
- **Upcoming Milestones** — not-done milestones across active projects,
  overdue ones badged.
- **Trends** — portfolio average SPI and Effort Index by sprint end.

## 21. Reminders

Super Admin, Admin, and PM only (a PM sees their own projects). Everything
overdue or due within 7 days from: checklist items (not done, with a planned
date, **excluding recurring cadence items**), action items, open presales
opportunities (expected close date), presales action items on open deals,
and stale presales opportunities. Overdue first, then soonest.

## 22. Admin tools

- **Users** — Super Admin edits (name, email, role, reset password,
  activate/deactivate, delete when safe, CSV/XLSX import); Admin and PM view
  read-only. You can't change your own role or deactivate yourself.
- **People** — the registry every owner field picks from: name, title,
  email, phone, linked portal account, **rate role** and **competency**
  (figures visible to Super Admin only). Also manages the role rate card and
  competency multipliers. Super Admin edits; Admin, Management, PM read.
- **Checklist Template** — the master items new projects (and presales
  opportunities) are seeded from; editing affects **future** projects only.
  Per item: text, **checkpoint** label, and the **↻ recurring** toggle.
  Add, reorder, delete; export to Excel.
- **Audit Log** — every write across the portal, filterable by project,
  actor, and action.

## 23. Login & account

Email + password. Wrong password and deactivated account show the same
message. Role changes and deactivation take effect on the very next request.

## 24. Cheat sheet: how the numbers are calculated

| Metric | Rule |
|---|---|
| **Tracked checklist item** | Not "Not Applicable" and not a recurring cadence item |
| **Governance %** | Completed tracked items ÷ all tracked items (all checklists pooled) |
| **Current stage** | First stage (in order) with an unfinished tracked item; "Completed" if none |
| **Delivery %** | Σ (story points × % complete) ÷ Σ story points of all WBS tasks |
| **Baseline story points** | Σ story points of all WBS tasks |
| **SPI** | Story points earned ÷ story points committed, across started and closed sprints (0/100 rule). Draft sprints don't count |
| **Effort Index** | Story points earned ÷ competency-adjusted man-days (actual hours ÷ 8 × competency multiplier). > 1 = less effort than estimated |
| **Health — Red** | Any open high risk, **or** SPI < 0.9 |
| **Health — Amber** | SPI 0.9–0.99, **or** any overdue milestone |
| **Health — Green** | None of the above, and there is something to judge (a started sprint, a client milestone, or a logged risk) |
| **Health — No data yet** | None of the above **and** nothing to judge yet — no started sprint, no client milestone, no risk. Shown grey; missing data never counts against a project, but it isn't "Healthy" either |
| **Milestone due date** | Forecast date if set, otherwise planned date |
| **Overdue milestone** | Not completed/N/A and due date before today |
| **Next milestone** | Earliest not-done milestone due today or later |
| **Planned end** | Latest milestone date (actual if done, else due date) |
| **Next payment due** | Earliest-due milestone with payment > 0% that's Not Invoiced |
| **Tranche amount** | Contract value × payment % |
| **Overdue / Due soon (reminders)** | Not done and date passed / within the next 7 days |
| **Slipped ⚠** | Actual (checklist) or forecast (milestone) date is later than planned, item not done |
| **Risk score** | Probability × impact, Low=1 · Medium=2 · High=3 |
| **Open high risk** | Type Risk, status not Closed/Mitigated, score ≥ 6 |
| **CR amount** | Billable man-days × rate |
| **Budget Tracker PV / EV** | Cumulative committed / earned story points ÷ baseline × contract value |
| **Budget Tracker CPI** | EV ÷ cumulative actual cost (dollar ratio; testing only) |
| **Overloaded person** | Current total intensity across projects > 100% |
| **Overlap conflict** | Two+ engagements ≥ 60% on different projects with overlapping dates |

## 25. Quick answers to "why can't I see X?"

- **"I can't see Risk/Budget/CR."** You're probably a Client on default
  access. Ask a Super Admin to widen your access on the Team tab. Budget
  Tracker is Super Admin only for everyone.
- **"I can only view, not edit."** Admin (TPM) and Management are
  read-only by design (Admin writes through Escalations/Override); Client and
  Guest depend on their module access.
- **"I can't open this project."** PM/Client/Guest need membership on the
  project's Team tab.
- **"The page says it doesn't exist."** The portal shows "not found" both
  for missing pages and ones you don't have access to — it doesn't reveal
  which.
- **"My recurring item isn't counted."** By design — cadence items never
  count toward progress. Update its **Last done** date instead.
- **"Where did the milestones from the checklist go?"** Checklist tags are
  **checkpoints**. Client milestones are added on Milestones & Payments.
- **"Why is Health red when the project feels fine?"** Hover the health
  badge or read the reasons under the Health tile — it's either an open high
  risk or SPI below 0.9.
- **"I get no reminders."** Only Super Admin, Admin, and PM get them, and
  only for items that have a date.
- **"I can't permanently delete something."** Only a Super Admin can, and
  only after it's been soft-deleted.
