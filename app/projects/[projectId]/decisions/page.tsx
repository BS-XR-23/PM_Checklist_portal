import { notFound } from "next/navigation";
import clsx from "clsx";
import { prisma } from "@/lib/prisma";
import { getModuleAccess } from "@/lib/rbac";
import { ActionItemsList } from "./action-items-list";
import { DecisionTimeline } from "./decision-timeline";

/**
 * Decisions & action items on one page — they come out of the same calls
 * and meetings. Each half is still its own module (DECISION_LOG /
 * ACTION_ITEMS) with its own access level; a viewer sees only the half (or
 * halves) they can reach. /action-items redirects here.
 */
export default async function DecisionsPage({ params }: { params: { projectId: string } }) {
  const [decisionAccess, actionAccess] = await Promise.all([
    getModuleAccess(params.projectId, "DECISION_LOG"),
    getModuleAccess(params.projectId, "ACTION_ITEMS"),
  ]);
  if (decisionAccess === "NONE" && actionAccess === "NONE") notFound();
  const canWriteDecisions = decisionAccess === "WRITE";
  const canWriteActions = actionAccess === "WRITE";

  const [rawDecisions, rawActions, people] = await Promise.all([
    decisionAccess !== "NONE"
      ? prisma.decisionLogItem.findMany({
          where: { projectId: params.projectId },
          orderBy: { order: "asc" },
          include: { decidedByPerson: { select: { id: true, name: true } } },
        })
      : Promise.resolve([]),
    actionAccess !== "NONE"
      ? prisma.actionItem.findMany({
          where: { projectId: params.projectId },
          orderBy: { order: "asc" },
          include: { ownerPerson: { select: { id: true, name: true } } },
        })
      : Promise.resolve([]),
    canWriteActions ? prisma.person.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  const decisions = rawDecisions.map((d) => ({ ...d, decidedByPersonName: d.decidedByPerson?.name ?? null }));
  const actions = rawActions.map((a) => ({ ...a, ownerPersonName: a.ownerPerson?.name ?? null }));
  const both = decisionAccess !== "NONE" && actionAccess !== "NONE";

  return (
    <div className={clsx("grid grid-cols-1 gap-6 items-start", both && "xl:grid-cols-5")}>
      {actionAccess !== "NONE" && (
        <div className={clsx(both && "xl:col-span-2")}>
          <ActionItemsList projectId={params.projectId} items={actions} canWrite={canWriteActions} people={people} />
        </div>
      )}
      {decisionAccess !== "NONE" && (
        <div className={clsx(both && "xl:col-span-3")}>
          <DecisionTimeline projectId={params.projectId} items={decisions} canWrite={canWriteDecisions} />
        </div>
      )}
    </div>
  );
}
