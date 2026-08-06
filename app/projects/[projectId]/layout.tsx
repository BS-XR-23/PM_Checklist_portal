import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { HeaderBar } from "@/components/ui/header-bar";
import { NavTabs } from "@/components/ui/nav-tabs";
import { AppShell } from "@/components/layout/app-shell";
import { getProjectContext } from "@/lib/rbac";
import { canViewResourcing } from "@/lib/resourcing-rbac";

type Tab = { href: string; label: string; matchHrefs?: string[] };

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { projectId: string };
}) {
  // Independent lookups — run concurrently rather than as two serialized
  // round trips.
  const [project, { user, moduleAccess }] = await Promise.all([
    prisma.project.findUnique({ where: { id: params.projectId }, include: { wonFromPresales: { select: { id: true, name: true } } } }),
    // Coarse gate (404s if this user has no business being in this project
    // at all) plus every module's access level, computed once for nav
    // filtering. Each page still re-checks its own module access
    // independently — this is UX filtering, not the enforcement boundary.
    getProjectContext(params.projectId),
  ]);
  if (!project || project.deletedAt) notFound();

  const canSeeTeam = user.role === "ADMIN" || user.role === "TPM" || user.role === "PM";
  const canSeeActivity = user.role === "ADMIN" || user.role === "TPM" || user.role === "PM";
  const canSeeResourcing = canViewResourcing(user.role);
  // Same ADMIN/TPM/PM scope as canSeeTeam/canSeeActivity above — never
  // CLIENT/LIMITED, who have no access to the opportunity this would link
  // to. PROGRAM_MANAGER is omitted too: that role never reaches this layout
  // at all (computeProjectAccess always denies it — portfolio-only, see
  // lib/rbac-core.ts), so there's nothing to gate here for it.
  const canSeePresalesOrigin = user.role === "ADMIN" || user.role === "TPM" || user.role === "PM";

  // Checklist / Risk & CR / Team are each a merge of two modules that used
  // to be separate tabs — visible if EITHER half is; the page itself (via
  // components/ui/sub-nav.tsx) only shows the half(s) the viewer can reach.
  const visibleTabs: Tab[] = [{ href: "/dashboard", label: "Dashboard" }];
  if (moduleAccess.PM_CHECKLIST !== "NONE" || moduleAccess.DEVOPS_CHECKLIST !== "NONE") {
    visibleTabs.push({ href: "/pm-checklist", label: "Checklist", matchHrefs: ["/devops-checklist"] });
  }
  if (moduleAccess.MILESTONES !== "NONE") visibleTabs.push({ href: "/milestones", label: "Milestones & Payments" });
  if (moduleAccess.RISK_REGISTER !== "NONE" || moduleAccess.CR_LOG !== "NONE") {
    visibleTabs.push({ href: "/risks", label: "Risk & CR", matchHrefs: ["/change-requests"] });
  }
  if (moduleAccess.BUDGET_TRACKER !== "NONE") visibleTabs.push({ href: "/budget", label: "Budget Tracker" });
  if (moduleAccess.PM_PLAN !== "NONE") visibleTabs.push({ href: "/pm-plan", label: "PM Plan" });
  if (moduleAccess.DECISION_LOG !== "NONE" || moduleAccess.ACTION_ITEMS !== "NONE") {
    visibleTabs.push({ href: "/decisions", label: "Decisions", matchHrefs: ["/action-items"] });
  }
  if (canSeeTeam || canSeeResourcing) {
    visibleTabs.push({ href: "/team", label: "Team", matchHrefs: ["/resourcing"] });
  }
  if (user.role === "TPM" || user.role === "ADMIN") {
    visibleTabs.push({ href: "/escalations", label: "Escalations" });
  }

  return (
    <AppShell user={user}>
      <div className="min-h-screen flex flex-col">
        <HeaderBar
          title={project.name}
          subtitle={project.client ?? undefined}
          activityHref={canSeeActivity ? `/projects/${project.id}/activity` : undefined}
          wonFromPresales={canSeePresalesOrigin ? project.wonFromPresales ?? undefined : undefined}
        />
        <NavTabs projectId={project.id} tabs={visibleTabs} />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </AppShell>
  );
}
