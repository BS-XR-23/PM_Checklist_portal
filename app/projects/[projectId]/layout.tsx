import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { HeaderBar } from "@/components/ui/header-bar";
import { NavTabs } from "@/components/ui/nav-tabs";
import { AppShell } from "@/components/layout/app-shell";
import { getProjectContext } from "@/lib/rbac";
import { canViewResourcing } from "@/lib/resourcing-rbac";
import type { ModuleName } from "@prisma/client";

const MODULE_TABS: { href: string; label: string; module: ModuleName }[] = [
  { href: "/dashboard", label: "Dashboard", module: "DASHBOARD" },
  { href: "/pm-checklist", label: "PM Checklist", module: "PM_CHECKLIST" },
  { href: "/devops-checklist", label: "DevOps Checklist", module: "DEVOPS_CHECKLIST" },
  { href: "/milestones", label: "Milestones & Payments", module: "MILESTONES" },
  { href: "/risks", label: "Risk Register", module: "RISK_REGISTER" },
  { href: "/change-requests", label: "CR Log", module: "CR_LOG" },
  { href: "/budget", label: "Budget Tracker", module: "BUDGET_TRACKER" },
  { href: "/pm-plan", label: "PM Plan", module: "PM_PLAN" },
];

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { projectId: string };
}) {
  const project = await prisma.project.findUnique({ where: { id: params.projectId } });
  if (!project) notFound();

  // Coarse gate (404s if this user has no business being in this project at
  // all) plus every module's access level, computed once for nav filtering.
  // Each page still re-checks its own module access independently — this is
  // UX filtering, not the enforcement boundary.
  const { user, moduleAccess } = await getProjectContext(params.projectId);

  const visibleTabs = MODULE_TABS.filter((t) => moduleAccess[t.module] !== "NONE");

  const canSeeTeam = user.role === "ADMIN" || user.role === "TPM" || user.role === "PM";
  const canSeeActivity = user.role === "ADMIN" || user.role === "TPM" || user.role === "PM";
  const canSeeResourcing = canViewResourcing(user.role);
  if (canSeeTeam) visibleTabs.push({ href: "/team", label: "Team", module: "DASHBOARD" });
  if (canSeeResourcing) visibleTabs.push({ href: "/resourcing", label: "Resourcing", module: "DASHBOARD" });
  if (canSeeActivity) visibleTabs.push({ href: "/activity", label: "Activity", module: "DASHBOARD" });
  if (user.role === "TPM" || user.role === "ADMIN") {
    visibleTabs.push({ href: "/escalations", label: "Escalations", module: "DASHBOARD" });
  }

  return (
    <AppShell user={user}>
      <div className="min-h-screen flex flex-col">
        <HeaderBar title={project.name} subtitle={project.client ?? undefined} />
        <NavTabs projectId={project.id} tabs={visibleTabs} />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </AppShell>
  );
}
