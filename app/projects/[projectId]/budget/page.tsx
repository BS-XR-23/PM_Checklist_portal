import { prisma } from "@/lib/prisma";
import { computeEvm, manDayRate } from "@/lib/calculations";
import { formatMoney } from "@/lib/format";
import { requireModuleAccess } from "@/lib/rbac";
import { EvmLineChart } from "@/components/charts/evm-line-chart";
import { SpiCpiChart } from "@/components/charts/spi-cpi-chart";
import { ContractInputsForm } from "./contract-inputs-form";
import { AddEntryButton } from "./add-entry-button";
import { BudgetRow } from "./budget-row";

export default async function BudgetTrackerPage({ params }: { params: { projectId: string } }) {
  const access = await requireModuleAccess(params.projectId, "BUDGET_TRACKER", "READ_LIMITED");
  const canWrite = access === "WRITE";
  const costHidden = access === "READ_LIMITED"; // strips AC / CV / SPI / CPI — cost-side detail

  const [project, entries, roleRates] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: params.projectId } }),
    prisma.budgetEntry.findMany({
      where: { projectId: params.projectId },
      orderBy: { weekEnding: "asc" },
      include: { roleCosts: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.roleRate.findMany({ orderBy: { roleName: "asc" } }),
  ]);

  const evm = computeEvm(entries, project.contractValue);
  const rate = manDayRate(project.contractValue, project.plannedManDays);

  const chartData = evm.map((e) => ({
    weekEnding: e.weekEnding.toISOString(),
    pv: e.pv,
    ev: e.ev,
    ac: e.actualCost,
  }));
  const spiCpiData = evm.map((e) => ({ weekEnding: e.weekEnding.toISOString(), spi: e.spi, cpi: e.cpi }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Budget / CPI-SPI Tracker</h2>
        <p className="text-sm text-slate-500">
          EV = %Actual Complete x Contract Value. PV = %Planned Complete x Contract Value. SPI = EV/PV. CPI = EV/AC.
          &ge;1.0 favorable, &lt;1.0 unfavorable. %Actual Complete is synced from the checklist; AC is the sum of
          actual man-days logged per role each week (click a row&apos;s AC to expand).
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        {canWrite ? (
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

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Weekly Entries</h3>
        {canWrite && <AddEntryButton projectId={project.id} />}
      </div>

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
                {!costHidden && <th className="px-4 py-3 font-medium w-32">AC (by role)</th>}
                {!costHidden && <th className="px-4 py-3 font-medium w-28">CV (EV-AC)</th>}
                {!costHidden && <th className="px-4 py-3 font-medium w-24">SPI</th>}
                {!costHidden && <th className="px-4 py-3 font-medium w-24">CPI</th>}
                <th className="px-4 py-3 font-medium min-w-[160px]">Notes</th>
                {canWrite && <th className="px-4 py-3 font-medium w-8" />}
              </tr>
            </thead>
            <tbody>
              {evm.map((e, i) => (
                <BudgetRow
                  key={entries[i].id}
                  projectId={project.id}
                  entry={entries[i]}
                  evm={e}
                  canWrite={canWrite}
                  costHidden={costHidden}
                  roleRates={roleRates}
                />
              ))}
            </tbody>
          </table>
        </div>
        {entries.length === 0 && <p className="text-sm text-slate-400 p-4">No weekly entries yet.</p>}
      </div>
    </div>
  );
}
