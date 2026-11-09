import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { SubNav } from "@/components/ui/sub-nav";
import { StatTile } from "@/components/ui/stat-tile";
import { ProgressRing } from "@/components/ui/progress-ring";
import { IconAlertCircle, IconCircle, IconExternalLink, IconTarget } from "@/components/layout/icons";
import { getCurrentUser, requireModuleAccess } from "@/lib/rbac";
import { CHECKLIST_TYPE_BY_KEY, type ChecklistType } from "@/lib/checklist-types";
import { checklistSubNavOptions } from "@/lib/checklist-nav";
import { formatDate, formatPct } from "@/lib/format";
import { canViewQms, QMS_STATUS_LABEL, type QmsCriterionResult, type QmsReport, type QmsSource, type QmsStatus } from "@/lib/qms";
import { QMS_STAGES, QMS_TOPICS, type QmsTopic } from "@/lib/qms-criteria";
import { loadQmsReport } from "@/lib/qms-data";

export const dynamic = "force-dynamic";

const STATUS_CLASS: Record<QmsStatus, string> = {
  DONE: "bg-emerald-50 text-emerald-700",
  EVIDENCE_MISSING: "bg-amber-50 text-amber-800",
  IN_PROGRESS: "bg-blue-50 text-blue-700",
  NOT_STARTED: "bg-slate-100 text-slate-600",
  NOT_APPLICABLE: "bg-slate-100 text-slate-500",
  NOT_LINKED: "bg-rose-50 text-rose-700",
};

/** Where a source is edited: QMS itself is read-only, so every row points back to the work. */
function sourceHref(projectId: string, origin: string): string {
  if (origin === "CR") return `/projects/${projectId}/change-requests`;
  const config = CHECKLIST_TYPE_BY_KEY[origin as ChecklistType];
  if (!config) return `/projects/${projectId}/checklist/pm`;
  return config.inGeneralChecklistNav ? `/projects/${projectId}/checklist/${config.routeSegment}` : `/projects/${projectId}/delivery/checklist`;
}

function StatusPill({ status }: { status: QmsStatus }) {
  return <span className={clsx("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_CLASS[status])}>{QMS_STATUS_LABEL[status]}</span>;
}

function Source({ projectId, source }: { projectId: string; source: QmsSource }) {
  const [latest, ...older] = source.links;
  const when = source.logCount != null ? `${source.logCount} log${source.logCount === 1 ? "" : "s"}` : null;
  return (
    <div className="min-w-0">
      <Link href={sourceHref(projectId, source.origin)} prefetch={false} className="text-xs font-medium text-slate-700 hover:text-indigo-700 hover:underline">
        {source.title}
      </Link>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
        {latest && (
          <a href={latest.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline">
            <IconExternalLink className="h-3 w-3" />
            {source.logCount != null ? "Open latest" : "Open evidence"}
          </a>
        )}
        {source.ownerName && <span>{source.ownerName}</span>}
        {when && <span>{when}</span>}
        {source.date && <span>{source.logCount != null ? `last on ${formatDate(source.date)}` : formatDate(source.date)}</span>}
      </div>
      {source.note && <p className={clsx("mt-0.5 text-[11px]", source.status === "EVIDENCE_MISSING" ? "text-amber-700" : "text-slate-500")}>{source.note}</p>}
      {older.length > 0 && (
        <details className="mt-0.5 text-[11px] text-slate-500">
          <summary className="cursor-pointer select-none hover:text-slate-700">Earlier logs ({older.length})</summary>
          <ul className="mt-0.5 space-y-0.5">
            {older.map((l, i) => (
              <li key={`${l.href}-${i}`}>
                <a href={l.href} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                  {formatDate(l.date)}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function CriterionRow({ projectId, result }: { projectId: string; result: QmsCriterionResult }) {
  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="px-4 py-3">
        <p className="text-sm text-slate-900">{result.text}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">Expected evidence: {result.evidence}</p>
      </td>
      <td className="px-3 py-3">
        <StatusPill status={result.status} />
      </td>
      <td className="px-3 py-3">
        <div className="space-y-2">
          {result.sources.map((s) => (
            <Source key={s.key} projectId={projectId} source={s} />
          ))}
          {result.note && <p className="text-[11px] text-slate-500">{result.note}</p>}
        </div>
      </td>
    </tr>
  );
}

function TopicCard({ projectId, topic, report }: { projectId: string; topic: QmsTopic; report: QmsReport }) {
  const results = topic.rows.flatMap((r) => (r.criterion ? [report.byId[r.criterion.id]] : []));
  const applicable = results.filter((r) => r.status !== "NOT_APPLICABLE");
  const done = applicable.filter((r) => r.status === "DONE").length;
  const steps = topic.rows.flatMap((r) => (r.step ? [r.step] : []));

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <h4 className="text-sm font-bold text-slate-900">{topic.topic}</h4>
        <span className={clsx("shrink-0 text-xs", applicable.length > 0 && done === applicable.length ? "font-medium text-emerald-700" : "text-slate-500")}>
          {applicable.length > 0 ? `${done} of ${applicable.length} done` : "N/A"}
        </span>
      </div>
      <div className="overflow-x-auto border-t border-slate-100">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500">
              <th className="px-4 py-2">Acceptance criteria</th>
              <th className="w-36 px-3 py-2">Status</th>
              <th className="w-[46%] px-3 py-2">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <CriterionRow key={r.id} projectId={projectId} result={r} />
            ))}
          </tbody>
        </table>
      </div>
      <details className="border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 text-xs text-slate-600">
        <summary className="cursor-pointer select-none font-medium text-slate-500 hover:text-slate-800">QMS process steps ({steps.length})</summary>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          {steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

// Read-only by design: every status here is derived from the checklists and the
// CR log (lib/qms.ts), so there's nothing to edit or tick on this page.
export default async function QmsAuditPage({ params }: { params: { projectId: string } }) {
  const [, user] = await Promise.all([requireModuleAccess(params.projectId, "PM_CHECKLIST", "READ_LIMITED"), getCurrentUser()]);
  if (!user || !canViewQms(user.role)) notFound();

  const [report, subNavOptions] = await Promise.all([loadQmsReport(params.projectId), checklistSubNavOptions(params.projectId)]);
  const s = report.summary;

  return (
    <div>
      <SubNav projectId={params.projectId} options={subNavOptions} />
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">QMS Audit</h2>
          <p className="text-sm text-slate-500">Fills itself in from the checklists and the CR log. Nothing is edited here: use each row&apos;s link to go to the work.</p>
        </div>
        <a href={`/api/projects/${params.projectId}/checklist/qms/export`} className="shrink-0 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Export .xlsx
        </a>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 sm:col-span-1">
          <ProgressRing pct={s.pct} size={52} stroke={6} />
          <div className="min-w-0">
            <p className="text-xs text-slate-500">QMS criteria done</p>
            <p className="text-lg font-bold leading-tight text-slate-900">{formatPct(s.pct)}</p>
            <p className="mt-0.5 text-[11px] leading-tight text-slate-400">
              {s.done} of {s.total}
              {s.notApplicable > 0 && ` · ${s.notApplicable} N/A`}
            </p>
          </div>
        </div>
        <StatTile
          icon={<IconAlertCircle />}
          iconWrapClass={s.evidenceMissing ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-500"}
          label="Evidence missing"
          value={String(s.evidenceMissing)}
          subtitle="done, but needs owner, date or link"
        />
        <StatTile icon={<IconTarget />} iconWrapClass="bg-blue-50 text-blue-600" label="In progress" value={String(s.inProgress)} />
        <StatTile icon={<IconCircle />} iconWrapClass="bg-slate-100 text-slate-500" label="Not started" value={String(s.notStarted)} />
      </div>

      <div className="space-y-6">
        {QMS_STAGES.map((stage) => (
          <section key={stage} className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{stage}</h3>
            {QMS_TOPICS.filter((t) => t.stage === stage).map((topic) => (
              <TopicCard key={topic.topic} projectId={params.projectId} topic={topic} report={report} />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
