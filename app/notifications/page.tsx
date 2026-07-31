import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/rbac";
import { getReminderItems } from "@/lib/notifications";
import { RISK_SEVERITY_COLORS } from "@/lib/colors";
import { formatDate } from "@/lib/format";
import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireUser();

  // Same role scope as lib/notifications.ts / the sidebar badge — Program
  // Manager stays aggregate-only (Portfolio), Client/Limited never see
  // item-level reminders.
  if (user.role !== "ADMIN" && user.role !== "TPM" && user.role !== "PM") {
    redirect("/projects");
  }

  const items = await getReminderItems(user);

  return (
    <AppShell user={user}>
      <header className="border-b border-slate-200 bg-white px-4 sm:px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Reminders</h1>
        <p className="text-sm text-slate-500">
          Checklist items and action items across your projects that are overdue or due within the next 7 days.
        </p>
      </header>

      <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing overdue or due soon — you&apos;re caught up.</p>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-50">
            {items.map((r, i) => {
              const color = r.band === "OVERDUE" ? RISK_SEVERITY_COLORS.high : RISK_SEVERITY_COLORS.medium;
              return (
                <Link
                  key={i}
                  href={`/projects/${r.projectId}/${r.route}`}
                  prefetch={false}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-slate-800 truncate">{r.itemText}</p>
                    <p className="text-xs text-slate-400">
                      {r.projectName} · {r.context} · {r.source === "ACTION_ITEM" ? "Due" : "Planned"} {formatDate(r.plannedDate)}
                    </p>
                  </div>
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0"
                    style={{ backgroundColor: color.bg, color: color.text }}
                  >
                    {r.band === "OVERDUE" ? "Overdue" : "Due Soon"}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </AppShell>
  );
}
