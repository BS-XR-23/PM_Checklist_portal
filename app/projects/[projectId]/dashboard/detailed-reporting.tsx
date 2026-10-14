"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { formatDate } from "@/lib/format";
import { STATUS_COLORS } from "@/lib/colors";
import { MILESTONE_TYPE_LABELS } from "@/lib/constants";
import { SectionHeader } from "@/components/ui/section-header";
import { IconChevronDown, IconDollar, IconLayers, IconClipboardList } from "@/components/layout/icons";
import { EvmLineChart } from "@/components/charts/evm-line-chart";
import { GanttChart } from "@/components/charts/gantt-chart";
import type { getDashboardData } from "@/lib/dashboard-data";

type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

/**
 * Everything that's reporting/analysis depth rather than "where is this
 * project right now" — charts, the full per-stage breakdown, the milestones
 * table. Collapsed by default (opposite of components/ui/page-guide.tsx,
 * which defaults open on first visit) since the complaint this responds to
 * was "too much visible at once," not "I need onboarding help" — then
 * remembers the viewer's preference the same way PageGuide does.
 */
export function DetailedReporting({
  projectId,
  showBudgetBurn,
  showMilestonesLink,
  evmChartData,
  stageSummaryByType,
  showProjectGantt,
  projectGanttRows,
  milestonesList,
}: {
  projectId: string;
  /** Super Admin only — the Budget Tracker it comes from is testing-only. */
  showBudgetBurn: boolean;
  showMilestonesLink: boolean;
  evmChartData: DashboardData["evmChartData"];
  stageSummaryByType: DashboardData["stageSummaryByType"];
  /** PM_PLAN access gate — Timeline phases live there. */
  showProjectGantt: boolean;
  projectGanttRows: DashboardData["projectGanttRows"];
  milestonesList: DashboardData["milestonesList"];
}) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    try {
      const pref = localStorage.getItem(`dashboardDetailedReporting:${projectId}:expanded`);
      if (pref === "1") setExpanded(true);
    } catch {
      // localStorage unavailable — stays collapsed.
    }
  }, [projectId]);

  function toggle() {
    setExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(`dashboardDetailedReporting:${projectId}:expanded`, next ? "1" : "0");
      } catch {
        // ignore — the toggle still works for this session
      }
      return next;
    });
  }

  // PM Plan phases still on their default names read like a real schedule
  // when they aren't one — say so instead of presenting them as fact.
  const placeholderPhases = projectGanttRows.length > 0 && projectGanttRows.every((r) => /^new phase/i.test(r.label.trim()));

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button type="button" onClick={toggle} className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left" aria-expanded={expanded}>
        <span className="text-sm font-semibold text-slate-700">Detailed reporting</span>
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          {expanded ? "Hide" : "Show"} stages, timeline &amp; milestones
          <IconChevronDown className={clsx("h-4 w-4 transition-transform", expanded && "rotate-180")} />
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-4 border-t border-slate-100">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <SectionHeader icon={<IconLayers />} iconWrapClass="bg-blue-50 text-blue-600" title="Checklist stages" className="" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
                    <th className="px-3 py-2 font-medium">Stage</th>
                    <th className="px-3 py-2 font-medium w-1/3">Done</th>
                    <th className="px-3 py-2 font-medium">First planned</th>
                    <th className="px-3 py-2 font-medium">Last actual</th>
                  </tr>
                </thead>
                <tbody>
                  {stageSummaryByType.map((c) => (
                    <Fragment key={c.key}>
                      <tr className="bg-slate-50/60">
                        <td colSpan={4} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          {c.label}
                        </td>
                      </tr>
                      {c.stages.map((st) => (
                        <tr key={st.stage} className="border-b border-slate-50 last:border-0">
                          <td className="px-3 py-1.5 text-slate-700 whitespace-nowrap">{st.stage}</td>
                          <td className="px-3 py-1.5">
                            <div className="flex items-center gap-2">
                              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                                <span className={clsx("block h-full rounded-full", st.pct >= 1 ? "bg-emerald-500" : "bg-slate-700")} style={{ width: `${st.pct * 100}%` }} />
                              </span>
                              <span className="w-16 shrink-0 text-right text-xs text-slate-500">
                                {st.completed}/{st.total}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-1.5 text-xs text-slate-500 whitespace-nowrap">{formatDate(st.start)}</td>
                          <td className="px-3 py-1.5 text-xs text-slate-500 whitespace-nowrap">{formatDate(st.end)}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {showProjectGantt && projectGanttRows.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <SectionHeader icon={<IconLayers />} iconWrapClass="bg-violet-50 text-violet-600" title="Project timeline (PM Plan phases)" className="mb-2" />
              {placeholderPhases && (
                <p className="mb-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
                  These phases still have their default names — rename them in PM Plan → Timeline so this reflects the real schedule.
                </p>
              )}
              <GanttChart rows={projectGanttRows} emptyText="" />
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <SectionHeader icon={<IconClipboardList />} iconWrapClass="bg-emerald-50 text-emerald-600" title="Client milestones" className="" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
                    <th className="px-3 py-2 font-medium">Milestone</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Due</th>
                    <th className="px-3 py-2 font-medium">Actual</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {milestonesList.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-sm text-slate-400">
                        No milestones yet — add them on the Milestones &amp; Payments tab.
                      </td>
                    </tr>
                  )}
                  {milestonesList.map((m) => (
                    <tr key={m.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-3 py-1.5 text-slate-800 font-medium whitespace-nowrap">{m.name}</td>
                      <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{MILESTONE_TYPE_LABELS[m.type] ?? m.type}</td>
                      <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{formatDate(m.dueDate)}</td>
                      <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{formatDate(m.actualDate)}</td>
                      <td className="px-3 py-1.5">
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
                          style={{ backgroundColor: STATUS_COLORS[m.status].bg, color: STATUS_COLORS[m.status].text }}
                        >
                          {STATUS_COLORS[m.status].label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {showMilestonesLink && (
              <div className="px-4 py-2.5 border-t border-slate-100 text-right">
                <Link href={`/projects/${projectId}/milestones`} prefetch={false} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
                  View all milestones →
                </Link>
              </div>
            )}
          </div>

          {showBudgetBurn && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <SectionHeader
                icon={<IconDollar />}
                iconWrapClass="bg-amber-50 text-amber-600"
                title="Budget burn (PV / EV / AC) — Super Admin, testing"
                className="mb-2"
              />
              <EvmLineChart data={evmChartData} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
