import { prisma } from "@/lib/prisma";
import { getCurrentUser, getModuleAccess } from "@/lib/rbac";
import { CHECKLIST_TYPES } from "@/lib/checklist-types";
import { canViewQms } from "@/lib/qms";

/** The Checklist tab's sub-nav: the checklists this viewer can open, plus QMS Audit when allowed. */
export async function checklistSubNavOptions(projectId: string) {
  const generalTypes = CHECKLIST_TYPES.filter((c) => c.inGeneralChecklistNav);
  const [accesses, counts, user, pmAccess] = await Promise.all([
    Promise.all(generalTypes.map((c) => getModuleAccess(projectId, c.moduleName))),
    prisma.checklistItem.groupBy({ by: ["type"], where: { projectId }, _count: true }),
    getCurrentUser(),
    getModuleAccess(projectId, "PM_CHECKLIST"),
  ]);
  const countByType = new Map(counts.map((c) => [c.type, c._count]));

  const options: { href: string; label: string; count?: number }[] = generalTypes
    .filter((_, i) => accesses[i] !== "NONE")
    .map((c) => ({ href: `/checklist/${c.routeSegment}`, label: c.label, count: countByType.get(c.key) ?? 0 }));

  if (user && canViewQms(user.role) && pmAccess !== "NONE") options.push({ href: "/checklist/qms", label: "QMS Audit" });
  return options;
}
