// The QMS Audit Checklist (Fixed Budget tab), row for row, so the QMS Audit tab
// and its Excel export keep the sheet's order and layout. Wording is the sheet's,
// with spelling corrected ("Spring Review", "cremoney", "Maintainance"). A new
// QMS version is a change here plus a template migration. The `evidence` hint is
// the portal's addition; everything else is the QMS manager's.

export type QmsCriterion = { id: string; text: string; evidence: string };
export type QmsRow = { step: string | null; criterion: QmsCriterion | null };
export type QmsTopic = { stage: string; topic: string; rows: QmsRow[] };

const row = (step: string | null, id?: string, text?: string, evidence?: string): QmsRow => ({
  step,
  criterion: id && text && evidence ? { id, text, evidence } : null,
});

export const QMS_TOPICS: QmsTopic[] = [
  {
    stage: "Planning",
    topic: "Project Management Plan",
    rows: [
      row("Document collection - RFP, Proposal, Contract/PO, Project initiation email from client", "Q1", "MS team creation for the project + project repository at SharePoint", "Teams or SharePoint link"),
      row("Prepare documents repository and group at MS Team and SharePoint", "Q2", "All the project docs including pre-sales docs are stored at project repository", "Repository folder"),
      row("Set up agile board and git repository", "Q3", "PM board and git repository creation", "Board link and repository link"),
      row("Prepare project management plan document", "Q4", "Project plan document creation", "PM Plan document"),
      row("The planning phase should not be more than 1-3 weeks long. It should be a short plan.", "Q5", "Project estimation and delivery timeline", "Estimation sheet"),
      row("Plan may fail, but planning should be ensured."),
    ],
  },
  {
    stage: "Planning",
    topic: "Development Estimation",
    rows: [
      row("Estimation should be in story points. 1 story point = 1 man day; avoid using t-shirt sizing or hours.", "Q6", "Estimation from development team in story point 1=1 man day", "Estimation sheet"),
      row("Prepare milestones, release plans, and specify which epics will be included in each sprint. Update the estimation sheet accordingly. Milestones should preferably span around 1 month each.", "Q7", "Product backlog, milestone and release planning", "Backlog or plan"),
      row(null, "Q8", "Notify line manager, if there is major deviation between sales proposal estimation and development estimation", "Email, or a note that there was no deviation"),
      row("If the development team's estimate exceeds the sales proposal, inform your manager. Strive to stay within the estimated range, as project success depends on accurate estimations."),
    ],
  },
  {
    stage: "Planning",
    topic: "WBS",
    rows: [
      row("Comprehensive list of Epics with estimation and WBS ID (obtained may be from the proposal & contract along with RFP).", "Q9", "This should be kept in a tabular format, such as: Excel", "WBS sheet or Tasks export"),
      row("Emphasizing that Epics represent a high-level overview, it is essential that the list is all-encompassing and exhaustive.", "Q10", 'Must include "ID" for tracing', "WBS sheet or Tasks export"),
      row("From WBS epics are taken to PM tools, such as: Jira.", "Q11", "Include estimation", "WBS sheet or Tasks export"),
    ],
  },
  {
    stage: "Planning",
    topic: "Sprint Backlog and SRS",
    rows: [
      row("Rolling Wave Planning - Breaking down details before development is challenging. We can decompose features into stories for at least two sprints, ensuring we always have two sprints' worth of detailed breakdowns available, except for the final sprint and project closure.", "Q12", "A version of sprint backlog or SRS", "SRS or backlog document"),
      row("It contains user stories with some details & assumptions, screenshots, etc. Verify the detail understanding with UI design and obtain signoff/acknowledgement from the client.", "Q13", "Signoff/acknowledgement from the client", "Email or screenshot"),
      row("Too much detail is not required if the customer does not want it."),
      row("If we need to prepare SRS, we can simply export from this Excel or PM tool."),
    ],
  },
  {
    stage: "Planning",
    topic: "Project Kick-off",
    rows: [
      row("Team, client, and sales/account manager should celebrate together, be it a small or large gathering. Options include a burger party or restaurant outing. At least online meetings should be held.", "Q14", "Kick off celebration evidence", "Photo, recording or invite"),
      row('Preferably share SRS with estimation. We will try to sign off, but sign offs should not delay the project. Sharing is important. Sharing "this is my primary plan." Shared plan may have buffer.', "Q15", "Final documents are uploaded at project's repository", "Repository folder"),
      row("Kick off should have client present."),
      row("Review and update payment terms and schedule."),
      row("Upload all these final documents to the project's repository."),
    ],
  },
  {
    stage: "Development",
    topic: "Backlog Refinement",
    rows: [
      row("Refinement meeting with the team, TL, and preferably client", "Q16", "Backlog refinement meeting", "Meeting notes"),
      row("Identify the most critical items for the client, prioritize the backlog, discuss, and share concerns.", "Q17", "Alignment with client", "Meeting notes"),
      row("Top priority items need to be detailed written for the development. During sprint, before backlog refinement meeting, business analyst or someone would be detailing out the stories and trying to get sign off the requirements for this sprint (sign off not required, it should not delay the project, but we will request sign off or acknowledgement in email). Detail all the stories for the next 1+ sprints. Ensure ahead of time for design and all blockers resolved", "Q18", "Signoff/acknowledgement from the client", "Email or screenshot"),
      row("If you don't already have a comprehensive Product Backlog/WBS with estimation, ensure that you do it now. If you haven't already, then create a milestone with sprints for when the total items will be delivered, approximately."),
      row("If any Change Requests (CR) come, they should be added in WBS/PM Tool and signed"),
    ],
  },
  {
    stage: "Development",
    topic: "Sprint Planning",
    rows: [
      row("Sprint backlog to be created from the product backlog refined board"),
      row("Tasks created, estimated, and assigned to people.", "Q19", "Tasks created, estimated, and assigned to people.", "Sprint board or SRS Sprint PDF"),
      row("Preferably in the presence of the customer Product Owner."),
      row("After sprint planning, updated list of items with details in PDF format to send to client."),
      row('Requirements are finalized for the sprint during sprint planning meeting. Requirements details eg. "SRS Sprint 1" is sent to client in PDF over email with all the WBS items and the details.', "Q20", "Customer sign off of the sprint board task list", "Email or screenshot"),
      row("Keep minimum 5% time for updating and maintaining documentation"),
    ],
  },
  {
    stage: "Development",
    topic: "Daily Scrum",
    rows: [
      row("Ensure daily time entry in PM tools (E.g., Jira), Daily Standup (DS) and submit the PM Scrum", "Q21", "Input - Sprint task list, What did yesterday, Time spent, What will do today", "Scrum file"),
      row("Guideline and Sample: Values - Agility & Excellence.docx", "Q22", "Upload PM Scrum File at ERP", "Scrum file"),
      row(null, "Q23", "Ensure PM clock entry", "Scrum file"),
    ],
  },
  {
    stage: "Development",
    topic: "Sprint Review",
    rows: [
      row("Do sprint review, where demo the items done, may be in local machine, preferably record the demo. Preferably try to take UAT signoff for the delivered agreed upon items.", "Q24", "Update CPI report. It should have costs incurred till now and estimated man days of work delivered.", "CPI sheet"),
      row("If any bugs are found, then input it in the estimation sheet under the relevant WBS item.", "Q25", "Engage client at the meeting, if not possible send the update", "Recording or email"),
      row("After the meeting, email feedback to the internal team and, if involved, the customer. Preferably include delivered epics/stories and a screen recording of sprint features.", "Q26", "List the improvement and bugs with estimation", "Review notes"),
      row("Keep your eyes on the burndown chart.", "Q27", "Update the DONE item in WBS.", "WBS or Tasks export"),
    ],
  },
  {
    stage: "Development",
    topic: "Sprint Retrospective",
    rows: [
      row("Maintain excel or any tool.", "Q28", "Ensure retrospective at planned interval", "Retro notes"),
      row("Team takes the judgement to decide frequency of retrospective based on sprint length. However, execute retro every month at least once, preferably twice.", "Q29", "Plan improvement tasks from feedback", "Retro notes"),
      row("Work on the findings"),
    ],
  },
  {
    stage: "Development",
    topic: "Progress Tracking",
    rows: [
      row("Execute update meetings with all stakeholders 2 times a month or, minimum once a month.", "Q30", "Weekly Project Update Report - Uploaded at ERP", "Report"),
      row("Create weekly status update document and upload in ERP>Projects>Settings>Project Progress Sheet.", "Q31", "CPI result", "CPI sheet"),
      row("Present status update, with stakeholders, including account manager/sales.", "Q32", "Update meeting with stakeholder evidence", "Notes or invite"),
    ],
  },
  {
    stage: "Development",
    topic: "Change Request (CR) Management",
    rows: [
      row("When a customer asks for a CR, write it down in detail, follow guided samples of CRs. Preferably review this CR document with the customer.", "Q33", "CR document with customer approval", "CR document link on the CR log"),
      row("Generally, get signed if there is no risk (if our team is idle, then proceed development, otherwise without sign preferably do not start).", "Q34", "Updated product backlog with CR items", "WBS Updated = Yes on the CR log"),
      row("Use your judgment, give CR paid/free/exchange, and clearly communicate the timeline effect."),
      row("Update Product Backlog (WBS) when a CR is confirmed."),
      row("Maintain a list of CRs in an excel file with CR title, man days planned, billable man days."),
    ],
  },
  {
    stage: "Development",
    topic: "Release",
    rows: [
      row("Deploy in UAT if the release candidates are developed and sprint reviewed.", "Q35", "Completion and release report", "Report"),
      row("Perform smoke test in UAT and resolve issues."),
      row("Perform a security vulnerability assessment on critical business workflows using tools such as ZAP, MobSF etc.", "Q36", "Vulnerability assessment result", "ZAP or MobSF report"),
      row("Send a Completion and release report to stakeholders."),
      row("If any item is not fully complete, break it down in WBS and get confirmation of partial item."),
      row("For business-critical deployments, such as legacy data migration, prepare a comprehensive deployment checklist. If the client possesses technical expertise, ensure the checklist is reviewed and validated by the client.", "Q37", "Deployment checklist", "Checklist or runbook"),
      row("UAT sign-off - Without UAT sign off, most of the time, do not deploy in client UAT server or live environment. If sign-off becomes an impediment, email the UAT document and inform via phone call. Request a response via email.", "Q38", "Customer sign off or email approval", "Email or screenshot"),
      row("After finalization of UAT testing, deployment will be done in production environment. The production deployment date time decided with consultation with the client's contact person.", "Q39", "Production deployment", "Deployment record"),
      row("Execute a ceremony with client for the release.", "Q40", "Release ceremony with client", "Photo, recording or invite"),
      row("Update milestones if needed."),
      row("Discuss and finalize if any maintenance should kick in."),
    ],
  },
  {
    stage: "Closing and Maintenance",
    topic: "Project Closing and Maintenance",
    rows: [
      row("Deploy in Production after UAT sign-off/consents given by client and Payments are made as contract.", "Q41", "Project closure report", "Report"),
      row("Perform smoke test in Prod, inform stakeholders and resolve issues."),
      row("Send Project Closure Report."),
      row("Celebrate the project completion with client, publish internally and externally if there is no NDA.", "Q42", "Celebration with client", "Photo or post"),
      row("Take formal completion certificates.", "Q43", "Completion certificate", "Certificate"),
      row("Conduct customer satisfaction surveys.", "Q44", "Customer feedback", "Survey result"),
      row("Support and AMC starts in all payments are made as contract."),
      row("Provide Knowledge Transfer (KT) and learning materials:", "Q45", "Upload KT and TD at project repository", "Repository folders"),
      row("Video demo, small documentation for Domain expertise - for marketing and functional experts."),
      row("Technical documentation and Video demo for technical maintenance."),
    ],
  },
];

export const QMS_STAGES = Array.from(new Set(QMS_TOPICS.map((t) => t.stage)));

export const QMS_CRITERIA: QmsCriterion[] = QMS_TOPICS.flatMap((t) => t.rows.flatMap((r) => (r.criterion ? [r.criterion] : [])));

export const QMS_CRITERION_BY_ID: Record<string, QmsCriterion> = Object.fromEntries(QMS_CRITERIA.map((c) => [c.id, c]));

/** Criteria answered by the CR log rather than a checklist item. */
export const QMS_CR_CRITERIA = { document: "Q33", backlog: "Q34" } as const;
