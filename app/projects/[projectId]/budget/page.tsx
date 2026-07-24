import { prisma } from "@/lib/prisma";
import { computeEvm, manDayRate } from "@/lib/calculations";
import { formatMoney } from "@/lib/format";
import { EvmLineChart } from "@/components/charts/evm-line-chart";
import { SpiCpiChart } from "@/components/charts/spi-cpi-chart";
import { ContractInputsForm } from "./contract-inputs-form";
import { AddEntryButton } from "./add-entry-button";
import { BudgetRow } from "./budget-row";

export default async function BudgetTrackerPage({ params }: { params: { projectId: string } }) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: params.projectId } });
  const entries = await prisma.budgetEntry.findMany({
    where: { projectId: params.projectId },
    orderBy: { weekEnding: "asc" },
  });

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
          &ge;1.0 favorable, &lt;1.0 unfavorable.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <ContractInputsForm
          projectId={project.id}
          contractValue={project.contractValue}
          plannedManDays={project.plannedManDays}
        />
        <p className="mt-2 text-xs text-slate-500">Man-Day Rate (auto): {formatMoney(rate)}</p>
      </div>

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

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Weekly Entries</h3>
        <AddEntryButton projectId={project.id} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
              <th className="px-3 py-2 font-medium w-36">Week Ending</th>
              <th className="px-3 py-2 font-medium w-40">% Planned Complete (Cum.)</th>
              <th className="px-3 py-2 font-medium w-40">% Actual Complete (Cum.)</th>
              <th className="px-3 py-2 font-medium w-28">PV</th>
              <th className="px-3 py-2 font-medium w-28">EV</th>
              <th className="px-3 py-2 font-medium w-32">AC (Actual Cost)</th>
              <th className="px-3 py-2 font-medium w-28">CV (EV-AC)</th>
              <th className="px-3 py-2 font-medium w-24">SPI</th>
              <th className="px-3 py-2 font-medium w-24">CPI</th>
              <th className="px-3 py-2 font-medium min-w-[160px]">Notes</th>
              <th className="px-3 py-2 font-medium w-8" />
            </tr>
          </thead>
          <tbody>
            {evm.map((e, i) => (
              <BudgetRow key={entries[i].id} projectId={project.id} entry={entries[i]} evm={e} />
            ))}
          </tbody>
        </table>
        {entries.length === 0 && <p className="text-sm text-slate-400 p-4">No weekly entries yet.</p>}
      </div>
    </div>
  );
}
