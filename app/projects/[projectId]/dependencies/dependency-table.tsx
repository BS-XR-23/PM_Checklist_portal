"use client";

import { Fragment, useState } from "react";
import clsx from "clsx";
import { InlineText, InlineTextarea, InlineSelect, InlineDate } from "@/components/ui/inline-edit";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { IconCalendar, IconFileText, IconFolder, IconChevronDown, IconSearch } from "@/components/layout/icons";
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [responsibleFilter, setResponsibleFilter] = useState("all");

  // Free-text fields — offer whatever distinct values are actually in use,
  // sorted, rather than a fixed enum like Status/Priority already have.
  const categoryOptions = Array.from(new Set(rows.map((d) => d.category).filter((v): v is string => !!v))).sort();
  const responsibleOptions = Array.from(new Set(rows.map((d) => d.responsible).filter((v): v is string => !!v))).sort();

  if (rows.length === 0) {
    return <p className="text-sm text-slate-400 rounded-xl border border-slate-200 bg-white p-4">No dependencies logged yet.</p>;
  }

  const q = search.trim().toLowerCase();
  const filteredRows = rows.filter((d) => {
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    if (categoryFilter !== "all" && d.category !== categoryFilter) return false;
    if (priorityFilter !== "all" && d.priority !== priorityFilter) return false;
    if (responsibleFilter !== "all" && d.responsible !== responsibleFilter) return false;
    if (q && !d.description.toLowerCase().includes(q)) return false;
    return true;
  });
  const filtersActive = statusFilter !== "all" || categoryFilter !== "all" || priorityFilter !== "all" || responsibleFilter !== "all" || q !== "";

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const clampedPage = Math.min(page, pageCount);
  const pageRows = filteredRows.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
        <div className="relative">
          <IconSearch className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search dependencies…"
            className="w-56 rounded border border-slate-200 pl-7 pr-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded border border-slate-200 px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
        >
          <option value="all">All statuses</option>
          {DEPENDENCY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          className="rounded border border-slate-200 px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
        >
          <option value="all">All categories</option>
          {categoryOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => {
            setPriorityFilter(e.target.value);
            setPage(1);
          }}
          className="rounded border border-slate-200 px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
        >
          <option value="all">All priorities</option>
          {DEPENDENCY_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={responsibleFilter}
          onChange={(e) => {
            setResponsibleFilter(e.target.value);
            setPage(1);
          }}
          className="rounded border border-slate-200 px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
        >
          <option value="all">All responsible</option>
          {responsibleOptions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        {filtersActive && (
          <button
            onClick={() => {
              setSearch("");
              setStatusFilter("all");
              setCategoryFilter("all");
              setPriorityFilter("all");
              setResponsibleFilter("all");
              setPage(1);
            }}
            className="text-xs text-slate-400 hover:text-slate-700"
          >
            Clear filters
          </button>
        )}
      </div>

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
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-sm text-slate-400">
                  No dependencies match the current filters.
                </td>
              </tr>
            )}
            {pageRows.map((d, i) => {
              const priorityColor = DEPENDENCY_PRIORITY_COLORS[d.priority as keyof typeof DEPENDENCY_PRIORITY_COLORS] ?? DEPENDENCY_PRIORITY_COLORS.Medium;
              const statusColor = DEPENDENCY_STATUS_COLORS[d.status as keyof typeof DEPENDENCY_STATUS_COLORS] ?? DEPENDENCY_STATUS_COLORS.Due;
              // Always resolve a chip color, even with no category yet, so the
              // icon-chip look (not a plain box) is what's on screen the moment a
              // write-capable user sees the row, not just once they save a value.
              const categoryColor = d.category ? tagPillStyle(d.category) : { bg: "#F1F5F9", text: "#94A3B8" };
              const expanded = expandedId === d.id;

              return (
                <Fragment key={d.id}>
                  <tr className="border-t border-slate-100 align-top hover:bg-slate-50/40">
                    <td className="px-3 py-3 text-xs text-slate-400">{(clampedPage - 1) * pageSize + i + 1}</td>

                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                          style={{ backgroundColor: categoryColor.bg, color: categoryColor.text }}
                        >
                          <IconFolder className="h-3.5 w-3.5" />
                        </span>
                        {canWrite ? (
                          <InlineText
                            value={d.category ?? ""}
                            placeholder="—"
                            onSave={(v) => updateDependency(d.id, projectId, { category: v })}
                            className="w-24 min-w-0 truncate bg-transparent text-sm text-slate-700 px-1 py-1 rounded border border-transparent hover:border-slate-300 hover:bg-slate-100 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
                          />
                        ) : (
                          <span className="text-sm text-slate-700">{d.category || "—"}</span>
                        )}
                      </span>
                    </td>

                    <td className="px-3 py-3">
                      {canWrite ? (
                        <InlineTextarea value={d.description} onSave={(v) => updateDependency(d.id, projectId, { description: v })} />
                      ) : (
                        <p className="text-sm font-medium text-slate-900">{d.description}</p>
                      )}
                      {expanded && (
                        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-2">
                          <p className="text-xs font-semibold text-slate-500">Notes</p>
                          {canWrite ? (
                            <InlineTextarea value={d.notes ?? ""} placeholder="—" onSave={(v) => updateDependency(d.id, projectId, { notes: v })} />
                          ) : (
                            <p className="text-sm text-slate-600 mt-0.5">{d.notes || "—"}</p>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                        <IconFileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        {canWrite ? (
                          <InlineText
                            value={d.preferredFormat ?? ""}
                            placeholder="—"
                            onSave={(v) => updateDependency(d.id, projectId, { preferredFormat: v })}
                            className="w-full min-w-0 truncate bg-transparent text-sm px-1 py-1 rounded border border-transparent hover:border-slate-300 hover:bg-slate-100 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
                          />
                        ) : (
                          d.preferredFormat || "—"
                        )}
                      </span>
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
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredRows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
          <span>
            Showing {(clampedPage - 1) * pageSize + 1} to {Math.min(clampedPage * pageSize, filteredRows.length)} of {filteredRows.length} dependencies
          </span>
          <div className="flex flex-wrap items-center gap-3">
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
        </div>
      )}
    </div>
  );
}
