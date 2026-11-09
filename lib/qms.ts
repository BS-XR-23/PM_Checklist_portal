// Pure, DB-free rules for the QMS Audit tab. QMS status is always derived from
// the work (docs/QMS_PLAN.md §2): nobody edits it, so these functions are the only
// place it's decided, and the checklist badge, the tab and the export can't disagree.

import type { Role } from "@prisma/client";
import { safeHref } from "@/lib/checklist";
import { QMS_CRITERIA, QMS_CR_CRITERIA, QMS_TOPICS, type QmsCriterion } from "@/lib/qms-criteria";

export type QmsStatus = "NOT_STARTED" | "IN_PROGRESS" | "EVIDENCE_MISSING" | "DONE" | "NOT_APPLICABLE" | "NOT_LINKED";

export const QMS_STATUS_LABEL: Record<QmsStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  EVIDENCE_MISSING: "Evidence missing",
  DONE: "Done",
  NOT_APPLICABLE: "N/A",
  NOT_LINKED: "Not linked",
};

/** QMS shows internal evidence links, so it's for the delivery organisation only. */
export function canViewQms(role: Role): boolean {
  return role === "ADMIN" || role === "TPM" || role === "PROGRAM_MANAGER" || role === "PM";
}

export type QmsItem = {
  id: string;
  type: string;
  itemText: string;
  status: string;
  isRecurring: boolean;
  link: string | null;
  actualDate: Date | null;
  ownerName: string | null;
  notes: string | null;
  qmsRefs: string[];
  occurrences: { date: Date; link: string }[];
};

export type QmsCr = {
  crCode: string;
  title: string;
  status: string;
  clientSignoff: string;
  wbsUpdated: string;
  documentLink: string | null;
};

const hasText = (v: string | null | undefined) => !!v && v.trim() !== "";

/** What a completed one-time item still needs before it counts for QMS. */
export function missingQmsEvidence(i: Pick<QmsItem, "ownerName" | "actualDate" | "link">): string[] {
  return [!hasText(i.ownerName) && "owner", !i.actualDate && "actual date", !safeHref(i.link) && "link"].filter(Boolean) as string[];
}

export function qmsItemStatus(i: Pick<QmsItem, "status" | "isRecurring" | "ownerName" | "actualDate" | "link" | "notes" | "occurrences">): QmsStatus {
  if (i.status === "NOT_APPLICABLE") return hasText(i.notes) ? "NOT_APPLICABLE" : "EVIDENCE_MISSING";
  if (i.isRecurring) return i.occurrences.some((o) => safeHref(o.link)) ? "DONE" : "NOT_STARTED";
  if (i.status === "NOT_STARTED") return "NOT_STARTED";
  if (i.status !== "COMPLETED") return "IN_PROGRESS";
  return missingQmsEvidence(i).length === 0 ? "DONE" : "EVIDENCE_MISSING";
}

/** Several sources behind one criterion: N/A ones drop out, the rest must all be done. */
export function combineQmsStatuses(statuses: QmsStatus[]): QmsStatus {
  if (statuses.length === 0) return "NOT_LINKED";
  const applicable = statuses.filter((s) => s !== "NOT_APPLICABLE");
  if (applicable.length === 0) return "NOT_APPLICABLE";
  if (applicable.every((s) => s === "DONE")) return "DONE";
  if (applicable.every((s) => s === "DONE" || s === "EVIDENCE_MISSING")) return "EVIDENCE_MISSING";
  return applicable.every((s) => s === "NOT_STARTED") ? "NOT_STARTED" : "IN_PROGRESS";
}

export type QmsSource = {
  key: string;
  title: string;
  /** Checklist type of the item, or "CR" for the change request log. */
  origin: string;
  status: QmsStatus;
  ownerName: string | null;
  date: Date | null;
  links: { href: string; date: Date | null }[];
  logCount: number | null;
  note: string | null;
};

export type QmsCriterionResult = QmsCriterion & { status: QmsStatus; sources: QmsSource[]; note: string | null };

export type QmsSummary = { total: number; done: number; pct: number; evidenceMissing: number; inProgress: number; notStarted: number; notApplicable: number };

export type QmsReport = { byId: Record<string, QmsCriterionResult>; summary: QmsSummary };

function itemSource(i: QmsItem): QmsSource {
  const status = qmsItemStatus(i);
  const logs = [...i.occurrences].sort((a, b) => b.date.getTime() - a.date.getTime());
  const links = i.isRecurring
    ? logs.flatMap((o) => {
        const href = safeHref(o.link);
        return href ? [{ href, date: o.date }] : [];
      })
    : (() => {
        const href = safeHref(i.link);
        return href ? [{ href, date: i.actualDate }] : [];
      })();
  const missing = status === "EVIDENCE_MISSING" && !i.isRecurring && i.status !== "NOT_APPLICABLE" ? `Needs: ${missingQmsEvidence(i).join(", ")}` : null;
  const note =
    i.status === "NOT_APPLICABLE"
      ? hasText(i.notes)
        ? `N/A: ${i.notes!.trim()}`
        : "Marked N/A with no reason. Add one in the item's notes."
      : missing;
  return {
    key: i.id,
    title: i.itemText,
    origin: i.type,
    status,
    ownerName: i.ownerName,
    date: i.isRecurring ? (logs[0]?.date ?? null) : i.actualDate,
    links,
    logCount: i.isRecurring ? logs.length : null,
    note,
  };
}

const AGREED_CR_STATUSES = ["Approved", "In Progress", "Completed"];

function crDocumentStatus(c: QmsCr): QmsStatus {
  if (c.clientSignoff === "Pending") return "IN_PROGRESS";
  return safeHref(c.documentLink) ? "DONE" : "EVIDENCE_MISSING";
}

function crSource(c: QmsCr, kind: "document" | "backlog"): QmsSource {
  const href = safeHref(c.documentLink);
  const status = kind === "document" ? crDocumentStatus(c) : c.wbsUpdated === "Yes" ? "DONE" : "IN_PROGRESS";
  return {
    key: `${c.crCode}-${kind}`,
    title: `${c.crCode} ${c.title}`,
    origin: "CR",
    status,
    ownerName: null,
    date: null,
    links: kind === "document" && href ? [{ href, date: null }] : [],
    logCount: null,
    note: kind === "document" ? `Client sign-off: ${c.clientSignoff}` : `WBS updated: ${c.wbsUpdated}`,
  };
}

export function buildQmsReport(items: QmsItem[], crs: QmsCr[]): QmsReport {
  const agreed = crs.filter((c) => AGREED_CR_STATUSES.includes(c.status));
  const byId: Record<string, QmsCriterionResult> = {};

  for (const criterion of QMS_CRITERIA) {
    const isCr = criterion.id === QMS_CR_CRITERIA.document || criterion.id === QMS_CR_CRITERIA.backlog;
    if (isCr && agreed.length === 0) {
      byId[criterion.id] = { ...criterion, status: "NOT_APPLICABLE", sources: [], note: "No agreed change requests." };
      continue;
    }
    const sources = isCr
      ? agreed.map((c) => crSource(c, criterion.id === QMS_CR_CRITERIA.document ? "document" : "backlog"))
      : items.filter((i) => i.qmsRefs.includes(criterion.id)).map(itemSource);
    const status = combineQmsStatuses(sources.map((s) => s.status));
    byId[criterion.id] = { ...criterion, status, sources, note: status === "NOT_LINKED" ? "No checklist item answers this on this project." : null };
  }

  const results = Object.values(byId);
  const count = (s: QmsStatus) => results.filter((r) => r.status === s).length;
  const notApplicable = count("NOT_APPLICABLE");
  const total = results.length - notApplicable;
  const done = count("DONE");
  return {
    byId,
    summary: {
      total,
      done,
      pct: total ? done / total : 0,
      evidenceMissing: count("EVIDENCE_MISSING"),
      inProgress: count("IN_PROGRESS"),
      notStarted: count("NOT_STARTED") + count("NOT_LINKED"),
      notApplicable,
    },
  };
}

function exportComment(r: QmsCriterionResult, formatDate: (d: Date | null) => string): string {
  const parts = r.sources.map((s) => {
    const when = s.logCount != null ? `${s.logCount} log${s.logCount === 1 ? "" : "s"}${s.date ? `, last on ${formatDate(s.date)}` : ""}` : s.date ? formatDate(s.date) : null;
    return [s.title, s.ownerName, when, s.note].filter(Boolean).join(" | ");
  });
  if (r.note) parts.push(r.note);
  return parts.join("\n");
}

/** The QMS sheet's columns and row order, ready for buildXlsxBuffer. */
export function qmsSheetRows(report: QmsReport, formatDate: (d: Date | null) => string): Record<string, string>[] {
  let lastStage = "";
  return QMS_TOPICS.flatMap((t) =>
    t.rows.map((row, idx) => {
      const r = row.criterion ? report.byId[row.criterion.id] : null;
      const stage = t.stage !== lastStage ? t.stage : "";
      lastStage = t.stage;
      return {
        Stage: stage,
        Topic: idx === 0 ? t.topic : "",
        Details: row.step ?? "",
        "Acceptance Criteria": row.criterion?.text ?? "",
        Status: r ? QMS_STATUS_LABEL[r.status] : "",
        "Evidence Link": r ? r.sources.flatMap((s) => s.links.map((l) => l.href)).join("\n") : "",
        Comments: r ? exportComment(r, formatDate) : "",
      };
    })
  );
}
