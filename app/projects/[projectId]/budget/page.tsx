import { prisma } from "@/lib/prisma";
import {
  computeEvm,
  manDayRate,
  budgetEntriesFromSprints,
  toSprintsForBudget,
  liveSprintContribution,
  parseSprintContributions,
  roleBreakdownFromContributions,
} from "@/lib/calculations";
import { formatMoney } from "@/lib/format";
import { requireModuleAccess } from "@/lib/rbac";
import { EvmLineChart } from "@/components/charts/evm-line-chart";
import { SpiCpiChart } from "@/components/charts/spi-cpi-chart";
import { PageGuide } from "@/components/ui/page-guide";
import { ContractInputsForm } from "./contract-inputs-form";
import { BudgetRow, type RoleBreakdownRow } from "./budget-row";

export const dynamic = "force-dynamic";

export default async function BudgetTrackerPage({ params }: { params: { projectId: string } }) {
  const access = await requireModuleAccess(params.projectId, "BUDGET_TRACKER", "READ_LIMITED");
  const costHidden = access === "READ_LIMITED"; // strips AC / CV / SPI / CPI — cost-side detail

  const [project, sprints] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: params.projectId } }),
    prisma.sprint.findMany({
      where: { projectId: params.projectId },
      orderBy: { startDate: "asc" },
      include: {
        tasks: { include: { person: { include: { roleRate: true } } } },
      },
    }),
  ]);

  const evmSource = budgetEntriesFromSprints(toSprintsForBudget(sprints), project.plannedStoryPoints);
  const evm = computeEvm(evmSource, project.contractValue);
  const rate = manDayRate(project.contractValue, project.plannedManDays);

  // Closed sprints read their frozen snapshot (so a role-rate change after
  // close can't retroactively rewrite reported cost); an open sprint's own
  // spend is its live tasks plus anything that departed it mid-flight
  // (moved elsewhere/uncommitted while still open) — same union closeSprint
  // itself freezes. See sprintTotalsFromContributions/closeSprint.
  const roleBreakdowns: RoleBreakdownRow[][] = sprints.map((s) => {
    const entries = s.closedAt
      ? parseSprintContributions(s.frozenTaskSnapshot)
      : [...s.tasks.map(liveSprintContribution), ...parseSprintContributions(s.departedTaskSnapshot)];
    return roleBreakdownFromContributions(entries);
  });

  const chartData = evm.map((e) => ({ weekEnding: e.weekEnding.toISOString(), pv: e.pv, ev: e.ev, ac: e.actualCost }));
  const spiCpiData = evm.map((e) => ({ weekEnding: e.weekEnding.toISOString(), spi: e.spi, cpi: e.cpi }));

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-sm font-medium text-amber-900">Testing purposes only — not the authoritative budget source.</p>
        <p className="text-xs text-amber-700 mt-0.5">
          Real budget tracking now lives in a separate portal. Read-only here — every figure is derived live from the
          Delivery tab&apos;s Sprint tracking, nothing is entered directly on this page.
        </p>
      </div>

      <div>
        <h2 className="text-base font-semibold text-slate-900">Budget / CPI-SPI Tracker</h2>
        <p className="text-sm text-slate-500">
          PV/EV = cumulative % of Total Planned Story Points tracked/earned across Delivery&apos;s sprints (0/100
          rule), × Contract Value. AC = that sprint&apos;s actual hours ÷ 8 × each assignee&apos;s Rate Role (Admin →
          People). SPI = EV/PV. CPI = EV/AC. &ge;1.0 favorable, &lt;1.0 unfavorable. One data point per sprint
          (closed sprints use their frozen numbers; the current sprint is live).
        </p>
      </div>

      <PageGuide
        id="budget-tracker"
        title="Before you compare this to Delivery's numbers"
        points={[
          <>This page&apos;s <strong>CPI is not the same figure</strong> as Delivery&apos;s Sprints/Overview CPI. Here, CPI = EV ÷ Actual Cost (a dollar ratio). On Delivery, CPI = EV ÷ Actual Value (a competency-adjusted effort ratio). Both are legitimate, they just answer different questions — don&apos;t expect them to match.</>,
          <>Contract Value, Planned Story Points, and Planned Man-Days are the only things entered directly, via the form below — every other figure is derived live from Delivery&apos;s sprint tracking, nothing else is typed in here.</>,
          <>A read-limited viewer sees Actual Cost, Cost Variance, SPI, and CPI stripped out — that&apos;s deliberate cost-side hiding, not missing data.</>,
        ]}
      />

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        {access === "WRITE" ? (
          <>
            <ContractInputsForm
              projectId={project.id}
              contractValue={project.contractValue}
              plannedStoryPoints={project.plannedStoryPoints}
              plannedManDays={project.plannedManDays}
            />
            <p className="mt-2 text-xs text-slate-500">Man-Day Rate (auto): {formatMoney(rate)}</p>
          </>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4 max-w-md text-sm">
            <div>
              <p className="text-xs font-medium text-slate-600">Total Contract Value</p>
              <p className="text-slate-800">{formatMoney(project.contractValue)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-600">Total Planned Story Points</p>
              <p className="text-slate-800">{project.plannedStoryPoints}</p>
            </div>
          </div>
        )}
      </div>

      {!costHidden && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Budget Burn: PV vs EV vs AC</h3>
            <EvmLineChart data={chartData} />
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">SPI / CPI Trend</h3>
            <SpiCpiChart data={spiCpiData} />
          </div>
        </div>
      )}

      <h3 className="text-sm font-semibold text-slate-700">By Sprint (from Delivery)</h3>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="text-left text-xs font-medium text-slate-500 border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 font-medium w-36">Sprint End</th>
                <th className="px-4 py-3 font-medium w-40">% Planned Complete (Cum.)</th>
                <th className="px-4 py-3 font-medium w-40">% Actual Complete (Cum.)</th>
                <th className="px-4 py-3 font-medium w-28">PV</th>
                <th className="px-4 py-3 font-medium w-28">EV</th>
                {!costHidden && <th className="px-4 py-3 font-medium w-48">AC (by role)</th>}
                {!costHidden && <th className="px-4 py-3 font-medium w-28">CV (EV-AC)</th>}
                {!costHidden && <th className="px-4 py-3 font-medium w-24">SPI</th>}
                {!costHidden && <th className="px-4 py-3 font-medium w-24">CPI</th>}
              </tr>
            </thead>
            <tbody>
              {evm.map((e, i) => (
                <BudgetRow key={sprints[i].id} weekId={sprints[i].id} evm={e} roleBreakdown={roleBreakdowns[i]} costHidden={costHidden} />
              ))}
            </tbody>
          </table>
        </div>
        {sprints.length === 0 && (
          <p className="text-sm text-slate-400 p-4">No sprints yet — create one on the Delivery tab&apos;s Tasks page.</p>
        )}
      </div>
    </div>
  );
}
