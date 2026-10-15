"use client";

import { useState, useTransition } from "react";
import clsx from "clsx";
import { InlineSelect, InlineDate } from "@/components/ui/inline-edit";
import { avatarColorFromString } from "@/lib/colors";
import { formatDate, initials } from "@/lib/format";
import { updateEngagement, removeEngagement } from "./resourcing-actions";

export type RosterRow = {
  id: string;
  personName: string;
  roleOnProject: string;
  startDate: string | null; // yyyy-mm-dd
  endDate: string | null;
  status: "current" | "upcoming" | "ended";
  endsInDays: number | null; // current rows ending within a week
};

/**
 * Who's on the project, for reference — grouped into now / starting later /
 * ended. Rows are text; "Edit" opens role and dates for that one person.
 */
export function RosterList({ projectId, rows, canEdit, roleOptions }: { projectId: string; rows: RosterRow[]; canEdit: boolean; roleOptions: string[] }) {
  const [showEnded, setShowEnded] = useState(false);
  const current = rows.filter((r) => r.status === "current");
  const upcoming = rows.filter((r) => r.status === "upcoming");
  const ended = rows.filter((r) => r.status === "ended");

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
        No one is on this project yet.{canEdit ? " Add the first person above." : ""}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <Group title="On the project" count={current.length} empty="No one is on the project right now.">
        {current.map((r) => (
          <Row key={r.id} projectId={projectId} row={r} canEdit={canEdit} roleOptions={roleOptions} />
        ))}
      </Group>
      {upcoming.length > 0 && (
        <Group title="Starting later" count={upcoming.length}>
          {upcoming.map((r) => (
            <Row key={r.id} projectId={projectId} row={r} canEdit={canEdit} roleOptions={roleOptions} />
          ))}
        </Group>
      )}
      {ended.length > 0 && (
        <div className="border-t border-slate-100">
          <button type="button" onClick={() => setShowEnded((v) => !v)} className="w-full px-4 py-2.5 text-left text-xs font-medium text-slate-500 hover:text-slate-800">
            {showEnded ? "▾" : "▸"} {ended.length} no longer on the project
          </button>
          {showEnded && (
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {ended.map((r) => (
                <Row key={r.id} projectId={projectId} row={r} canEdit={canEdit} roleOptions={roleOptions} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Group({ title, count, empty, children }: { title: string; count: number; empty?: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-100 first:border-t-0">
      <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {title} · {count}
      </p>
      {count === 0 && empty ? <p className="px-4 pb-3 text-sm text-slate-400">{empty}</p> : <ul className="divide-y divide-slate-100">{children}</ul>}
    </div>
  );
}

function dateRange(row: RosterRow): string {
  if (!row.startDate && !row.endDate) return "No dates set";
  if (row.status === "upcoming" && row.startDate) return `Starts ${formatDate(row.startDate + "T00:00:00")}${row.endDate ? ` · until ${formatDate(row.endDate + "T00:00:00")}` : ""}`;
  if (row.status === "ended" && row.endDate) return `Ended ${formatDate(row.endDate + "T00:00:00")}`;
  const from = row.startDate ? `Since ${formatDate(row.startDate + "T00:00:00")}` : "";
  const to = row.endDate ? `until ${formatDate(row.endDate + "T00:00:00")}` : "ongoing";
  return from ? `${from} · ${to}` : to.charAt(0).toUpperCase() + to.slice(1);
}

function Row({ projectId, row, canEdit, roleOptions }: { projectId: string; row: RosterRow; canEdit: boolean; roleOptions: string[] }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  // A legacy role that isn't in the registry's title list still has to be
  // offered, or the select would silently show (and save) the first option.
  const roles = roleOptions.includes(row.roleOnProject) ? roleOptions : [row.roleOnProject, ...roleOptions];

  return (
    <li className={clsx("px-4 py-3", pending && "opacity-60", row.status === "ended" && !editing && "opacity-70")}>
      <div className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ backgroundColor: avatarColorFromString(row.personName) }}
        >
          {initials(row.personName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <p className="text-sm font-semibold text-slate-800">{row.personName}</p>
            <p className="text-sm text-slate-600">{row.roleOnProject}</p>
          </div>
          <p className="text-xs text-slate-500">
            {dateRange(row)}
            {row.endsInDays != null && (
              <span className="ml-1.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700">
                {row.endsInDays === 0 ? "last day today" : `ends in ${row.endsInDays} day${row.endsInDays === 1 ? "" : "s"}`}
              </span>
            )}
          </p>
        </div>
        {canEdit && (
          <button type="button" onClick={() => setEditing((v) => !v)} className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-700">
            {editing ? "Done" : "Edit"}
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-2.5 ml-12 grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-0.5 block text-[11px] text-slate-500">Role on this project</span>
            <InlineSelect value={row.roleOnProject} options={roles} onSave={(v) => updateEngagement(row.id, projectId, { roleOnProject: v })} />
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[11px] text-slate-500">Start</span>
            <InlineDate value={row.startDate} onSave={(v) => updateEngagement(row.id, projectId, { startDate: v })} />
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[11px] text-slate-500">End (leave empty if ongoing)</span>
            <InlineDate value={row.endDate} onSave={(v) => updateEngagement(row.id, projectId, { endDate: v })} />
          </label>
          <div className="sm:col-span-3">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!window.confirm(`Remove ${row.personName} from this project's team? Tasks already assigned to them keep their name. To keep a record, set an end date instead.`)) return;
                startTransition(() => removeEngagement(row.id, projectId));
              }}
              className="text-xs font-medium text-rose-600 hover:text-rose-700"
            >
              Remove from project
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
