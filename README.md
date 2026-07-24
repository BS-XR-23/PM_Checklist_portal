# XR PM Checklist Portal

A small internal web app for BS23's fixed-budget XR project governance — replaces
`PM_Checklist_Tracker.xlsx` and generates the standard `PMP_Template.docx` Project
Management Plan, per project. Not a task tracker: sprint/task-level work stays in Jira.

Stack: Next.js 14 (App Router) + TypeScript, Prisma + Postgres (Supabase), NextAuth
(email/password), Recharts, docxtemplater. Single deployable app, self-hosted via Docker.

## Modules

Dashboard · PM Checklist (51 items / 7 stages) · DevOps Checklist (18 items / 5
categories) · Milestones & Payments (derived from both checklists) · Risk Register ·
CR Log · Budget Tracker (EVM) · PM Plan (editable form, exports back to `.docx`).

Every project you create gets a fresh instance of all 8 modules. Status colors, the
Forecast-slipped-past-Planned flag, risk severity, and SPI/CPI favorability all use
the exact hex values from the source spreadsheet's conditional formatting.

## Local development

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
npm run create-user -- someone@bs23.com "Their Name"
```

This prints a one-time temporary password — there's no self-serve signup or password
reset UI, matching the "handful of PMs, no enterprise auth" requirement.

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
