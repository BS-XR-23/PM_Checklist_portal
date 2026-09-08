import { redirect } from "next/navigation";
import { requireUser } from "@/lib/rbac";
import { getReminderItems, getReminderTrend } from "@/lib/notifications";
import { AppShell } from "@/components/layout/app-shell";
import { HeaderBar } from "@/components/ui/header-bar";
import { StatTile } from "@/components/ui/stat-tile";
import { IconBell, IconAlertTriangle, IconClock, IconGrid } from "@/components/layout/icons";
import { ReminderFilters } from "./reminder-filters";

export const dynamic = "force-dynamic";

function trend(delta: number) {
  if (delta === 0) return <span className="text-slate-400">No change since last week</span>;
  const good = delta < 0;
  return <span className={good ? "text-emerald-600" : "text-rose-600"}>{delta < 0 ? "↓" : "↑"} {Math.abs(delta)} since last week</span>;
}

export default async function NotificationsPage() {
  const user = await requireUser();

  // Same role scope as lib/notifications.ts / the sidebar badge — Program
  // Manager stays aggregate-only (Portfolio), Client/Limited never see
  // item-level reminders.
  if (user.role !== "ADMIN" && user.role !== "TPM" && user.role !== "PM") {
    redirect("/projects");
  }

  const [items, trendData] = await Promise.all([getReminderItems(user), getReminderTrend(user)]);
  const overdueCount = items.filter((r) => r.band === "OVERDUE").length;
  const dueSoonCount = items.filter((r) => r.band === "DUE_SOON").length;
  // Presales reminders have no projectId — they're not a project's problem,
  // so they're excluded from this count rather than counted as one.
  const projectsAffected = new Set(items.map((r) => r.projectId).filter((id): id is string => !!id)).size;

  return (
    <AppShell user={user}>
      <HeaderBar
        title="Reminders"
        subtitle="Track your pending checklist items, action items, and presales opportunities — organized by project."
        activityHref={user.role === "ADMIN" ? "/admin/audit-log" : undefined}
      />

      <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatTile
            icon={<IconBell />}
            iconWrapClass="bg-blue-50 text-blue-600"
            label="Total Reminders"
            value={String(items.length)}
            subtitle={trend(trendData.totalDelta)}
          />
          <StatTile
            icon={<IconAlertTriangle />}
            iconWrapClass="bg-rose-50 text-rose-600"
            label="Overdue"
            value={String(overdueCount)}
            valueColor="#C00000"
            subtitle={trend(trendData.overdueDelta)}
          />
          <StatTile
            icon={<IconClock />}
            iconWrapClass="bg-amber-50 text-amber-600"
            label="Due Soon"
            value={String(dueSoonCount)}
            valueColor="#7A5B00"
            subtitle={trend(trendData.dueSoonDelta)}
          />
          <StatTile
            icon={<IconGrid />}
            iconWrapClass="bg-violet-50 text-violet-600"
            label="Projects Affected"
            value={String(projectsAffected)}
            subtitle={`Across ${projectsAffected} project${projectsAffected === 1 ? "" : "s"}`}
          />
        </div>

        <ReminderFilters items={items} />
      </main>
    </AppShell>
  );
}
