"use client";

import { Fragment, useState } from "react";
import clsx from "clsx";
import { InlineText, InlineTextarea, InlineSelect, InlineDate } from "@/components/ui/inline-edit";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { IconCalendar, IconFileText, IconChevronDown } from "@/components/layout/icons";
import { DEPENDENCY_PRIORITIES, DEPENDENCY_STATUSES } from "@/lib/constants";
import { DEPENDENCY_PRIORITY_COLORS, DEPENDENCY_STATUS_COLORS, avatarColorFromString, tagPillStyle } from "@/lib/colors";
import { formatDate, toDateInputValue, initials } from "@/lib/format";
import { updateDependency, deleteDependency } from "./dependency-actions";

export type DependencyTableRow = {
  id: string;
  category: string | null;
  description: string;
  preferredFormat: string | null;
  responsible: string | null;
  priority: string;
  expectedDate: Date | null;
  status: string;
  notes: string | null;
};

const PAGE_SIZES = [10, 25, 50] as const;

export function DependencyTable({ projectId, canWrite, rows }: { projectId: string; canWrite: boolean; rows: DependencyTableRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(10);

  if (rows.length === 0) {
    return <p className="text-sm text-slate-400 rounded-xl border border-slate-200 bg-white p-4">No dependencies logged yet.</p>;
  }

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const clampedPage = Math.min(page, pageCount);
  const pageRows = rows.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[1200px]">
          <thead>
            <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide bg-slate-50">
              <th className="px-3 py-2.5 w-10">#</th>
              <th className="px-3 py-2.5 w-28">Category</th>
              <th className="px-3 py-2.5 min-w-[260px]">Item Description</th>
              <th className="px-3 py-2.5 w-36">Preferred Format</th>
              <th className="px-3 py-2.5 w-40">Responsible</th>
              <th className="px-3 py-2.5 w-24">Priority</th>
              <th className="px-3 py-2.5 w-32">Expected Date</th>
              <th className="px-3 py-2.5 w-28">Status</th>
              <th className="px-3 py-2.5 w-14">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((d, i) => {
              const priorityColor = DEPENDENCY_PRIORITY_COLORS[d.priority as keyof typeof DEPENDENCY_PRIORITY_COLORS] ?? DEPENDENCY_PRIORITY_COLORS.Medium;
              const statusColor = DEPENDENCY_STATUS_COLORS[d.status as keyof typeof DEPENDENCY_STATUS_COLORS] ?? DEPENDENCY_STATUS_COLORS.Due;
              const categoryColor = d.category ? tagPillStyle(d.category) : null;
              const expanded = expandedId === d.id;

              return (
                <Fragment key={d.id}>
                  <tr className="border-t border-slate-100 align-top hover:bg-slate-50/40">
                    <td className="px-3 py-3 text-xs text-slate-400">{(clampedPage - 1) * pageSize + i + 1}</td>

                    <td className="px-3 py-3">
                      {canWrite ? (
                        <InlineText value={d.category ?? ""} placeholder="—" onSave={(v) => updateDependency(d.id, projectId, { category: v })} />
                      ) : d.category && categoryColor ? (
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
                          style={{ backgroundColor: categoryColor.bg, color: categoryColor.text }}
                        >
                          {d.category}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      {canWrite ? (
                        <InlineTextarea value={d.description} onSave={(v) => updateDependency(d.id, projectId, { description: v })} />
                      ) : (
                        <p className="text-sm font-medium text-slate-900">{d.description}</p>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      {canWrite ? (
                        <InlineText
                          value={d.preferredFormat ?? ""}
                          placeholder="—"
                          onSave={(v) => updateDependency(d.id, projectId, { preferredFormat: v })}
                        />
                      ) : (
                        <span className="text-sm text-slate-600">{d.preferredFormat || "—"}</span>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                          style={{ backgroundColor: avatarColorFromString(d.responsible ?? "?") }}
                        >
                          {initials(d.responsible ?? "?")}
                        </span>
                        <div className="min-w-0 flex-1">
                          {canWrite ? (
                            <InlineText
                              value={d.responsible ?? ""}
                              placeholder="—"
                              onSave={(v) => updateDependency(d.id, projectId, { responsible: v })}
                            />
                          ) : (
                            <span className="text-sm text-slate-700 truncate block">{d.responsible || "—"}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-3">
                      {canWrite ? (
                        <InlineSelect
                          value={d.priority}
                          options={DEPENDENCY_PRIORITIES}
                          className="rounded-full px-2.5 py-1 text-xs font-medium border-0 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
                          style={{ backgroundColor: priorityColor.bg, color: priorityColor.text }}
                          onSave={(v) => updateDependency(d.id, projectId, { priority: v })}
                        />
                      ) : (
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
                          style={{ backgroundColor: priorityColor.bg, color: priorityColor.text }}
                        >
                          {d.priority}
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <IconCalendar className="h-3.5 w-3.5 shrink-0" />
                        {canWrite ? (
                          <InlineDate value={toDateInputValue(d.expectedDate)} onSave={(v) => updateDependency(d.id, projectId, { expectedDate: v })} />
                        ) : (
                          <span className="text-sm text-slate-600">{formatDate(d.expectedDate)}</span>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-3">
                      {canWrite ? (
                        <InlineSelect
                          value={d.status}
                          options={DEPENDENCY_STATUSES}
                          className="rounded-full px-2.5 py-1 text-xs font-medium border-0 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
                          style={{ backgroundColor: statusColor.bg, color: statusColor.text }}
                          onSave={(v) => updateDependency(d.id, projectId, { status: v })}
                        />
                      ) : (
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
                          style={{ backgroundColor: statusColor.bg, color: statusColor.text }}
                        >
                          {d.status}
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setExpandedId(expanded ? null : d.id)}
                          aria-label={expanded ? "Collapse details" : "Expand details"}
                          className="rounded p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                        >
                          <IconChevronDown className={clsx("h-3.5 w-3.5 transition-transform", expanded && "-rotate-180")} />
                        </button>
                        {canWrite && (
                          <RowActionsMenu
                            actions={[{ label: "Delete dependency", pendingLabel: "Deleting...", danger: true, onClick: () => deleteDependency(d.id, projectId) }]}
                          />
                        )}
                      </div>
                    </td>
                  </tr>

                  {expanded && (
                    <tr className="border-t border-slate-100 bg-slate-50/60">
                      <td colSpan={9} className="px-4 py-4">
                        <div className="flex items-start gap-2.5">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                            <IconFileText className="h-3.5 w-3.5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-700">Notes</p>
                            {canWrite ? (
                              <InlineTextarea value={d.notes ?? ""} placeholder="—" onSave={(v) => updateDependency(d.id, projectId, { notes: v })} />
                            ) : (
                              <p className="text-sm text-slate-600 mt-0.5">{d.notes || "—"}</p>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length > PAGE_SIZES[0] && (
        <div className="flex flex-wrap items-center justify-end gap-3 px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
          <span>
            Showing {(clampedPage - 1) * pageSize + 1} to {Math.min(clampedPage * pageSize, rows.length)} of {rows.length} dependencies
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((v) => Math.max(1, v - 1))}
              disabled={clampedPage <= 1}
              className="rounded-md border border-slate-200 px-2 py-1 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
            >
              ‹
            </button>
            {Array.from({ length: pageCount }, (_, idx) => idx + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                className={clsx("min-w-[1.75rem] rounded-md px-2 py-1", n === clampedPage ? "bg-indigo-600 text-white" : "border border-slate-200 text-slate-500 hover:bg-slate-50")}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((v) => Math.min(pageCount, v + 1))}
              disabled={clampedPage >= pageCount}
              className="rounded-md border border-slate-200 px-2 py-1 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
            >
              ›
            </button>
          </div>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value) as (typeof PAGE_SIZES)[number]);
              setPage(1);
            }}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
