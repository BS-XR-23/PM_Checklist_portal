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
  QA & Testing, DevOps, Creative & XR, plus a Development checklist inside
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

The first tab, ordered by question: where are we → what needs me → how far
along → money → detail. A read-limited viewer (Client default) sees the
status strip (health without reasons), Governance and Delivery % only.

- **Status strip:**
  - **Health** — Critical / At Risk / Healthy / No data yet, with its
    **reasons** (e.g. "3 open high risks"). Reasons only for viewers who
    can see risks and money. See §24 for the rule.
  - **Stage** — the current PM checklist stage, e.g. "Planning · Stage 2
    of 5".
  - **Current sprint** — the running sprint's points earned of committed
    and days left (or the next draft sprint and its planned dates).
  - **Next milestone** — the next milestone due **today or later**, any
    overdue ones counted underneath, and the planned end (latest milestone
    date).
- **Needs attention** — data problems that make other figures wrong, each
  with a **Fix →** link: a milestone that's invoiced or paid but not
  completed, milestones with no date, contract value not assigned to any
  milestone payment (or payments over 100%), no client milestones yet, and
  open high-severity risks. Below them, overdue and due-soon checklist and
  action items (recurring items excluded). Green line when there's nothing.
- **Recent decisions** — last 5 Decision Log entries.
- **Governance** — the gauge with per-checklist bars and item counts.
- **Delivery** — Delivery % as story points done of total, plus **SPI**
  and **Effort Index** (closed sprints).
- **Contract & payments** — one bar: collected · invoiced, awaiting payment
  · on milestones, not invoiced · not on any milestone; plus the next
  payment and any active change-request man-days.
- **Detailed reporting** (expand): checklist stages table (done, first
  planned, last actual), the project Gantt from PM Plan → Timeline (flags
  phases still on their default names), the client milestones table, and
  — Super Admin only — the Budget Tracker's budget burn chart.

## 7. Checklists

The governance backbone. Five checklist types, each seeded from the
Checklist Template when a project is created:

| Checklist | Stages / categories | Where |
|---|---|---|
| **PM** | (Presales) · Governance · Planning · Approvals · Baselines · Closure | Checklist tab |
| **QA & Testing** | Test Planning · Functional Testing · Device Testing · Regression · UAT | Checklist tab |
| **DevOps** | Infrastructure · CI/CD · Security · Monitoring | Checklist tab |
| **Creative & XR** | Storyboard · 3D · UX · Assets · XR Validation | Checklist tab |
| **Development** | Development Readiness · Development Execution · Quality Gate · Development Completion | Delivery → Dev Checklist |

The **Presales** stage only exists on projects won from a presales
opportunity (its items are copied from the deal).

Each check lives in one checklist only: PM = governance, planning,
approvals, money and closure; Development = the dev gate; QA & Testing =
test planning and test passes; DevOps = environments, pipelines, security
and operations; Creative & XR = creative direction, 3D, UX, assets and
on-headset validation. Per-sprint activities (sprint planning, test
execution, device testing, …) are Ongoing cadence items.

**Each item:** text, **Checkpoint** label (if tagged), status, owner (from
the People registry), planned date, actual date, link, notes (hidden at
read-limited). Status: Not Started · In Progress · Completed · At Risk ·
Delayed · Blocked · Not Applicable.

- **Tiles:** Overall Progress · In Progress · Not Started · **Due this week**
  (planned within 7 days) · **Overdue** (planned date passed, not done; due
  today isn't late yet). Click **Overdue** (or the red **Overdue** pill) to
  show only those items; click again for everything.
- **Flags under an item:** "N days late" (red) · "Due today" / "Due in N
  days" (amber, within a week) · "Done N days late" (grey, completed after
  its planned date). The same overdue rule drives the Dashboard, Portfolio
  and Reminders.
- **Completing** an item fills today as its Actual Date when it's empty;
  reopening a completed item clears it. The date stays editable.
- **Links** must be web addresses — a bare `drive.google.com/…` gets
  `https://` added; anything else (e.g. `javascript:`) is refused.
- **Not Applicable** removes an item from Governance % entirely.
- **Checkpoint** — an internal checkpoint tag (e.g. "DoR Approved"). It never
  carries payment; see §2.
- **Ongoing cadence** — recurring activities (weekly CPI/SPI report, monthly
  retro, status meetings, sprint demo, daily standups) sit in their own
  block below the stages with **Owner** and **Last done** ("8 days ago").
  Update Last done each time it happens. They never count toward Governance
  %, current stage, or reminders. Any item can be moved in or out of the
  block from its row menu (•••) — moving in asks first.
- **Stage pills** show completed/tracked per stage and turn green when
  done. The page opens on the **current stage** — the first stage with
  unfinished tracked items.
- **Add** — type into "+ Add a project-specific item to …" at the bottom of
  a stage. Only custom items can be deleted (it asks first). Only a Super
  Admin can reword a template item.
- An **Admin (TPM)** sees an **Override** button instead of edit controls —
  status, owner, dates, link and notes, with a typed reason; the change is
  tagged "TPM Override" in the Activity log.

## 8. Milestones & Payments

The single home of the project's **client-facing milestones**. Dashboard,
Delivery, Portfolio, PM Plan, health, and the `.docx` export all read this
list.

- **Money** (hidden from Read Limited): the contract value (editable by a
  PM or Super Admin — the same value Budget Tracker uses), how much of it is
  on milestones, and the same bar as the Dashboard: collected · invoiced,
  awaiting payment · on milestones, not invoiced · not on any milestone.
- **Tiles:** Delivered (done of applicable) · Next milestone · Overdue (past
  the due date — forecast if moved, else planned) · Need attention.
- **Timeline**, in date order (done ones by when they were done; undated
  last). Each milestone shows its status, when it's due or was done (with
  the original plan if it moved), type, owner, checkpoints n/m, the tranche
  (amount and %) with its invoice status, client sign-off, description and
  acceptance criteria.
- **Flags** on a milestone: invoiced or paid but not completed · overdue by
  N days · no date · forecast after plan · client sign-off recorded but not
  completed · completed with no actual date · **Ready to invoice** (completed,
  has a payment, not invoiced).
- **Add** from the one-line box: name, then type, planned date and payment %.
  **Edit** opens every field, including description and acceptance criteria.
- Marking a milestone **Completed** fills in today as the actual date if
  empty; reopening clears it.
- Payment % must be 0–100% per milestone, and all of them together **can't
  pass 100%** — lower another milestone first.
- A milestone that's already **Invoiced or Paid can't be deleted** until its
  invoice status is set back to Not Invoiced.
- **Read Limited** viewers see milestones, dates, status and sign-off, but no
  contract value, payment, invoice status or notes.

## 9. Risk & CR

### Risk Register
Risks (what could go wrong), issues (what already has) and opportunities
(what could go better), listed **worst first**: open items by score, closed
ones folded away. Filter chips by type appear once there's more than one type.

- **Score** = probability × impact, each Low 1 · Medium 2 · High 3 (1–9):
  1–2 Low, 3–4 Medium, **6–9 High**. Opportunities get a blue badge — a high
  score is good news.
- **Open** = Open, Monitoring or Realized (it happened and is still being
  dealt with). **Closed** = Mitigated, Closed or Not Pursued.
- **Any open Risk or Issue scoring High makes the project Critical** — on the
  Dashboard, Projects list and Portfolio. Opportunities never affect health.
  The "Open — high" tile is exactly that count.
- Each item shows type, status, category, owner, dates and its mitigation
  plan; an open Medium/High risk or issue with no plan is flagged.
- **Add**: type the description in the one-line box, then pick type,
  probability, impact and owner. It's dated today. **Edit** opens every field;
  **Delete** is inside Edit and asks first.
- Changing the status to a closed one fills in **Date closed** (if empty);
  reopening clears it.
- **Read Limited** viewers don't see Notes (page and export).

### Change Request Log
Work asked for beyond the signed scope. Open CRs (Proposed, Approved,
In Progress) first, then Completed; Rejected folded away.

- Each CR shows code (auto), title, type (Paid · Free · Exchange), status,
  client sign-off, WBS updated, date raised, and the money line: man-days
  planned · billable man-days × rate = **amount**.
- Tiles: **Waiting for approval** (Proposed, with estimated man-days) ·
  **Approved & in progress** (billable man-days) · **Completed** ·
  **Paid CR value** — the amount of **Paid** CRs the client agreed to
  (Approved, In Progress or Completed); Proposed, Rejected, Free and Exchange
  add nothing · **Need attention**.
- An agreed CR is flagged when it has **no client sign-off**, the **WBS isn't
  updated**, or (Paid) there's **no billable man-days or rate**.
- **Add** from the one-line box (title, type, estimated man-days); it starts
  Proposed and is dated today. **Edit** opens every field; **Delete** asks
  first — set Rejected instead to keep a record.
- **Read Limited** viewers don't see rate, amount, Paid CR value or Notes
  (page and export).

## 10. Dependencies

What the project is waiting on from **outside the delivery team** — the
client, another internal team, or a third party. Category, description,
preferred format, responsible (organisation), priority (Low · Medium · High ·
Extreme), expected date, status (Due = still waiting · Blocked · Done =
received), notes.

- **Worst first:** overdue items on top, then by priority, then expected
  date; received items last.
- Under each expected date: **Overdue by N days**, **Due today**, or **N days
  left** (amber within 3 days). Received items show nothing.
- Tiles: Total · **Overdue** (with the oldest) · Due · Blocked · Done.
- **Overdue** = not received (Due or Blocked) and the expected date has
  passed. Overdue items show as a Dashboard warning and on Portfolio's
  attention list; overdue **High/Extreme** ones also turn project health
  **At Risk** and appear in **Reminders**. Blocked items still show on
  Portfolio as before.
- Delete asks first — set Done instead to keep a record.
- **Read Limited** viewers don't see Notes (page and export). The export is
  in the same order and adds a "Days late" column.

## 11. Delivery

Sub-tabs: **Overview · Tasks · Sprints · Dev Checklist · Releases · UAT.**

### Overview
Nothing is entered here — everything is read from the other tabs.

- **Health** pill at the top — the same rating and wording as the Dashboard,
  with its reasons.
- **Scope:** % of story points done, and a bar splitting all WBS points
  into **done** · **in the running sprint** · **planned in later sprints**
  (draft sprints — not counted as in progress) · **not in any upcoming
  sprint**, with task counts.
- **When will it finish?** Points left ÷ the pace closed sprints delivered
  (earned points per calendar day across their dates) → an estimated finish
  date, e.g. "~Dec 25 — 101 pts left at ~10 pts/week". Compared with the
  **planned end = the last client milestone date** (same as the Dashboard):
  "about N weeks after the planned end" or "on track". No closed sprint, no
  forecast. Also SPI, Effort Index and schedule variance (closed sprints).
- **Current sprint:** the running one (else the next draft) — dates, days
  left (or "ended N days ago — close it"), points earned of committed, tasks,
  what's next.
- **Client milestones** (next, overdue, delivered), **Releases** (last
  *deployed* by release date, its build, the soonest planned/in-progress
  release, a warning if one failed or was rolled back) and **UAT** (cases
  passed, failed/blocked, open and critical defects, client sign-off of the
  last deployed release — else the next one).

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
- Summary: **Earned value**, **Cost to date**, **Gross margin on earned
  work** ((EV − AC) ÷ EV) and **SPI**.
- One row per **closed** sprint — the same rule as Delivery's SPI, so the
  two always agree: % planned / % actual complete (cumulative), PV, EV,
  **cumulative actual cost** (with this sprint's own cost and a per-role
  breakdown), margin, SPI. The running sprint is shown separately as live
  progress; draft sprints aren't shown.
- **No dollar CPI.** EV is contract *price* and AC is role-rate *cost*, so
  EV ÷ AC measured profit margin, not efficiency — it's shown as margin
  instead. For effort efficiency use Delivery's Effort Index.
- Hours logged by someone with **no Role Rate** cost nothing here; the page
  says how many hours that is.
- If Planned Man-Days is far off what the closed sprints' pace implies for
  the whole WBS, the page points it out (the auto man-day rate is reference
  only and isn't used in any figure).

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

One page (the **Decisions** tab), two columns. Each half is still its own
module with its own access, so a viewer only sees the half they can reach.
The old Action Items link redirects here.

- **Action items** — a to-do list. Tick the circle to mark done; open items
  are sorted by due date (overdue in red), done items fold away. Counts at
  the top: open · overdue · due this week · done. Items with **no owner or
  no due date** are flagged — they never reach Reminders or the Dashboard.
  Add with the one-line quick-add (text, then owner and due date). Overdue
  action items feed Reminders and the Dashboard.
- **Decision log** — a permanent, dated record: newest first, grouped by
  month, shown as text (decision · **Why** · notes · decided by). **Edit**
  on an entry opens its fields; **Delete** sits inside Edit and asks first.
  Search appears once there are more than three. **Log a decision** quick-
  add dates the entry today. "Decided by" is free text — often a client or
  team, not one person.
- **Export .xlsx** for each list.

## 15. Team & Resourcing

### Access
Which portal accounts can open this project and, for Client/Guest members,
which areas they see. Visible to Super Admin, Admin, Management, PM; **only a
Super Admin edits**. Super Admin, Admin and Management see every project
already and don't need a row here.

- Add an existing user (Admin → Users) as PM, Client, or Guest.
- A PM sees and edits every area except the Budget Tracker — nothing to set.
- Each Client/Guest card shows a one-line summary ("Sees 12 of 16 areas ·
  read-only · all with details hidden"). **Change access** opens the
  settings, laid out by project tab (Checklist → PM / QA & Testing / DevOps /
  Creative & XR, Risk & CR → Risks / Change requests, Delivery → Overview,
  tasks & sprints / Dev checklist / Releases / UAT, Decisions → Decision log /
  Action items, …). Levels: No Access · Read Limited (sensitive detail hidden)
  · Read Full · Write. A preset sets every area at once.

### Engagement
A reference list of who works on the project, their role and dates — no
intensity or capacity numbers. Editable by a Super Admin, or by the project's
PM for their own project; read-only for Admin and Management.

- **Only people listed here can be picked as assignees** on Delivery's Tasks
  and Sprints.
- Add a person (from Admin → People): their role defaults to their title;
  start and end dates are optional. A person can be listed once per project.
- The list is grouped: **On the project** · **Starting later** · **no longer
  on the project** (folded; end date passed). The end date counts as a
  working day. Someone ending within a week is tagged "ends in N days".
- **Edit** on a row changes role and dates; **Remove from project** sits
  inside Edit. To keep a record of who worked on it, set an end date instead.

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

Your own assignments only — project, role and dates, plus how many projects
you're on right now. Needs your account linked to a Person (Admin → People).
Not shown to Management.

## 20. Portfolio

Super Admin, Admin, and Management. **Every figure is for active projects
only** (archived projects appear only under the table's "All" tab).

- **Headline:** Active projects (health split: critical · at risk · no data
  yet · healthy) · **Needs attention** (Critical + At Risk) · Contract value
  with collected and awaiting payment · **To invoice, next 90 days** · Avg.
  SPI (closed sprints). Click a tile to filter the table or jump to billing.
- **Needs Management Attention** — first on the page: every active
  Critical or At Risk project with its reasons (high risks, overdue
  milestone, SPI, blocked or overdue dependencies, missing PM/contract value). A green
  line says so when there are none.
- **Billing & Cash** — built from each project's Milestones & Payments
  (tranche = contract value × payment %):
  - **Contract value bar:** collected · invoiced, awaiting payment ·
    scheduled on milestones, not invoiced · **not tied to any milestone**.
  - **Billing forecast:** not-yet-invoiced tranches by due month for the
    next 6 months, plus **Ready to invoice** (milestone completed, not yet
    invoiced), **Past due date**, and Later. Click a row to see its tranches.
  - **Can't be forecast yet:** projects whose milestone payment % doesn't
    reach 100% of the contract, and tranches with no date.
- **Project table** — opens on Active; tabs for Needs attention, Critical,
  At Risk, No data yet, Healthy, Completed, and All (incl. archived). Stage,
  health (hover for reasons), Gov/Del progress, contract value, SPI, Effort,
  risks, next milestone. Export to Excel.
- **Upcoming Milestones** — not-done dated milestones across active
  projects, overdue ones badged.
- **Delivery trend** — portfolio average SPI and Effort Index by closed
  sprint (shown once there are at least two), and active projects by stage.

## 21. Reminders

Super Admin, Admin, and PM only (a PM sees their own projects). Everything
overdue or due within 7 days from: checklist items (not done, with a planned
date, **excluding recurring cadence items**), action items, **overdue
High/Extreme dependencies** (overdue only), open presales
opportunities (expected close date), presales action items on open deals,
and stale presales opportunities. Overdue first, then soonest.

## 22. Admin tools

- **Users** — Super Admin edits; Admin and PM view read-only.
  - Name and email change behind **Edit name & email**; emails must be
    valid and unique. **Reset password** asks first, then shows a temporary
    password once.
  - **Role** asks first and lists what follows: lowering someone's role
    lowers their project role too (a PM made Guest becomes Guest on every
    project, with the default Guest access). A project role can never be
    higher than the person's global role.
  - You can't change your own role or deactivate yourself, and the last
    active Super Admin can't be demoted.
  - **Staff not linked to a Person** counts staff accounts (Super Admin,
    Admin, Management, PM) with no People record — clients and guests don't
    need one.
- **People** — the registry every owner field picks from: name and title,
  email and phone, linked portal account, **rate role** and **competency**
  (figures visible to Super Admin only — the numbers never leave the server
  for anyone else). Also manages the role rate card and competency
  multipliers. Super Admin edits; Admin, Management, PM read.
  - An unlinked person with a matching account (same email, else the only
    same-name account) shows **Link to …?** — one click links them.
  - **Delete** asks first and says what goes with it (engagements, owned
    items lose their owner). Someone with logged sprint hours can't be
    deleted — those hours are cost history.
  - Deleting a rate role or competency asks first and says how many people
    use it.
- **Checklist Template** — the master items new projects (and presales
  opportunities) are seeded from; editing affects **future** projects only.
  Per item: text, **checkpoint** label, and the **↻ recurring** toggle.
  Add, reorder, delete; export to Excel.
- **Audit Log** — every write across the portal, filterable by project,
  actor, and action.

## 23. Login & account

Email + password. Wrong password and deactivated account show the same
message. Role changes and deactivation take effect on the very next request,
including the project roles that follow a role change.

## 24. Cheat sheet: how the numbers are calculated

| Metric | Rule |
|---|---|
| **Tracked checklist item** | Not "Not Applicable" and not a recurring cadence item |
| **Governance %** | Completed tracked items ÷ all tracked items (all checklists pooled) |
| **Current stage** | First stage (in order) with an unfinished tracked item; "Completed" if none |
| **Delivery %** | Σ (story points × % complete) ÷ Σ story points of all WBS tasks |
| **Baseline story points** | Σ story points of all WBS tasks |
| **SPI** | Story points earned ÷ story points committed, across **closed** sprints (0/100 rule). A running sprint is shown as live progress and joins SPI when it closes, so SPI doesn't drop at every sprint start. Draft sprints don't count |
| **Effort Index** (scope) | Same closed-sprints-only rule as SPI |
| **Effort Index** | Story points earned ÷ competency-adjusted man-days (actual hours ÷ 8 × competency multiplier). > 1 = less effort than estimated |
| **Health — Red** | Any open high risk or issue, **or** SPI < 0.9 |
| **Health — Amber** | SPI 0.9–0.99, **or** any overdue milestone, **or** any High/Extreme dependency past its expected date |
| **Overdue dependency** | Status Due or Blocked and the expected date has passed |
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
| **Open high risk** | Type Risk or Issue (not Opportunity), status Open/Monitoring/Realized, score ≥ 6 |
| **CR amount** | Billable man-days × rate |
| **Paid CR value** | Sum of CR amounts where type is Paid and status is Approved, In Progress or Completed |
| **Budget Tracker PV / EV** | Cumulative committed / earned story points across **closed** sprints ÷ baseline × contract value |
| **Budget Tracker margin** | (EV − cumulative actual cost) ÷ EV — EV is contract price, AC is role-rate cost (testing only; replaces the old dollar CPI) |
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
  risk or issue (Risk & CR → Risk Register, "Open — high") or SPI below 0.9.
- **"I get no reminders."** Only Super Admin, Admin, and PM get them, and
  only for items that have a date.
- **"I can't permanently delete something."** Only a Super Admin can, and
  only after it's been soft-deleted.
