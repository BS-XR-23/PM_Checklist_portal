import { prisma } from "@/lib/prisma";
import { requireModuleAccess } from "@/lib/rbac";
import { IconClock, IconCheckCircle, IconAlertTriangle, IconClipboardList } from "@/components/layout/icons";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { AddDependencyButton } from "./add-dependency-button";
import { DependencyTable } from "./dependency-table";

function DependencyStatCard({
  label,
  value,
  subtitle,
  valueColor,
  icon,
  iconWrapClass,
}: {
  label: string;
  value: string;
  subtitle?: string;
  valueColor?: string;
  icon: React.ReactNode;
  iconWrapClass: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-2xl font-bold leading-tight" style={{ color: valueColor }}>
          {value}
        </p>
        {subtitle && (
          <p className="text-xs mt-0.5" style={{ color: valueColor }}>
            {subtitle}
          </p>
        )}
      </div>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${iconWrapClass}`}>
        <span className="h-5 w-5 [&>svg]:h-5 [&>svg]:w-5">{icon}</span>
      </span>
    </div>
  );
}

export default async function DependenciesPage({ params }: { params: { projectId: string } }) {
  const access = await requireModuleAccess(params.projectId, "DEPENDENCIES", "READ_LIMITED");
  const canWrite = access === "WRITE";

  const rows = await prisma.dependencyItem.findMany({
    where: { projectId: params.projectId },
    orderBy: { order: "asc" },
  });

  const total = rows.length;
  const doneCount = rows.filter((d) => d.status === "Done").length;
  const dueCount = rows.filter((d) => d.status === "Due").length;
  const blockedCount = rows.filter((d) => d.status === "Blocked").length;
  const pct = (n: number) => (total ? `${Math.round((n / total) * 100)}%` : undefined);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-1.5 text-base font-semibold text-slate-900">
            Dependency Tracker
            <InfoTooltip text="Due = waiting, on track. Blocked = stuck on something outside the delivery team's control. Done = received. Expected Date drives the days-remaining countdown in the table." />
          </h2>
          <p className="text-sm text-slate-500">Track items or approvals this project is waiting on from external teams or third parties.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={`/api/projects/${params.projectId}/dependencies/export`}
            className="rounded-md border border-slate-300 text-slate-700 text-sm font-medium px-4 py-2 hover:bg-slate-50"
          >
            Export .xlsx
          </a>
          {canWrite && <AddDependencyButton projectId={params.projectId} />}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <DependencyStatCard label="Total Dependencies" value={String(total)} icon={<IconClipboardList />} iconWrapClass="bg-blue-50 text-blue-600" />
        <DependencyStatCard
          label="Due"
          value={String(dueCount)}
          subtitle={pct(dueCount)}
          valueColor="#7A5B00"
          icon={<IconClock />}
          iconWrapClass="bg-amber-50 text-amber-600"
        />
        <DependencyStatCard
          label="Blocked"
          value={String(blockedCount)}
          subtitle={pct(blockedCount)}
          valueColor="#7A0000"
          icon={<IconAlertTriangle />}
          iconWrapClass="bg-rose-50 text-rose-600"
        />
        <DependencyStatCard
          label="Done"
          value={String(doneCount)}
          subtitle={pct(doneCount)}
          valueColor="#2C5F2D"
          icon={<IconCheckCircle />}
          iconWrapClass="bg-emerald-50 text-emerald-600"
        />
      </div>

      <DependencyTable projectId={params.projectId} canWrite={canWrite} rows={rows} />
    </div>
  );
}
