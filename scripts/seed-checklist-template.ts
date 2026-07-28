// One-time migration: copies the hardcoded PM_CHECKLIST_SEED/DEVOPS_CHECKLIST_SEED
// arrays (lib/seed-data.ts) into the new ChecklistTemplateItem table, so the
// Admin "Checklist Template" page starts in sync with what's live today.
// Safe to re-run against an empty table; will fail on the unique constraint
// if rows already exist (by design — this isn't meant to be run twice).
import { PrismaClient } from "@prisma/client";
import { PM_CHECKLIST_SEED, DEVOPS_CHECKLIST_SEED } from "../lib/seed-data";

const prisma = new PrismaClient();

async function main() {
  const rows = [
    ...PM_CHECKLIST_SEED.map((item) => ({ ...item, type: "PM" })),
    ...DEVOPS_CHECKLIST_SEED.map((item) => ({ ...item, type: "DEVOPS" })),
  ];

  const { count } = await prisma.checklistTemplateItem.createMany({ data: rows });
  console.log(`Seeded ${count} checklist template items (${PM_CHECKLIST_SEED.length} PM, ${DEVOPS_CHECKLIST_SEED.length} DevOps).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
