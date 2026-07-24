import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  PM_CHECKLIST_SEED,
  DEVOPS_CHECKLIST_SEED,
  DEFAULT_STAKEHOLDER_ROWS,
  DEFAULT_COMMS_ROWS,
  DEFAULT_RACI_ROWS,
} from "@/lib/seed-data";

/**
 * Creates a new project and a fresh instance of all 8 modules: the two
 * checklists (with their fixed milestone tags), the milestone/payment rows
 * derived from them, and a PM Plan pre-populated with the template's default
 * stakeholder/comms/RACI rows. Risk Register, CR Log, and Budget Tracker
 * start empty since the spreadsheet has no default rows for those.
 *
 * IDs are pre-generated and every table is written with a single `createMany`
 * call (instead of one `create()` per row) so the whole thing is ~7 database
 * round-trips instead of ~90 — this matters over a pooled connection to a
 * remote DB (e.g. Supabase), where an interactive transaction that holds the
 * connection open across dozens of sequential round-trips is prone to being
 * recycled mid-transaction ("Transaction not found").
 */
export async function createProject(input: { name: string; client?: string; contractValue?: number; plannedManDays?: number; crRate?: number }) {
  return prisma.$transaction(
    async (tx) => {
      const project = await tx.project.create({
        data: {
          name: input.name,
          client: input.client || null,
          contractValue: input.contractValue ?? 0,
          plannedManDays: input.plannedManDays ?? 0,
          crRate: input.crRate ?? 0,
        },
      });

      const checklistItems = [
        ...PM_CHECKLIST_SEED.map((item) => ({ ...item, type: "PM" as const })),
        ...DEVOPS_CHECKLIST_SEED.map((item) => ({ ...item, type: "DEVOPS" as const })),
      ].map((item) => ({
        id: randomUUID(),
        projectId: project.id,
        type: item.type,
        order: item.order,
        stage: item.stage,
        itemText: item.itemText,
        milestoneName: item.milestoneName,
      }));

      await tx.checklistItem.createMany({ data: checklistItems });

      const milestoneItems = checklistItems.filter((item) => item.milestoneName);
      if (milestoneItems.length > 0) {
        await tx.milestonePayment.createMany({
          data: milestoneItems.map((item) => ({ checklistItemId: item.id })),
        });
      }

      const pmPlanId = randomUUID();
      await tx.pMPlan.create({ data: { id: pmPlanId, projectId: project.id } });

      await tx.stakeholderRow.createMany({
        data: DEFAULT_STAKEHOLDER_ROWS.map((row, i) => ({ ...row, pmPlanId, order: i })),
      });
      await tx.commsRow.createMany({
        data: DEFAULT_COMMS_ROWS.map((row, i) => ({ ...row, pmPlanId, order: i })),
      });
      await tx.raciRow.createMany({
        data: DEFAULT_RACI_ROWS.map((row, i) => ({ ...row, pmPlanId, order: i })),
      });

      return project;
    },
    { timeout: 20000 }
  );
}
