"use client";

import { Fragment, useState } from "react";
import clsx from "clsx";
import { InlineText, InlineTextarea, InlineSelect, InlineDate, InlineNumber } from "@/components/ui/inline-edit";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { IconCalendar, IconFileText, IconChevronDown } from "@/components/layout/icons";
import { CR_TYPES, CR_SIGNOFF_STATUSES, CR_WBS_UPDATED, CR_STATUSES } from "@/lib/constants";
import { crAmount } from "@/lib/calculations";
import { formatMoney, formatDate, toDateInputValue } from "@/lib/format";
import { updateChangeRequest, deleteChangeRequest } from "./cr-actions";

export type CrTableRow = {
  id: string;
  crCode: string;
  title: string;
  dateRaised: Date | null;
  description: string | null;
  manDaysPlanned: number | null;
  billableManDays: number | null;
  rate: number | null; // null when stripped by READ_LIMITED access
  type: string;
  clientSignoff: string;
  wbsUpdated: string;
  status: string;
  notes: string | null;
};

const TYPE_STYLE: Record<string, { bg: string; text: string }> = {
  Paid: { bg: "#D1FAE5", text: "#065F46" },
  Free: { bg: "#DBEAFE", text: "#1D4ED8" },
  Exchange: { bg: "#EDE9FE", text: "#6D28D9" },
};

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  Proposed: { bg: "#FFE699", text: "#7A5B00" },
  Approved: { bg: "#DBEAFE", text: "#1D4ED8" },
  "In Progress": { bg: "#E0E7FF", text: "#4338CA" },
  Completed: { bg: "#C6E0B4", text: "#2C5F2D" },
  Rejected: { bg: "#FF7C80", text: "#7A0000" },
};

const SIGNOFF_STYLE: Record<string, { bg: string; text: string }> = {
  Pending: { bg: "#FFE699", text: "#7A5B00" },
  Signed: { bg: "#C6E0B4", text: "#2C5F2D" },
  "Email Acknowledgement": { bg: "#DBEAFE", text: "#1D4ED8" },
};

const PAGE_SIZES = [10, 25, 50] as const;

export function CrTable({
  projectId,
  canWrite,
  financialsHidden,
  rows,
}: {
  projectId: string;
  canWrite: boolean;
  financialsHidden: boolean;
  rows: CrTableRow[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(10);

  if (rows.length === 0) {
    return <p className="text-sm text-slate-400 rounded-xl border border-slate-200 bg-white p-4">No change requests logged yet.</p>;
  }

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const clampedPage = Math.min(page, pageCount);
  const pageRows = rows.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);
  const colSpan = financialsHidden ? 9 : 11;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[1200px]">
          <thead>
            <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide bg-slate-50">
              <th className="px-3 py-2.5 min-w-[220px]">Change Request</th>
              <th className="px-3 py-2.5 w-24">Type</th>
              <th className="px-3 py-2.5 w-32">Date Raised</th>
              <th className="px-3 py-2.5 w-28">Man-Days Planned</th>
              <th className="px-3 py-2.5 w-28">Billable Man-Days</th>
              {!financialsHidden && <th className="px-3 py-2.5 w-24">Rate</th>}
              {!financialsHidden && <th className="px-3 py-2.5 w-28">Amount</th>}
              <th className="px-3 py-2.5 w-36">Client Signoff</th>
              <th className="px-3 py-2.5 w-24">WBS Updated</th>
              <th className="px-3 py-2.5 w-32">Status</th>
              <th className="px-3 py-2.5 w-14">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((cr) => {
              const amount = crAmount(cr.billableManDays, cr.rate);
              const typeColor = TYPE_STYLE[cr.type] ?? TYPE_STYLE.Paid;
              const statusColor = STATUS_STYLE[cr.status] ?? STATUS_STYLE.Proposed;
              const signoffColor = SIGNOFF_STYLE[cr.clientSignoff] ?? SIGNOFF_STYLE.Pending;
              const expanded = expandedId === cr.id;

              return (
                <Fragment key={cr.id}>
                  <tr className="border-t border-slate-100 align-top hover:bg-slate-50/40">
                    <td className="px-3 py-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-medium text-slate-400 shrink-0">{cr.crCode}</span>
                        {canWrite ? (
                          <div className="flex-1 min-w-0">
                            <InlineText value={cr.title} onSave={(v) => updateChangeRequest(cr.id, projectId, { title: v })} />
                          </div>
                        ) : (
                          <p className="text-sm font-medium text-slate-900">{cr.title}</p>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-3">
                      {canWrite ? (
                        <InlineSelect
                          value={cr.type}
                          options={CR_TYPES}
                          className="rounded-full px-2.5 py-1 text-xs font-medium border-0 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
                          style={{ backgroundColor: typeColor.bg, color: typeColor.text }}
                          onSave={(v) => updateChangeRequest(cr.id, projectId, { type: v })}
                        />
                      ) : (
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
                          style={{ backgroundColor: typeColor.bg, color: typeColor.text }}
                        >
                          {cr.type}
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <IconCalendar className="h-3.5 w-3.5 shrink-0" />
                        {canWrite ? (
                          <InlineDate value={toDateInputValue(cr.dateRaised)} onSave={(v) => updateChangeRequest(cr.id, projectId, { dateRaised: v })} />
                        ) : (
                          <span className="text-sm text-slate-600">{formatDate(cr.dateRaised)}</span>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-3">
                      {canWrite ? (
                        <InlineNumber value={cr.manDaysPlanned} step={0.5} onSave={(v) => updateChangeRequest(cr.id, projectId, { manDaysPlanned: v })} />
                      ) : (
                        <span className="text-sm text-slate-600">{cr.manDaysPlanned ?? "—"}</span>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      {canWrite ? (
                        <InlineNumber value={cr.billableManDays} step={0.5} onSave={(v) => updateChangeRequest(cr.id, projectId, { billableManDays: v })} />
                      ) : (
                        <span className="text-sm text-slate-600">{cr.billableManDays ?? "—"}</span>
                      )}
                    </td>

                    {!financialsHidden && (
                      <td className="px-3 py-3">
                        {canWrite ? (
                          <InlineNumber value={cr.rate} step={1} onSave={(v) => updateChangeRequest(cr.id, projectId, { rate: v })} />
                        ) : (
                          <span className="text-sm text-slate-600">{cr.rate ?? "—"}</span>
                        )}
                      </td>
                    )}

                    {!financialsHidden && (
                      <td className="px-3 py-3">
                        <span className="font-medium text-slate-800">{amount == null ? "—" : formatMoney(amount)}</span>
                      </td>
                    )}

                    <td className="px-3 py-3">
                      {canWrite ? (
                        <InlineSelect
                          value={cr.clientSignoff}
                          options={CR_SIGNOFF_STATUSES}
                          className="rounded-full px-2.5 py-1 text-xs font-medium border-0 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
                          style={{ backgroundColor: signoffColor.bg, color: signoffColor.text }}
                          onSave={(v) => updateChangeRequest(cr.id, projectId, { clientSignoff: v })}
                        />
                      ) : (
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
                          style={{ backgroundColor: signoffColor.bg, color: signoffColor.text }}
                        >
                          {cr.clientSignoff}
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      {canWrite ? (
                        <InlineSelect value={cr.wbsUpdated} options={CR_WBS_UPDATED} onSave={(v) => updateChangeRequest(cr.id, projectId, { wbsUpdated: v })} />
                      ) : (
                        <span
                          className={clsx(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
                            cr.wbsUpdated === "Yes" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                          )}
                        >
                          {cr.wbsUpdated}
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      {canWrite ? (
                        <InlineSelect
                          value={cr.status}
                          options={CR_STATUSES}
                          className="rounded-full px-2.5 py-1 text-xs font-medium border-0 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
                          style={{ backgroundColor: statusColor.bg, color: statusColor.text }}
                          onSave={(v) => updateChangeRequest(cr.id, projectId, { status: v })}
                        />
                      ) : (
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
                          style={{ backgroundColor: statusColor.bg, color: statusColor.text }}
                        >
                          {cr.status}
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setExpandedId(expanded ? null : cr.id)}
                          aria-label={expanded ? "Collapse details" : "Expand details"}
                          className="rounded p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                        >
                          <IconChevronDown className={clsx("h-3.5 w-3.5 transition-transform", expanded && "-rotate-180")} />
                        </button>
                        {canWrite && (
                          <RowActionsMenu
                            actions={[{ label: "Delete CR", pendingLabel: "Deleting...", danger: true, onClick: () => deleteChangeRequest(cr.id, projectId) }]}
                          />
                        )}
                      </div>
                    </td>
                  </tr>

                  {expanded && (
                    <tr className="border-t border-slate-100 bg-slate-50/60">
                      <td colSpan={colSpan} className="px-4 py-4">
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div className="flex items-start gap-2.5">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                              <IconFileText className="h-3.5 w-3.5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-slate-700">Description</p>
                              {canWrite ? (
                                <InlineTextarea
                                  value={cr.description ?? ""}
                                  placeholder="—"
                                  onSave={(v) => updateChangeRequest(cr.id, projectId, { description: v })}
                                />
                              ) : (
                                <p className="text-sm text-slate-600 mt-0.5">{cr.description || "—"}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-start gap-2.5">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                              <IconFileText className="h-3.5 w-3.5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-slate-700">Notes</p>
                              {canWrite ? (
                                <InlineTextarea value={cr.notes ?? ""} placeholder="—" onSave={(v) => updateChangeRequest(cr.id, projectId, { notes: v })} />
                              ) : (
                                <p className="text-sm text-slate-600 mt-0.5">{cr.notes || "—"}</p>
                              )}
                            </div>
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
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
          <span>
            Showing {(clampedPage - 1) * pageSize + 1} to {Math.min(clampedPage * pageSize, rows.length)} of {rows.length} change requests
          </span>
          <div className="flex items-center gap-3">
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
