# XR PM Checklist Portal

A small internal web app for BS23's fixed-budget XR project governance — replaces
`PM_Checklist_Tracker.xlsx` and generates the standard `PMP_Template.docx` Project
Management Plan, per project. Not a task tracker: sprint/task-level work stays in Jira.

Stack: Next.js 14 (App Router) + TypeScript, Prisma + Postgres (Supabase), NextAuth
(email/password), Recharts, docxtemplater. Single deployable app, self-hosted via Docker.

## Modules

Per project: Dashboard · Checklists (PM, Delivery & QA, DevOps, Creative & XR,
plus a Development checklist under Delivery) · Milestones & Payments · Risk &
CR · Dependencies · Delivery (Tasks/WBS, Sprints, Dev Checklist, Releases,
UAT) · PM Plan (editable form, exports back to `.docx`) · Decisions & Action
Items · Team & Resourcing · Escalations · Activity. Portal-wide: Projects,
Presales, Portfolio, Reminders, My Engagement, and Admin (Users, People,
Checklist Template, Audit Log). Budget Tracker is Super-Admin-only and for
testing; real budget tracking lives in a separate portal.

Every new project gets a fresh copy of each checklist from the Admin-editable
Checklist Template. Three concepts are kept deliberately separate (see
`docs/USER_GUIDE.md` §2):

- **Milestones** — client-facing delivery commitments, the only thing that
  carries payment %, invoice status, and client sign-off (Milestones &
  Payments tab; everything else reads them).
- **Checkpoints** — internal steps tagged on checklist items; never payment.
- **Gates (G0–G6)** — the PMO stage-gate framework in the PM Plan.

Health and progress have one definition each, in `lib/project-health.ts` and
`lib/milestones.ts`: **Governance %** (checklist), **Delivery %** (story
points), **SPI** (earned ÷ committed story points), and a Red/Amber/Green
rating from open high risks, SPI, and overdue milestones. Recurring cadence
checklist items are excluded from progress. Full formulas:
`docs/USER_GUIDE.md` §24. Audit fixes and their status: `docs/FIX_PLAN.md`.

## Resourcing (People & Engagements)

A `Person` registry is the single source of truth for a real person — name, title, contact info,
and (optionally) a linked portal account. Checklist/Risk "Owner" and PM Plan Stakeholder rows can
reference a `Person` instead of re-typing a name each time (the old free-text field is kept as a
fallback for anything not yet linked — nothing is deleted). Each project has a `Resourcing` tab
listing who's engaged on it: role on that project, an optional date range, and a coarse
intensity (0-100%, Low/Med/High presets) set **per calendar month** — deliberately not a
scheduling, timesheet, or cost tool.

- **Admin > People** creates/edits the registry (Super Admin only, to keep it from fragmenting
  into duplicates). A project's **Resourcing** tab (Admin or that project's PM) assigns *existing*
  people to that project.
- A Person linked to a portal account (typically **Limited**) sees only their own assignments at
  **My Engagement** — never anyone else's, resolved by their linked account, not by project
  membership.
- **TPM** sees every person's engagement everywhere (read-only); a **PM** sees engagement only for
  people on their own project(s), including full detail on any *other* project a shared person is
  also stretched across. **Client** has no resourcing access at all.
- The **Portfolio** page's "Overload & Conflicts" section (Admin/TPM only) surfaces anyone whose
  combined active-engagement intensity exceeds 100%, and anyone with two high-intensity (≥60%)
  engagements on overlapping dates — even if their total doesn't cross the threshold. Both
  thresholds are named constants in `lib/constants.ts`.

Migrating existing free-text owner names into the registry is a two-step, human-reviewed process
— never automatic merging of similar-but-different names:

```bash
npm run match-people             # dry run: proposes exact-match groups, flags anything ambiguous
npm run apply-people-matches -- "Exact Name" ["Another Name" ...]   # only the names you approve
```

## Roles & access

Six roles, enforced server-side (not just hidden UI). The UI shows display labels
(in brackets) over the system role names: **ADMIN** [Super Admin] (full control,
manages users/roles/projects), **TPM** [Admin] (read-everywhere, writes only through
the Escalations tab or an explicit "TPM Override" — always logged and tagged
distinctly from a PM's own edits), **PROGRAM_MANAGER** [Management] (the
`/portfolio` RAG rollup plus read-only drill-down into every project, except
Decisions/Action Items/Escalations/Activity), **CLIENT** (hard-isolated to their
assigned project(s), locked-down default visibility — no Risk Register/CR
Log/Budget, no internal notes), **PM** (full read/write on their assigned
project(s) only), **LIMITED** [Guest] (per-project, per-module access an Admin
configures; starts at read-limited on every module except Budget Tracker).

`lib/rbac.ts` is the single authorization module every page and server action goes
through — `Admin > Users` sets a user's global role; a project's `Team` tab assigns
them to specific projects and (for Client/Limited) configures per-module access.
Every write is recorded in `AuditLog`, visible per-project (`Activity` tab) and
globally (`Admin > Audit Log`).

```bash
npm test              # all unit + integration tests — integration tests WRITE [TEST] rows to the DB
npm run test:unit      # just the fast, DB-free logic tests (everything under lib/)
npm run test:isolation # just the Supabase-backed cross-project isolation test
```

## Local development

> **Warning:** if your `.env` points at the same Supabase project as the live site
> (it currently does), local dev, `npm test`'s integration tests, migrations, and
> scripts all act on production data and share its connection cap. Use a separate
> Supabase project for development (Phase 0 of `docs/FIX_PLAN.md`).

```bash
cp .env.example .env      # set DATABASE_URL/DIRECT_URL from Supabase, NEXTAUTH_SECRET, seed admin creds
npm install
npm run db:migrate        # applies the schema to your Supabase database
npm run db:seed           # creates the first admin user from .env
npm run dev
```

`DATABASE_URL` and `DIRECT_URL` come from Supabase → **Connect** button → **Direct**
tab. Use the **Session pooler** string (port 5432) for both — it's IPv4-compatible
(the plain "Direct connection" option is IPv6-only and often unreachable) and suits
this app's single long-running container better than the Transaction pooler, which
is tuned for serverless. If you'd rather use the Transaction pooler (port 6543) for
`DATABASE_URL`, add `?pgbouncer=true` to it and keep `DIRECT_URL` on a non-pgbouncer
connection — `prisma migrate` needs that.

Log in at `http://localhost:3000/login` with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`
from `.env`.

To add another PM:

```bash
npm run create-user -- someone@bs23.com "Their Name"   # or Admin > Users in the app
```

This prints a one-time temporary password. There's no self-serve signup; a Super Admin
creates accounts and resets passwords from **Admin > Users**, matching the "handful of
PMs, no enterprise auth" requirement.

## Docker

```bash
cp .env.example .env      # set DATABASE_URL/DIRECT_URL, NEXTAUTH_SECRET, seed admin vars
docker compose up --build
```

Data lives in Supabase, not in the container, so there's no local volume to manage.
Migrations and the initial admin seed run automatically on container start
(`docker-entrypoint.sh`).

## Regenerating the PM Plan docx template

`templates/pmp-plan-template.docx` is a **generated file** — `../PMP_Template.docx`
(the original BS23 template) with its bracket placeholders (`[Project Name]`, etc.)
turned into `docxtemplater` merge tags (`{project_name}`), and its three sample
tables (Stakeholders, Communications, RACI) turned into row-loop templates. It's
committed to the repo so the running app has no Python dependency.

If the upstream `PMP_Template.docx` changes, regenerate it:

```bash
python3 -m pip install python-docx
python3 scripts/prepare_pmp_template.py
```

Then check the paragraph/tag mapping in the script still lines up (it asserts on
run counts and will fail loudly if the template's structure changed).

## Deliberate deviations from the spreadsheet

- **Timeline sheet** — folded into the Dashboard as a small per-stage timeline
  strip instead of a 9th module (it's derived Gantt data, not something PMs enter
  directly).
- **Total Contract Value** — the spreadsheet had two independent entry cells (one
  on Milestones & Payments, one on Budget Tracker) that weren't linked to each
  other. The portal uses a single `Project.contractValue` field, editable from
  either page, so the two can't drift out of sync.
- **Communications Plan escalation note** — the template's instructional sentence
  ("Include escalation path...") is now a labeled `Escalation Path` field,
  consistent with the other labeled fields in Charter/Methodology/Test
  Plan/Deployment Plan.
