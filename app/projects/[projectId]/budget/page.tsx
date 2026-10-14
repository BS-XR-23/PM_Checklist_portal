import { prisma } from "@/lib/prisma";
import {
  computeEvm,
  manDayRate,
  budgetEntriesFromSprints,
  runningSprintBudget,
  toSprintsForBudget,
  liveSprintContribution,
  parseSprintContributions,
  roleBreakdownFromContributions,
} from "@/lib/calculations";
import { formatMoney, formatPct } from "@/lib/format";
import { StatTile } from "@/components/ui/stat-tile";
import { IconDollar, IconGauge, IconChart, IconAlertTriangle } from "@/components/layout/icons";
import { wbsBaselinePoints } from "@/lib/project-health";
import { requireModuleAccess } from "@/lib/rbac";
import { EvmLineChart } from "@/components/charts/evm-line-chart";
import { SpiCpiChart } from "@/components/charts/spi-cpi-chart";
import { PageGuide } from "@/components/ui/page-guide";
import { ContractInputsForm } from "./contract-inputs-form";
import { BudgetRow, type RoleBreakdownRow } from "./budget-row";

export const dynamic = "force-dynamic";

export default async function BudgetTrackerPage({ params }: { params: { projectId: string } }) {
  const access = await requireModuleAccess(params.projectId, "BUDGET_TRACKER", "READ_LIMITED");
  const costHidden = access === "READ_LIMITED"; // strips AC / margin / SPI — cost-side detail

  const [project, sprints, wbsTasks] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: params.projectId } }),
    prisma.sprint.findMany({
      where: { projectId: params.projectId },
      orderBy: { startDate: "asc" },
      include: {
        tasks: { include: { person: { include: { roleRate: true } } } },
      },
      relationLoadStrategy: "join",
    }),
    prisma.wbsTask.findMany({ where: { projectId: params.projectId }, select: { storyPoints: true } }),
  ]);

  const baselinePoints = wbsBaselinePoints(wbsTasks);
  const sprintsForBudget = toSprintsForBudget(sprints);
  // One row per CLOSED sprint — same closed-sprints-only rule as Delivery's
  // SPI; the running sprint is summarized separately below.
  const closedSprints = sprints.filter((s) => s.closedAt);
  const evmSource = budgetEntriesFromSprints(sprintsForBudget, baselinePoints);
  const evm = computeEvm(evmSource, project.contractValue);
  const running = runningSprintBudget(sprintsForBudget, project.contractValue, baselinePoints);
  const runningSprint = sprints.find((s) => s.startedAt && !s.closedAt) ?? null;
  const draftCount = sprints.filter((s) => !s.startedAt && !s.closedAt).length;
  const latest = evm[evm.length - 1] ?? null;
  const uncostedHours = evmSource.reduce((sum, e) => sum + e.uncostedHours, 0) + (running?.uncostedHours ?? 0);
  const rate = manDayRate(project.contractValue, project.plannedManDays);

  // Sanity check on Planned Man-Days: at the pace of the closed sprints
  // (raw man-days per earned point), how much effort does the whole WBS
  // imply? A wildly different Planned Man-Days makes the auto rate
  // meaningless.
  const closedEntries = closedSprints.flatMap((s) => parseSprintContributions(s.frozenTaskSnapshot));
  const closedManDays = closedEntries.reduce((sum, e) => sum + e.sprintOwnHours / 8, 0);
  const closedEarnedPoints = closedSprints.reduce((sum, s) => sum + (s.frozenEarnedPoints ?? 0), 0);
  const impliedManDays = closedEarnedPoints && closedManDays ? (closedManDays / closedEarnedPoints) * baselinePoints : null;

  // Closed sprints read their frozen snapshot, so a role-rate change after
  // close can't retroactively rewrite reported cost.
  const roleBreakdowns: RoleBreakdownRow[][] = closedSprints.map((s) => roleBreakdownFromContributions(parseSprintContributions(s.frozenTaskSnapshot)));
  const runningBreakdown = runningSprint
    ? roleBreakdownFromContributions([...runningSprint.tasks.map(liveSprintContribution), ...parseSprintContributions(runningSprint.departedTaskSnapshot)])
    : [];

  const chartData = evm.map((e) => ({ weekEnding: e.weekEnding.toISOString(), pv: e.pv, ev: e.ev, ac: e.actualCost }));
  const spiData = evm.map((e) => ({ weekEnding: e.weekEnding.toISOString(), spi: e.spi, cpi: null }));

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
        <h2 className="text-base font-semibold text-slate-900">Budget / SPI Tracker</h2>
        <p className="text-sm text-slate-500">
          PV/EV = cumulative story points committed/earned (0/100 rule) ÷ Baseline Story Points (the WBS total) ×
          Contract Value — i.e. contract <em>price</em>. AC = actual hours ÷ 8 × each assignee&apos;s Role Rate (Admin →
          People) — internal <em>cost</em>. SPI = EV/PV. Margin = (EV − AC) ÷ EV. One row per closed sprint, the same
          rule as Delivery&apos;s SPI; the running sprint is shown separately.
        </p>
      </div>

      <PageGuide
        id="budget-tracker"
        title="Before you compare this to Delivery's numbers"
        points={[
          <>There&apos;s <strong>no dollar CPI</strong>: EV is contract price and AC is role-rate cost, so EV ÷ AC measured profit margin, not efficiency (any profitable project read as &ldquo;CPI 6&rdquo;). It&apos;s shown as <strong>gross margin</strong> instead. For effort efficiency use Delivery&apos;s <strong>Effort Index</strong>.</>,
          <><strong>SPI matches Delivery&apos;s SPI</strong> — both use closed sprints only. A running sprint commits all its points on day one but earns them only as tasks reach 100%, so it would drag SPI down mid-sprint.</>,
          <>Contract Value and Planned Man-Days are the only things entered directly. Baseline Story Points is the sum of the WBS task estimates — change it on Delivery → Tasks.</>,
          <>A read-limited viewer sees Actual Cost, margin, and SPI stripped out — that&apos;s deliberate cost-side hiding, not missing data.</>,
        ]}
      />

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        {access === "WRITE" ? (
          <>
            <ContractInputsForm
              projectId={project.id}
              contractValue={project.contractValue}
              baselinePoints={baselinePoints}
              plannedManDays={project.plannedManDays}
            />
            <p className="mt-2 text-xs text-slate-500">
              Man-Day Rate (auto): {formatMoney(rate)} <span className="text-slate-400">— contract ÷ planned man-days; reference only, not used in any figure here.</span>
            </p>
            {impliedManDays != null && project.plannedManDays > 0 && (impliedManDays > project.plannedManDays * 2 || impliedManDays < project.plannedManDays / 2) && (
              <p className="mt-1 text-xs text-amber-700">
                At the closed sprints&apos; pace ({(closedManDays / closedEarnedPoints).toFixed(2)} man-days per point), the WBS implies about{" "}
                {Math.round(impliedManDays)} man-days — Planned Man-Days is {project.plannedManDays}. One of them is probably out of date.
              </p>
            )}
          </>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md text-sm">
            <div>
              <p className="text-xs font-medium text-slate-600">Total Contract Value</p>
              <p className="text-slate-800">{formatMoney(project.contractValue)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-600">Baseline Story Points (WBS total)</p>
              <p className="text-slate-800">{baselinePoints}</p>
            </div>
          </div>
        )}
      </div>

      {!costHidden && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile
            icon={<IconDollar />}
            iconWrapClass="bg-orange-50 text-orange-600"
            label="Earned value (EV)"
            value={latest ? formatMoney(latest.ev) : "—"}
            subtitle={latest ? `${formatPct(latest.pctActualComplete)} of the contract earned` : "No closed sprint yet"}
          />
          <StatTile
            icon={<IconDollar />}
            iconWrapClass="bg-teal-50 text-teal-600"
            label="Cost to date (AC)"
            value={latest ? formatMoney(latest.actualCost) : "—"}
            subtitle="role-rate cost, closed sprints"
          />
          <StatTile
            icon={<IconChart />}
            iconWrapClass="bg-emerald-50 text-emerald-600"
            label="Gross margin on earned work"
            value={latest?.margin != null ? formatPct(latest.margin) : "—"}
            subtitle={latest ? `${formatMoney(latest.cv)} (EV − AC)` : undefined}
          />
          <StatTile
            icon={<IconGauge />}
            iconWrapClass="bg-blue-50 text-blue-600"
            label="SPI"
            value={latest?.spi != null ? latest.spi.toFixed(2) : "—"}
            subtitle="closed sprints — same as Delivery"
          />
        </div>
      )}

      {!costHidden && uncostedHours > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {uncostedHours.toFixed(1)} logged hours have no cost because their assignee has no Role Rate — set it in Admin → People, or AC is understated.
        </div>
      )}

      {runningSprint && running && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 px-4 py-3 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">
            {runningSprint.name} is running — not in the totals until it closes
          </p>
          <p className="mt-0.5">
            {running.earnedPoints} of {running.committedPoints} points earned so far ({formatMoney(running.earnedValue)} of {formatMoney(running.plannedValue)} committed value)
            {!costHidden && (
              <>
                {" "}· cost so far {formatMoney(running.actualCost)}
                {runningBreakdown.length > 0 && (
                  <span className="text-slate-500"> ({runningBreakdown.map((r) => `${r.roleName} ${r.manDaysEquivalent.toFixed(1)}md`).join(", ")})</span>
                )}
              </>
            )}
          </p>
        </div>
      )}

      {!costHidden && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Budget Burn: PV vs EV vs AC</h3>
            <EvmLineChart data={chartData} />
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">SPI trend</h3>
            <SpiCpiChart data={spiData} />
          </div>
        </div>
      )}

      <h3 className="text-sm font-semibold text-slate-700">
        By closed sprint (from Delivery)
        {draftCount > 0 && <span className="ml-2 font-normal text-slate-400">· {draftCount} draft sprint{draftCount > 1 ? "s" : ""} not shown</span>}
      </h3>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="text-left text-xs font-medium text-slate-500 border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 font-medium w-36">Sprint</th>
                <th className="px-4 py-3 font-medium w-40">% Planned Complete (Cum.)</th>
                <th className="px-4 py-3 font-medium w-40">% Actual Complete (Cum.)</th>
                <th className="px-4 py-3 font-medium w-28">PV</th>
                <th className="px-4 py-3 font-medium w-28">EV</th>
                {!costHidden && <th className="px-4 py-3 font-medium w-48">AC (Cum.)</th>}
                {!costHidden && <th className="px-4 py-3 font-medium w-32">Margin (EV − AC)</th>}
                {!costHidden && <th className="px-4 py-3 font-medium w-24">SPI</th>}
              </tr>
            </thead>
            <tbody>
              {evm.map((e, i) => (
                <BudgetRow
                  key={closedSprints[i].id}
                  weekId={closedSprints[i].id}
                  sprintName={closedSprints[i].name}
                  evm={e}
                  roleBreakdown={roleBreakdowns[i]}
                  uncostedHours={evmSource[i].uncostedHours}
                  costHidden={costHidden}
                />
              ))}
            </tbody>
          </table>
        </div>
        {evm.length === 0 && (
          <p className="text-sm text-slate-400 p-4">
            {sprints.length === 0 ? "No sprints yet — create one on the Delivery tab's Sprints page." : "No closed sprints yet — rows appear here as sprints close."}
          </p>
        )}
      </div>
    </div>
  );
}
