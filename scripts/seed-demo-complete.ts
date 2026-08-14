// Marks the "[DEMO]" project's full lifecycle as complete: every PM +
// DevOps checklist item COMPLETED with demo owner/dates/notes, every
// milestone paid & signed off, the demo risk closed, and a budget history
// that ends at 100% complete, on schedule, slightly under cost — so the
// Dashboard/Portfolio show a clean, finished, "Green" project for a demo
// walkthrough. Only touches rows already created by `npm run seed-demo`.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

async function main() {
  const demoProject = await prisma.project.findFirst({
    where: { name: { startsWith: "[DEMO]" } },
    orderBy: { createdAt: "desc" },
  });
  if (!demoProject) {
    console.error('No "[DEMO]" project found — run `npm run seed-demo` first.');
    process.exit(1);
  }
  console.log(`Completing "${demoProject.name}" (${demoProject.id})`);

  const demoPeople = await prisma.person.findMany({ where: { name: { startsWith: "[DEMO]" } }, orderBy: { name: "asc" } });
  if (demoPeople.length === 0) {
    console.error('No "[DEMO]" people found — run `npm run seed-demo` first.');
    process.exit(1);
  }

  const items = await prisma.checklistItem.findMany({
    where: { projectId: demoProject.id },
    orderBy: [{ type: "asc" }, { order: "asc" }],
  });

  // Space completion dates out over the last ~90 days so the checklist looks
  // like a real, gradually-completed timeline rather than everything on one
  // day. Sequential (not Promise.all) — firing dozens of concurrent requests
  // exhausts the pooled connection ("Can't reach database server").
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const completedOn = daysAgo(90 - Math.round((i / items.length) * 85));
    const owner = demoPeople[i % demoPeople.length];
    await prisma.checklistItem.update({
      where: { id: item.id },
      data: {
        status: "COMPLETED",
        ownerPersonId: owner.id,
        plannedDate: completedOn,
        actualDate: completedOn,
        notes: item.notes ?? "Completed — demo walkthrough data.",
      },
    });
  }
  console.log(`Marked ${items.length} checklist items COMPLETED with demo owners/dates.`);

  const milestonePayments = await prisma.milestonePayment.findMany({
    where: { checklistItem: { projectId: demoProject.id } },
  });
  const evenSharePct = milestonePayments.length > 0 ? 1 / milestonePayments.length : 0;
  for (const mp of milestonePayments) {
    await prisma.milestonePayment.update({
      where: { id: mp.id },
      data: { paymentPct: evenSharePct, invoiceStatus: "Paid", clientSignoff: "Signed", notes: "Paid — demo walkthrough data." },
    });
  }
  console.log(`Marked ${milestonePayments.length} milestone payments Paid/Signed (${(evenSharePct * 100).toFixed(1)}% each).`);

  const demoRisks = await prisma.riskItem.findMany({ where: { projectId: demoProject.id, status: "Open" } });
  for (const r of demoRisks) {
    await prisma.riskItem.update({
      where: { id: r.id },
      data: { status: "Mitigated", dateClosed: daysAgo(10), notes: "Mitigated during development — demo walkthrough data." },
    });
  }
  console.log(`Closed ${demoRisks.length} open risk(s).`);

  // Weekly budget history climbing to 100% complete, on schedule, ~5% under cost.
  const weeks = [0.25, 0.5, 0.75, 1.0];
  await prisma.budgetEntry.deleteMany({ where: { projectId: demoProject.id } });
  await prisma.budgetEntry.createMany({
    data: weeks.map((pct, i) => ({
      projectId: demoProject.id,
      weekEnding: daysAgo((weeks.length - 1 - i) * 21),
      pctPlannedComplete: pct,
      pctActualComplete: pct,
      actualCost: demoProject.contractValue * pct * 0.95,
      notes: i === weeks.length - 1 ? "Project complete — demo walkthrough data." : undefined,
    })),
  });
  console.log(`Wrote ${weeks.length} budget entries ending at 100% complete, SPI 1.0 / CPI ~1.05.`);

  console.log(`\nDone. Dashboard: /projects/${demoProject.id}/dashboard — should now show Green on /portfolio.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
