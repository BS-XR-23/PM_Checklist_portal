import { formatDateTime, initials } from "@/lib/format";
import { avatarColorFromString, tagPillStyle, AUDIT_ACTION_COLORS, DEFAULT_AUDIT_ACTION_COLOR } from "@/lib/colors";
import { ROLE_LABELS } from "@/lib/constants";
import { IconChevronDown, IconClipboardList } from "@/components/layout/icons";
import type { Role } from "@prisma/client";

export type AuditLogRow = {
  id: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  summary: string;
  isOverride: boolean;
  createdAt: Date;
  projectName?: string;
  diff?: unknown;
};

type DiffShape = { before?: Record<string, unknown> | null; changes?: Record<string, unknown> | null };

function formatDiffValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") {
    const s = JSON.stringify(v);
    return s.length > 100 ? `${s.slice(0, 100)}…` : s;
  }
  return String(v);
}

/** Custom disclosure chevron in place of the default <details> marker, purely CSS-driven (no client JS needed for a rotate-on-open). */
function DiffSummary({ children }: { children: React.ReactNode }) {
  return (
    <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 [&::-webkit-details-marker]:hidden">
      <IconChevronDown className="h-3 w-3 shrink-0 transition-transform group-open:rotate-180" />
      {children}
    </summary>
  );
}

/**
 * Every writeAudit() call site passes diff as either {before, changes}
 * (update), {before} (delete), or omits it entirely (create/role-change,
 * where the summary string already says everything). Render whichever
 * shape shows up rather than assuming one.
 */
function DiffDetails({ diff }: { diff: unknown }) {
  if (!diff || typeof diff !== "object") return null;
  const { before, changes } = diff as DiffShape;

  if (changes && Object.keys(changes).length > 0) {
    const keys = Object.keys(changes);
    return (
      <details className="group mt-1.5">
        <DiffSummary>View changes ({keys.length})</DiffSummary>
        <table className="mt-1.5 w-full text-xs border border-slate-100 rounded overflow-hidden">
          <tbody>
            {keys.map((k) => (
              <tr key={k} className="border-t border-slate-100 first:border-t-0">
                <td className="px-2 py-1 font-medium text-slate-500 bg-slate-50 whitespace-nowrap align-top">{k}</td>
                <td className="px-2 py-1 text-slate-400 align-top">{before ? formatDiffValue(before[k]) : "—"}</td>
                <td className="px-1 py-1 text-slate-300 align-top">→</td>
                <td className="px-2 py-1 text-slate-700 align-top">{formatDiffValue(changes[k])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    );
  }

  if (before && Object.keys(before).length > 0) {
    const keys = Object.keys(before);
    return (
      <details className="group mt-1.5">
        <DiffSummary>View deleted record</DiffSummary>
        <table className="mt-1.5 w-full text-xs border border-slate-100 rounded overflow-hidden">
          <tbody>
            {keys.map((k) => (
              <tr key={k} className="border-t border-slate-100 first:border-t-0">
                <td className="px-2 py-1 font-medium text-slate-500 bg-slate-50 whitespace-nowrap align-top">{k}</td>
                <td className="px-2 py-1 text-slate-700 align-top">{formatDiffValue(before[k])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    );
  }

  return null;
}

function ActionPill({ action }: { action: string }) {
  const style = AUDIT_ACTION_COLORS[action] ?? DEFAULT_AUDIT_ACTION_COLOR;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize whitespace-nowrap"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {action.replace(/_/g, " ")}
    </span>
  );
}

function ProjectTag({ name }: { name: string }) {
  const style = tagPillStyle(name);
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {name}
    </span>
  );
}

function roleLabel(role: string): string {
  return ROLE_LABELS[role as Role] ?? role.replace(/_/g, " ");
}

/** "Today" / "Yesterday" / full date — rows arrive pre-sorted desc by createdAt, so consecutive same-day rows are already adjacent. */
function dayLabel(date: Date): string {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "short", day: "numeric" });
}

function groupByDay(rows: AuditLogRow[]): { label: string; rows: AuditLogRow[] }[] {
  const groups: { label: string; rows: AuditLogRow[] }[] = [];
  for (const r of rows) {
    const label = dayLabel(r.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.rows.push(r);
    else groups.push({ label, rows: [r] });
  }
  return groups;
}

export function AuditLogTable({ rows, showProject = false }: { rows: AuditLogRow[]; showProject?: boolean }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <IconClipboardList className="mx-auto h-8 w-8 text-slate-300 mb-2" />
        <p className="text-sm text-slate-400">No activity matches these filters.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {groupByDay(rows).map((group, gi) => (
        <div key={`${group.label}-${gi}`}>
          <div className="sticky top-0 z-10 flex items-baseline gap-2 border-b border-t border-slate-100 bg-slate-50/90 px-4 py-1.5 backdrop-blur-sm first:border-t-0">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{group.label}</span>
            <span className="text-[11px] text-slate-400">
              {group.rows.length} event{group.rows.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="divide-y divide-slate-50">
            {group.rows.map((r) => (
              <div key={r.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/60">
                <span
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                  style={{ backgroundColor: avatarColorFromString(r.actorName) }}
                >
                  {initials(r.actorName)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold text-slate-800">{r.actorName}</span>
                    <span className="text-xs text-slate-400">({roleLabel(r.actorRole)})</span>
                    <ActionPill action={r.action} />
                    <span className="text-xs text-slate-500">{r.entityType}</span>
                    {showProject && r.projectName && <ProjectTag name={r.projectName} />}
                    {r.isOverride && (
                      <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap">
                        Override
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 mt-0.5">{r.summary}</p>
                  <DiffDetails diff={r.diff} />
                </div>
                <span className="mt-0.5 shrink-0 text-xs text-slate-400 whitespace-nowrap">{formatDateTime(r.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
