// One-time migration: copies the hardcoded *_CHECKLIST_SEED arrays
// (lib/seed-data.ts) into the new ChecklistTemplateItem table, so the
// Admin "Checklist Template" page starts in sync with what's live today.
// Safe to re-run against an empty table; will fail on the unique constraint
// if rows already exist (by design — this isn't meant to be run twice).
import { PrismaClient } from "@prisma/client";
import {
  PM_CHECKLIST_SEED,
  ENGINEERING_CHECKLIST_SEED,
  QA_CHECKLIST_SEED,
  DEVOPS_CHECKLIST_SEED,
  CREATIVE_XR_CHECKLIST_SEED,
} from "../lib/seed-data";

const prisma = new PrismaClient();

async function main() {
  const seeds = [
    ["PM", PM_CHECKLIST_SEED],
    ["ENGINEERING", ENGINEERING_CHECKLIST_SEED],
    ["QA", QA_CHECKLIST_SEED],
    ["DEVOPS", DEVOPS_CHECKLIST_SEED],
    ["CREATIVE_XR", CREATIVE_XR_CHECKLIST_SEED],
  ] as const;
  const rows = seeds.flatMap(([type, items]) => items.map((item) => ({ ...item, type })));

  const { count } = await prisma.checklistTemplateItem.createMany({ data: rows });
  console.log(`Seeded ${count} checklist template items (${seeds.map(([type, items]) => `${items.length} ${type}`).join(", ")}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
