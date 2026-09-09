import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { HeaderBar } from "@/components/ui/header-bar";
import { NavTabs } from "@/components/ui/nav-tabs";
import { AppShell } from "@/components/layout/app-shell";
import { getProjectContext } from "@/lib/rbac";
import { canViewResourcing } from "@/lib/resourcing-rbac";
import { CHECKLIST_TYPES, CHECKLIST_TYPE_BY_KEY } from "@/lib/checklist-types";

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
  // Development Checklist (DEV) is deliberately excluded from this rotation
  // — it's reached only from within Delivery, not the general Checklist tab.
  const generalChecklistTypes = CHECKLIST_TYPES.filter((c) => c.inGeneralChecklistNav);
  if (generalChecklistTypes.some((c) => moduleAccess[c.moduleName] !== "NONE")) {
    visibleTabs.push({
      href: `/checklist/${CHECKLIST_TYPE_BY_KEY.PM.routeSegment}`,
      label: "Checklist",
      matchHrefs: generalChecklistTypes.filter((c) => c.key !== "PM").map((c) => `/checklist/${c.routeSegment}`),
    });
  }
  if (moduleAccess.MILESTONES !== "NONE") visibleTabs.push({ href: "/milestones", label: "Milestones & Payments" });
  if (moduleAccess.RISK_REGISTER !== "NONE" || moduleAccess.CR_LOG !== "NONE") {
    visibleTabs.push({ href: "/risks", label: "Risk & CR", matchHrefs: ["/change-requests"] });
  }
  if (moduleAccess.DEPENDENCIES !== "NONE") visibleTabs.push({ href: "/dependencies", label: "Dependencies" });
  if (moduleAccess.BUDGET_TRACKER !== "NONE") visibleTabs.push({ href: "/budget", label: "Budget Tracker" });
  // Delivery is the merge of DELIVERY (Overview/Tasks/Sprints/Milestones)
  // plus the new DEV_CHECKLIST/RELEASE/UAT modules — visible if any one of
  // them is, same "the page itself only shows the sub-tab(s) you can reach"
  // pattern as Checklist/Risk & CR/Team above. Deliberately does NOT include
  // MILESTONES: "Milestones & Payments" above is a separate, unrelated
  // feature (payment tranches tied to checklist sign-off) from Delivery's
  // own Milestones sub-tab (development checkpoints) — different goals, not
  // to be conflated in nav or gating.
  if ((["DELIVERY", "DEV_CHECKLIST", "RELEASE", "UAT"] as const).some((m) => moduleAccess[m] !== "NONE")) {
    visibleTabs.push({
      href: "/delivery",
      label: "Delivery",
      matchHrefs: ["/delivery/tasks", "/delivery/sprints", "/delivery/milestones", "/delivery/checklist", "/delivery/releases", "/delivery/uat"],
    });
  }
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
