import { prisma } from "@/lib/prisma";
import { computeEvm, manDayRate, budgetEntriesFromWbs, toWbsWeekForBudget } from "@/lib/calculations";
import { formatMoney } from "@/lib/format";
import { requireModuleAccess } from "@/lib/rbac";
import { EvmLineChart } from "@/components/charts/evm-line-chart";
import { SpiCpiChart } from "@/components/charts/spi-cpi-chart";
import { ContractInputsForm } from "./contract-inputs-form";
import { BudgetRow, type RoleBreakdownRow } from "./budget-row";

export const dynamic = "force-dynamic";

export default async function BudgetTrackerPage({ params }: { params: { projectId: string } }) {
  const access = await requireModuleAccess(params.projectId, "BUDGET_TRACKER", "READ_LIMITED");
  const costHidden = access === "READ_LIMITED"; // strips AC / CV / SPI / CPI — cost-side detail

  const [project, weeks] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: params.projectId } }),
    prisma.wbsWeek.findMany({
      where: { projectId: params.projectId },
      orderBy: { weekEnding: "asc" },
      include: {
        entries: {
          orderBy: { createdAt: "asc" },
          include: { wbsTask: true, person: { include: { roleRate: true } } },
        },
      },
    }),
  ]);

  const evmSource = budgetEntriesFromWbs(toWbsWeekForBudget(weeks), project.plannedManDays);
  const evm = computeEvm(evmSource, project.contractValue);
  const rate = manDayRate(project.contractValue, project.plannedManDays);

  const roleBreakdowns: RoleBreakdownRow[][] = weeks.map((w) => {
    const groups = new Map<string, RoleBreakdownRow>();
    for (const e of w.entries) {
      const roleName = e.person?.roleRate?.roleName ?? "Unassigned / No Rate Role";
      const rowRate = e.person?.roleRate?.manDayRate ?? 0;
      const existing = groups.get(roleName) ?? { roleName, manDays: 0, manDayRate: rowRate, cost: 0 };
      existing.manDays += e.actualManDays;
      existing.cost += e.actualManDays * rowRate;
      groups.set(roleName, existing);
    }
    return Array.from(groups.values()).filter((g) => g.manDays > 0);
  });

  const chartData = evm.map((e) => ({ weekEnding: e.weekEnding.toISOString(), pv: e.pv, ev: e.ev, ac: e.actualCost }));
  const spiCpiData = evm.map((e) => ({ weekEnding: e.weekEnding.toISOString(), spi: e.spi, cpi: e.cpi }));

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-sm font-medium text-amber-900">Testing purposes only — not the authoritative budget source.</p>
        <p className="text-xs text-amber-700 mt-0.5">
          Real budget tracking now lives in a separate portal. Read-only here — every figure is derived live from the
          Delivery tab&apos;s WBS tracking, nothing is entered directly on this page.
        </p>
      </div>

      <div>
        <h2 className="text-base font-semibold text-slate-900">Budget / CPI-SPI Tracker</h2>
        <p className="text-sm text-slate-500">
          PV/EV = cumulative % of Total Planned Man-Days tracked/earned on the Delivery WBS, × Contract Value. AC =
          that week&apos;s actual man-days × each assignee&apos;s Rate Role (Admin → People). SPI = EV/PV. CPI =
          EV/AC. &ge;1.0 favorable, &lt;1.0 unfavorable.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        {access === "WRITE" ? (
          <>
            <ContractInputsForm projectId={project.id} contractValue={project.contractValue} plannedManDays={project.plannedManDays} />
            <p className="mt-2 text-xs text-slate-500">Man-Day Rate (auto): {formatMoney(rate)}</p>
          </>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4 max-w-md text-sm">
            <div>
              <p className="text-xs font-medium text-slate-600">Total Contract Value</p>
              <p className="text-slate-800">{formatMoney(project.contractValue)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-600">Total Planned Man-Days</p>
              <p className="text-slate-800">{project.plannedManDays}</p>
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

      <h3 className="text-sm font-semibold text-slate-700">Weekly (from Delivery)</h3>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="text-left text-xs font-medium text-slate-500 border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 font-medium w-36">Week Ending</th>
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
                <BudgetRow key={weeks[i].id} weekId={weeks[i].id} evm={e} roleBreakdown={roleBreakdowns[i]} costHidden={costHidden} />
              ))}
            </tbody>
          </table>
        </div>
        {weeks.length === 0 && (
          <p className="text-sm text-slate-400 p-4">No tracking weeks yet — add one on the Delivery tab&apos;s Weekly Tracking page.</p>
        )}
      </div>
    </div>
  );
}
