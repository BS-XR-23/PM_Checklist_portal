"use client";

import { Fragment, useState } from "react";
import clsx from "clsx";
import { InlineText, InlineTextarea, InlineSelect, InlineDate } from "@/components/ui/inline-edit";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { IconCalendar, IconShield, IconFileText, IconChevronDown } from "@/components/layout/icons";
import { PersonPicker } from "@/components/resourcing/person-picker";
import { RISK_LEVELS, RISK_STATUSES } from "@/lib/constants";
import { RISK_SEVERITY_COLORS, riskScoreSeverity, avatarColorFromString, tagPillStyle } from "@/lib/colors";
import { riskScore } from "@/lib/calculations";
import { formatDate, toDateInputValue, initials } from "@/lib/format";
import { updateRisk, deleteRisk } from "./risk-actions";

export type RiskTableRow = {
  id: string;
  type: string;
  category: string | null;
  description: string;
  probability: string;
  impact: string;
  owner: string | null;
  ownerPersonId: string | null;
  ownerPersonName: string | null;
  mitigation: string | null;
  status: string;
  dateRaised: Date | null;
  dateClosed: Date | null;
  notes: string | null;
};

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  Open: { bg: "#E0E7FF", text: "#4338CA" },
  Monitoring: { bg: "#DBEAFE", text: "#1D4ED8" },
  Mitigated: { bg: "#D1FAE5", text: "#065F46" },
  Closed: { bg: "#E2E8F0", text: "#475569" },
  Realized: { bg: "#FF7C80", text: "#7A0000" },
  "Not Pursued": { bg: "#D9D9D9", text: "#3F3F3F" },
};

const LEVEL_KEY: Record<string, keyof typeof RISK_SEVERITY_COLORS> = { Low: "low", Medium: "medium", High: "high" };

const PAGE_SIZES = [10, 25, 50] as const;

export function RiskTable({
  projectId,
  canWrite,
  people,
  rows,
}: {
  projectId: string;
  canWrite: boolean;
  people: { id: string; name: string }[];
  rows: RiskTableRow[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(10);

  if (rows.length === 0) {
    return <p className="text-sm text-slate-400 rounded-xl border border-slate-200 bg-white p-4">No risks logged yet.</p>;
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
              <th className="px-3 py-2.5 min-w-[260px]">Risk / Issue</th>
              <th className="px-3 py-2.5 w-28">Category</th>
              <th className="px-3 py-2.5 w-28">Probability</th>
              <th className="px-3 py-2.5 w-28">Impact</th>
              <th className="px-3 py-2.5 w-20">Risk Score</th>
              <th className="px-3 py-2.5 w-40">Owner</th>
              <th className="px-3 py-2.5 w-32">Status</th>
              <th className="px-3 py-2.5 w-32">Date Raised</th>
              <th className="px-3 py-2.5 w-32">Date Closed</th>
              <th className="px-3 py-2.5 w-14">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r, i) => {
              const score = riskScore(r.probability, r.impact);
              const severity = RISK_SEVERITY_COLORS[riskScoreSeverity(score)];
              const statusColor = STATUS_STYLE[r.status] ?? STATUS_STYLE.Open;
              const categoryColor = r.category ? tagPillStyle(r.category) : null;
              const expanded = expandedId === r.id;

              return (
                <Fragment key={r.id}>
                  <tr className="border-t border-slate-100 align-top hover:bg-slate-50/40">
                    <td className="px-3 py-3 text-xs text-slate-400">{(clampedPage - 1) * pageSize + i + 1}</td>

                    <td className="px-3 py-3">
                      {canWrite ? (
                        <InlineTextarea value={r.description} onSave={(v) => updateRisk(r.id, projectId, { description: v })} />
                      ) : (
                        <p className="text-sm font-medium text-slate-900">{r.description}</p>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      {canWrite ? (
                        <InlineText value={r.category ?? ""} placeholder="—" onSave={(v) => updateRisk(r.id, projectId, { category: v })} />
                      ) : r.category && categoryColor ? (
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap"
                          style={{ backgroundColor: categoryColor.bg, color: categoryColor.text }}
                        >
                          {r.category}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      {canWrite ? (
                        <InlineSelect
                          value={r.probability}
                          options={RISK_LEVELS}
                          className="rounded-full px-2.5 py-1 text-xs font-medium border-0 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
                          style={{ backgroundColor: RISK_SEVERITY_COLORS[LEVEL_KEY[r.probability]].bg, color: RISK_SEVERITY_COLORS[LEVEL_KEY[r.probability]].text }}
                          onSave={(v) => updateRisk(r.id, projectId, { probability: v })}
                        />
                      ) : (
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
                          style={{ backgroundColor: RISK_SEVERITY_COLORS[LEVEL_KEY[r.probability]].bg, color: RISK_SEVERITY_COLORS[LEVEL_KEY[r.probability]].text }}
                        >
                          {r.probability}
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      {canWrite ? (
                        <InlineSelect
                          value={r.impact}
                          options={RISK_LEVELS}
                          className="rounded-full px-2.5 py-1 text-xs font-medium border-0 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
                          style={{ backgroundColor: RISK_SEVERITY_COLORS[LEVEL_KEY[r.impact]].bg, color: RISK_SEVERITY_COLORS[LEVEL_KEY[r.impact]].text }}
                          onSave={(v) => updateRisk(r.id, projectId, { impact: v })}
                        />
                      ) : (
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
                          style={{ backgroundColor: RISK_SEVERITY_COLORS[LEVEL_KEY[r.impact]].bg, color: RISK_SEVERITY_COLORS[LEVEL_KEY[r.impact]].text }}
                        >
                          {r.impact}
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      <div className="flex flex-col items-center gap-0.5">
                        <span
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold"
                          style={{ backgroundColor: severity.bg, color: severity.text }}
                          title={`Risk score ${score}`}
                        >
                          {score}
                        </span>
                        <span className="text-[10px] font-medium" style={{ color: severity.text }}>
                          {severity.label}
                        </span>
                      </div>
                    </td>

                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                          style={{ backgroundColor: avatarColorFromString(r.ownerPersonName ?? r.owner ?? "?") }}
                        >
                          {initials(r.ownerPersonName ?? r.owner ?? "?")}
                        </span>
                        <div className="min-w-0 flex-1">
                          {canWrite ? (
                            <PersonPicker
                              personId={r.ownerPersonId}
                              legacyText={r.owner}
                              people={people}
                              onSave={(personId) => updateRisk(r.id, projectId, { ownerPersonId: personId })}
                            />
                          ) : (
                            <span className="text-sm text-slate-700 truncate block">{r.ownerPersonName || r.owner || "—"}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-3">
                      {canWrite ? (
                        <InlineSelect
                          value={r.status}
                          options={RISK_STATUSES}
                          className="rounded-full px-2.5 py-1 text-xs font-medium border-0 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
                          style={{ backgroundColor: statusColor.bg, color: statusColor.text }}
                          onSave={(v) => updateRisk(r.id, projectId, { status: v })}
                        />
                      ) : (
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
                          style={{ backgroundColor: statusColor.bg, color: statusColor.text }}
                        >
                          {r.status}
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <IconCalendar className="h-3.5 w-3.5 shrink-0" />
                        {canWrite ? (
                          <InlineDate value={toDateInputValue(r.dateRaised)} onSave={(v) => updateRisk(r.id, projectId, { dateRaised: v })} />
                        ) : (
                          <span className="text-sm text-slate-600">{formatDate(r.dateRaised)}</span>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <IconCalendar className="h-3.5 w-3.5 shrink-0" />
                        {canWrite ? (
                          <InlineDate value={toDateInputValue(r.dateClosed)} onSave={(v) => updateRisk(r.id, projectId, { dateClosed: v })} />
                        ) : (
                          <span className="text-sm text-slate-600">{formatDate(r.dateClosed)}</span>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setExpandedId(expanded ? null : r.id)}
                          aria-label={expanded ? "Collapse details" : "Expand details"}
                          className="rounded p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                        >
                          <IconChevronDown className={clsx("h-3.5 w-3.5 transition-transform", expanded && "-rotate-180")} />
                        </button>
                        {canWrite && (
                          <RowActionsMenu
                            actions={[{ label: "Delete risk", pendingLabel: "Deleting...", danger: true, onClick: () => deleteRisk(r.id, projectId) }]}
                          />
                        )}
                      </div>
                    </td>
                  </tr>

                  {expanded && (
                    <tr className="border-t border-slate-100 bg-slate-50/60">
                      <td colSpan={11} className="px-4 py-4">
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div className="flex items-start gap-2.5">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                              <IconShield className="h-3.5 w-3.5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-slate-700">Mitigation / Response Plan</p>
                              {canWrite ? (
                                <InlineTextarea
                                  value={r.mitigation ?? ""}
                                  placeholder="—"
                                  onSave={(v) => updateRisk(r.id, projectId, { mitigation: v })}
                                />
                              ) : (
                                <p className="text-sm text-slate-600 mt-0.5">{r.mitigation || "—"}</p>
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
                                <InlineTextarea value={r.notes ?? ""} placeholder="—" onSave={(v) => updateRisk(r.id, projectId, { notes: v })} />
                              ) : (
                                <p className="text-sm text-slate-600 mt-0.5">{r.notes || "—"}</p>
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

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          {(["high", "medium", "low"] as const).map((k) => (
            <div key={k} className="flex items-center gap-1.5 text-slate-500">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: RISK_SEVERITY_COLORS[k].bg }} />
              {RISK_SEVERITY_COLORS[k].label} ({k === "high" ? "6-9" : k === "medium" ? "3-4" : "1-2"})
            </div>
          ))}
        </div>

        {rows.length > PAGE_SIZES[0] && (
          <div className="flex flex-wrap items-center gap-3 text-slate-500">
            <span>
              Showing {(clampedPage - 1) * pageSize + 1} to {Math.min(clampedPage * pageSize, rows.length)} of {rows.length} risks
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
    </div>
  );
}
