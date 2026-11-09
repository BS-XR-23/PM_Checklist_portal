# QMS Integration Plan

**Status:** approved (2026-11-06): lifecycle stages, the 43-item PM list and hiding QMS Audit from CLIENT and LIMITED. Phases 1-3 are built on branch `feature/qms-phase-1`, tested on staging, and dry-run on a copy of the production data (§9). Nothing is on production yet.

**Sources compared:**

| Document | Role in this plan |
|---|---|
| QMS Audit Checklist, Fixed Budget tab | The requirement: 45 acceptance criteria and 70 process steps across 14 topics |
| `PM_Checklist_Tracker.xlsx` | The XR additions to the QMS process: 51 PM and 18 DevOps items |
| `PMP_Template.docx` | The structure of the PM Plan |
| Portal template (`lib/seed-data.ts`) | The current implementation: 109 items across 5 checklists |

## 1. The recommendation

1. **One place to work, one automatic view for audit.** Teams work only in the checklists. QMS is a read-only result that nobody edits.
2. **A criterion is done when its linked items are complete with owner, actual date and link.** There is no validation step.
3. **The PM checklist returns to the project lifecycle:** Initiation, Planning, Kickoff, Development, Release, Closing. This matches the QMS and the original tracker, and replaces Governance, Planning, Approvals, Baselines and Closure.
4. **The 45 criteria map to 34 checklist items plus the CR log.** The QMS sheet's own evidence reuses one link across several criteria, so a separate row for each isn't needed.
5. **Recurring work gets a log with evidence per occurrence.** A single "Last done" date can't show an auditor every sprint.
6. **All 70 process steps appear as read-only guidance in the QMS view.** Nobody ticks them.

```
QMS criteria and process steps (in code, 45 + 70 rows)
        │ linked through qmsRefs on checklist items
        ▼
Where work happens
PM · Dev · DevOps checklists · recurring log · CR log
        │ status, owner, date and link flow up
        ▼
QMS Audit sub-tab (read-only, under Checklist) ──► Excel export
```

Why not the alternatives:

- **A separate QMS checklist** means ticking the same work twice, and the two lists drift apart.
- **A QMS-only PM checklist** loses the XR, risk, privacy and commercial checks that your tracker requires and the QMS doesn't mention.

## 2. How QMS status is calculated

**One-time items**

| Status | Rule |
|---|---|
| Not started | The item is Not Started |
| In progress | The item is started but not Completed |
| Evidence missing | The item is Completed, but owner, actual date or link is empty. Or it's N/A with no reason in its notes |
| Done | The item is Completed with owner, actual date and link |
| N/A | The item is Not Applicable with a reason in its notes |

**Recurring items**

| Status | Rule |
|---|---|
| Not started | No log yet |
| Done | At least one log with a link. The QMS view shows how many logs exist and the latest date |
| N/A | The item is Not Applicable with a reason in its notes |

The portal does not flag recurring work as overdue and applies no time limits.

**A criterion linked to several items**

- N/A items are ignored, and the criterion is N/A only if all of them are.
- It's Done only when all the others are Done.
- Evidence missing applies when all are complete but any lacks information.

**CR criteria read from the CR log**

- A project with no agreed CRs shows N/A.
- Q33 is Done when every Approved, In Progress or Completed CR has a client sign-off and a document link.
- Q34 is Done when every such CR has WBS Updated set to Yes.

**Other rules**

- Completing an item never requires a link, so work isn't blocked. It just doesn't count for QMS until the information is complete.
- If an item is reopened, its criterion updates immediately.
- The header shows "N of M done". N/A is excluded.

**Known limit:** the portal checks that a link is a valid web address, not what it contains. Showing owner and date beside each link in the export keeps this accountable.

## 3. Final PM checklist (43 items)

The change column is relative to the current `lib/seed-data.ts`. `(CP)` marks a checkpoint label that is kept.

### One-time items (35)

| # | Stage | Item | QMS | Change |
|---|---|---|---|---|
| P1 | Initiation | Collect RFP, Proposal, Contract/PO, initiation email and pre-sales documents in the project repository | Q2 | Merges 2 items |
| P2 | Initiation | Confirm client-approved platforms and performance expectations (CP) | – | Keep |
| P3 | Initiation | Confirm data privacy and compliance requirements with the client | – | Keep |
| P4 | Initiation | Create MS Teams channel and SharePoint space for the project | Q1 | Keep |
| P5 | Initiation | Onboard the team: tool and environment access, NDAs signed | – | Keep |
| P6 | Initiation | Set up the agile board in the PM tool | Q3 | **New** |
| P7 | Planning | Complete and approve Definition of Ready (DoR) (CP) | – | Keep |
| P8 | Planning | Prepare the Project Management Plan (CP) | Q4 | Reword |
| P9 | Planning | Conduct the initial risk workshop; populate the Risk Register | – | Keep |
| P10 | Planning | Define budget controls in the PM Plan: contingency %, CR rate, CPI/SPI thresholds | – | Merges 3 items |
| P11 | Planning | Estimate Epics in story points (1 SP = 1 man-day) and set the delivery timeline | Q5, Q6 | Split; restores the tracker's SP rule |
| P12 | Planning | Notify the line manager of any major deviation between sales and development estimates | Q8 | Split |
| P13 | Planning | Build the WBS: Epics with IDs and estimates in tabular format, traceable to the SRS, loaded into the PM tool | Q9, Q10, Q11 | Merges 2 items |
| P14 | Planning | Prepare the product backlog, milestone and release plan | Q7 | Split from refinement |
| P15 | Planning | Confirm Feature Definition Sheet and scope boundaries with the client | – | Keep |
| P16 | Planning | Share the SRS or sprint backlog version with the client | Q12 | Split |
| P17 | Planning | Get client sign-off or acknowledgement of the SRS (don't block on it) | Q13 | Split |
| P18 | Kickoff | Map each milestone to a payment tranche and confirm the payment terms with the client (CP) | – | Keep |
| P19 | Kickoff | Hold the kickoff meeting with the client present; celebrate with team, client and sales (CP) | Q14 | Keep |
| P20 | Kickoff | Upload final pre-development documents to the project repository | Q15 | Keep |
| P21 | Development | Confirm development is complete; break down any partial WBS items and get client confirmation | – | **New** (QMS process step) |
| P22 | Release | Obtain platform or app-store certification (CP) | – | Keep |
| P23 | Release | Obtain UAT sign-off from the client (CP) | Q38 | Keep |
| P24 | Release | Send the completion and release report to stakeholders | Q35 | Split |
| P25 | Release | Raise the invoice per the payment schedule | – | Split |
| P26 | Release | Hold the release ceremony with the client | Q40 | **New** |
| P27 | Closing | Send the Project Closure Report (CP) | Q41 | Split |
| P28 | Closing | Obtain the formal completion certificate | Q43 | Split |
| P29 | Closing | Celebrate completion with the client; publish internally and externally if there is no NDA | Q42 | **New** |
| P30 | Closing | Conduct the customer satisfaction survey | Q44 | Keep |
| P31 | Closing | Deliver domain KT (video and short document) and upload it to the project repository | Q45 | Reword |
| P32 | Closing | Hand over credentials and infrastructure; revoke access; archive repos, PM tool and SharePoint | – | Merges 2 items |
| P33 | Closing | Hold a lessons-learned session | – | Keep |
| P34 | Closing | Agree any maintenance; activate support/AMC per contract after full payment | – | Reword |
| P35 | Closing | Evaluate the opportunity to move from fixed price to T&M | – | Keep |

### Recurring items (8)

These appear in the Ongoing cadence block with a Log button. Frequency is guidance for the PM only, and the portal doesn't enforce it.

| # | Item | Frequency | QMS | Change |
|---|---|---|---|---|
| R1 | Hold backlog refinement with team, TL and client; confirm priorities | Each sprint | Q16, Q17 | Reword |
| R2 | Hold sprint planning; send the SRS Sprint PDF to the client | Each sprint | Q19 | Keep |
| R3 | Get client acknowledgement of the sprint requirements and task list | Each sprint | Q18, Q20 | **New** |
| R4 | Daily scrum file created and maintained; PM clock entries up to date | Each sprint | Q21, Q22, Q23 | **New**; restores the tracker's item |
| R5 | Hold sprint review with the client or send the update; share the demo; list bugs and improvements with estimates; update Done items in WBS | Each sprint | Q25, Q26, Q27 | Reword |
| R6 | Hold the retrospective and plan improvement tasks (minimum monthly) | Monthly | Q28, Q29 | Reword |
| R7 | Upload the weekly status report with CPI/SPI to ERP; escalate beyond the threshold | Weekly | Q24, Q30, Q31 | Reword |
| R8 | Hold the stakeholder status meeting (minimum monthly, twice preferred) | Monthly | Q32 | Keep |

**Why P21 exists:** Development would otherwise contain only recurring items, which `currentStage()` ignores. The Dashboard would then jump from Kickoff straight to Release.

## 4. Changes to other checklists

| Checklist | Item | Change | QMS |
|---|---|---|---|
| Dev | Architecture available | **Architecture document written and linked** | – |
| Dev | Technical documentation completed | **README and technical documentation written and in the repository** | Q45 |
| Dev | Technical handover completed | **Technical handover done, with maintenance video recorded** | Q45 |
| DevOps | Create a Git repository AND set up asset version control… | No wording change | Q3 |
| DevOps | Run SAST/DAST, dependency and mobile security scans… | Add **"and record the result"** | Q36 |
| DevOps | Define release & rollback runbook | **Define the release and rollback runbook and deployment checklist** | Q37 |
| DevOps | Schedule and execute production deployment… | No wording change | Q39 |

QA & Testing and Creative & XR stay as they are. Every other Dev and DevOps item also stays as it is. The final template has 115 items: PM 43, QA 12, DevOps 24, Creative 10, Dev 26.

**TD ownership:** the tech lead owns the technical documentation and handover items, and the PM owns the domain KT. Q45 is done only when all three are complete. "TD" is read here as technical documentation, so replace this if a separate company TD list exists.

## 5. Criteria map

Every criterion has one source. Expected evidence appears on the item's QMS badge and in the QMS view.

| # | Topic | Criterion | Source | Expected evidence |
|---|---|---|---|---|
| Q1 | Project Management Plan | MS Teams creation + SharePoint repository | P4 | Teams or SharePoint link |
| Q2 | Project Management Plan | All project docs, including pre-sales, stored in the repository | P1 | Repository folder |
| Q3 | Project Management Plan | PM board and Git repository created | P6 + DevOps Git | Board link; repository link |
| Q4 | Project Management Plan | Project plan document created | P8 | PM Plan document |
| Q5 | Project Management Plan | Project estimation and delivery timeline | P11 | Estimation sheet |
| Q6 | Development Estimation | Estimate in story points, 1 = 1 man-day | P11 | Estimation sheet |
| Q7 | Development Estimation | Product backlog, milestone and release planning | P14 | Backlog or plan |
| Q8 | Development Estimation | Line manager notified of major deviation | P12 | Email, or a note that there was no deviation |
| Q9 | WBS | Kept in tabular format | P13 | WBS sheet or Tasks export |
| Q10 | WBS | Includes ID for tracing | P13 | Same |
| Q11 | WBS | Includes estimation | P13 | Same |
| Q12 | Sprint Backlog and SRS | A version of sprint backlog or SRS | P16 | SRS or backlog document |
| Q13 | Sprint Backlog and SRS | Client sign-off or acknowledgement | P17 | Email or screenshot |
| Q14 | Project Kick-off | Kick-off celebration evidence | P19 | Photo, recording or invite |
| Q15 | Project Kick-off | Final documents uploaded to the repository | P20 | Repository folder |
| Q16 | Backlog Refinement | Refinement meeting | R1 | Meeting notes |
| Q17 | Backlog Refinement | Alignment with client | R1 | Same |
| Q18 | Backlog Refinement | Client sign-off or acknowledgement | R3 | Email or screenshot |
| Q19 | Sprint Planning | Tasks created, estimated and assigned | R2 | Sprint board or SRS Sprint PDF |
| Q20 | Sprint Planning | Client sign-off of the sprint task list | R3 | Email or screenshot |
| Q21 | Daily Scrum | Sprint task list, yesterday, time spent, today | R4 | Scrum file |
| Q22 | Daily Scrum | PM Scrum file uploaded to ERP | R4 | Same |
| Q23 | Daily Scrum | PM clock entry ensured | R4 | Same |
| Q24 | Sprint Review | CPI report updated | R7 | CPI sheet |
| Q25 | Sprint Review | Client engaged, or update sent | R5 | Recording or email |
| Q26 | Sprint Review | Improvements and bugs listed with estimates | R5 | Review notes |
| Q27 | Sprint Review | Done items updated in WBS | R5 | WBS or Tasks export |
| Q28 | Sprint Retrospective | Retrospective at the planned interval | R6 | Retro notes |
| Q29 | Sprint Retrospective | Improvement tasks planned from feedback | R6 | Same |
| Q30 | Progress Tracking | Weekly report uploaded to ERP | R7 | Report |
| Q31 | Progress Tracking | CPI result | R7 | CPI sheet |
| Q32 | Progress Tracking | Stakeholder meeting evidence | R8 | Notes or invite |
| Q33 | Change Request Management | CR document with customer approval | CR log | CR document link |
| Q34 | Change Request Management | Backlog updated with CR items | CR log | WBS Updated = Yes |
| Q35 | Release | Completion and release report | P24 | Report |
| Q36 | Release | Vulnerability assessment result | DevOps scan | ZAP or MobSF report |
| Q37 | Release | Deployment checklist | DevOps runbook | Checklist or runbook |
| Q38 | Release | Customer sign-off or email approval | P23 | Email or screenshot |
| Q39 | Release | Production deployment | DevOps production | Deployment record |
| Q40 | Release | Release ceremony with client | P26 | Photo, recording or invite |
| Q41 | Closing | Project closure report | P27 | Report |
| Q42 | Closing | Celebration with client | P29 | Photo or post |
| Q43 | Closing | Completion certificate | P28 | Certificate |
| Q44 | Closing | Customer feedback | P30 | Survey result |
| Q45 | Closing | KT and TD uploaded to the repository | P31 + 2 Dev items | Repository folders |

**Source choice for UAT sign-off (Q38):** P23 is the source because it already has a link field and is the formal PM step. `Release.uatSignoffStatus` stays as a per-build record. Keeping the two in step is deferred (section 10).

## 6. The 70 process steps

- **All 70** appear as read-only guidance under their topic in the QMS view.
- **Most** are also delivered by an item above, by a module (WBS, Sprints, CR log, Milestones, Releases) or by another checklist.
- **Rules rather than checks** stay as guidance only: the 1–3 week planning phase, 5% documentation time, watching the burndown, and "plans may fail, but planning must happen".
- **One field is added:** the CR's timeline effect (section 7).

## 7. Code and data changes

| Change | Where |
|---|---|
| Criteria and process steps, in the sheet's row order | New `lib/qms-criteria.ts` |
| Status rules as pure functions with unit tests | New `lib/qms.ts` |
| `qmsRefs String[]` on template and project items | `ChecklistTemplateItem`, `ChecklistItem` |
| Recurring log: date, sprint, link, notes, recorded by | New `ChecklistOccurrence` model |
| `documentLink` and `timelineImpact` | `ChangeRequest` |
| Lifecycle stages and new items | `lib/seed-data.ts`, new migration |
| Log button and history; latest log updates `actualDate` | `components/checklist/checklist-table.tsx` |
| QMS badge and "QMS items only" filter on checklist rows | `components/checklist/checklist-table.tsx` |
| QMS Audit sub-tab, using the existing Checklist sub-nav | New route under `app/projects/[projectId]/checklist/` |
| Excel export with the QMS sheet's columns and order | New route under `app/api/projects/[projectId]/` |
| Guide updates, including the stale daily standup mention | `docs/USER_GUIDE.md` §2, §7 |

**Deliberately not added:** a QMS role, a review table, an editable QMS template or a new top-level tab.

**Access:** QMS Audit is visible to ADMIN, TPM, PROGRAM_MANAGER and PM. It's hidden from CLIENT and LIMITED because it shows internal evidence links.

**QMS updates:** a new QMS version is a code and migration change, the same way template reviews already work.

**Checked:** no application logic depends on item wording. PM stage names appear only in `lib/seed-data.ts` and in data migrations and scripts; `lib/calculations.test.ts` uses its own sample stage list. "Governance %" is unrelated to the stage name and stays.

## 8. Existing projects

The migration follows the conservative rules of `20261015120000_checklist_template_review`:

- Rewording and stage moves apply to every project.
- Splits, merges and new items apply to ACTIVE projects only. Archived projects keep their numbers and combined wording, and only move to the new stages.
- Nothing a PM has touched is deleted.
- **Splits:** the original item keeps its status, owner, dates and link. The new part starts as Not Started, so no sign-off is claimed that nobody recorded.
- **Merges:** the first item takes the merged wording and keeps its status. An untouched duplicate is removed. A touched duplicate stays as its own row, marked custom so the PM can review and delete it.
- **Presales items and items PMs added themselves** are never reworded. Items left in a retired stage move to the closest lifecycle stage.
- **Existing "Last done" dates and links** are not converted into logs, because a log should carry real evidence. PMs add evidence from that point on.
- Completed items with no link show Evidence missing until they're backfilled.

## 9. Delivery order

Estimates are rough working days.

| Phase | Work | Effort |
|---|---|---|
| 0 | Set up the staging database (FIX_PLAN Phase 0). Apply `20261015120000_checklist_template_review` and `20261027120000_enable_rls_lockdown` | 0.5 day, plus staging setup |
| 1 | New PM list and stages, Dev and DevOps rewording, `qmsRefs`, migration, guide | 1.5–2 days |
| 2 | Recurring log with history; CR document link and timeline effect | 2 days |
| 3 | `lib/qms.ts`, QMS Audit sub-tab, Excel export | 2–3 days |

**The code** is on branch `feature/qms-phase-1`, with its migrations in `prisma/migrations/20261106120000_qms_pm_lifecycle_template` and `20261106130000_checklist_occurrences_and_cr_evidence`. They have been applied to the staging database, whose settings are in the git-ignored `.env.staging`, and has not been applied to production. On staging, the integration tests pass once their timeout allows for remote latency (`--testTimeout=90000 --hookTimeout=120000`).

**Dry run on real data (2026-11-09).** A read-only snapshot of the production database (1 project, 104 checklist items, last migration `20261014150000`) was loaded into a local in-memory Postgres, and the four pending migrations were run on it in order. All four run cleanly. No item with progress was lost or changed, custom items and the milestone payment are untouched, every other table keeps its row count, RLS is on for every table, and the project's checklist items cover all 43 non-CR criteria. The dry run found three gaps in the QMS migration, now fixed in it:

- the platforms item still had its pre-review wording "(Quest/Vision Pro/WebXR/AR/PCVR)", so it matched no template item. It is now reworded;
- "Review and confirm payment terms and schedule" had been completed, so it stayed as a template-less item the PM couldn't delete. Like the other merged items, it is now marked custom;
- the risk workshop item, in the template since 2026-09-09, had never been copied to this project. It is now added after the PM Plan.

The QMS Audit tab for that project then shows 3 criteria done, 10 with evidence missing (mostly completed items without a link, or N/A without a reason), 3 in progress, 27 not started and 2 N/A (no change requests).

**Left as found (not QMS).** Some older template changes never reached this project: QA lacks the performance-budget item, and some DevOps and Creative items keep older wording. Dev also keeps 9 retired items that had progress, which the PM can't delete because they aren't custom. None of these items carries a QMS reference. They need a separate template-sync migration if wanted.

**Before production:** take a backup, then apply the four pending migrations in order with `prisma migrate deploy`.

## 10. Left unchanged for now

- **G0–G6 gates.** None of the three source documents require them, and they're separate from QMS. Leave them as they are, and later consider showing each gate as a summary of its related checks.
- **Releases, UAT, Risk, Dependencies, Decisions, Budget and Escalations.** No changes are needed for QMS.
- **Project type profiles.** N/A with a reason is enough for now. Revisit once the checklist has been used across more project types.
- **Automatic checks** such as "every WBS task has an ID and estimate". PM evidence is enough for the first version.
- **Syncing UAT sign-off** between P23 and the Release record.
- **Dollar CPI.** The portal's calculation stays as it is. R7 links to the existing CPI sheet.

## 11. Decisions

| # | Decision | Outcome |
|---|---|---|
| 1 | Move the PM checklist to lifecycle stages | Approved |
| 2 | Approve the 43-item PM list, including the merges | Approved |
| 3 | Hide QMS Audit from CLIENT and LIMITED | Approved |
| 4 | Flag recurring work as overdue | Rejected: no overdue control or time limits |

**Inputs still needed from the QMS manager:**

- **Criteria marked N/A:** the CSV's Status column is empty, so this plan treats all 45 as required.
- **Other tabs:** whether tabs such as T&M must also be supported. If so, add a contract type to the criteria list and to projects.
- **TD list:** whether a separate company list exists (section 4).
- **CPI evidence:** whether a link to the CPI sheet is accepted as CPI evidence (R7).
