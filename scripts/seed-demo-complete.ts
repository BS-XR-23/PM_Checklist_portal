// Marks the "[DEMO]" project's full lifecycle as complete: every PM +
// DevOps checklist item COMPLETED with demo owner/dates/notes, every
// milestone paid & signed off, the demo risk closed, and a WBS tracking
// history (Delivery tab) that ends at 100% complete, on schedule, slightly
// under cost — Budget Tracker derives SPI/CPI from this live, so the
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

  // Sprint tracking (Delivery tab) — one closed sprint, fully done, ~5%
  // under cost — Budget Tracker derives SPI/CPI from this live, so seeding
  // it here is what makes the Dashboard/Portfolio show Green. Coarser than
  // the old per-week narrative (Budget Tracker's chart is now one point
  // per sprint, not per week) — a single representative closed sprint
  // rather than faking a multi-point trend across sprints that would
  // otherwise need each task to be committed then abandoned partway.
  const demoRoleRate = await prisma.roleRate.upsert({
    where: { roleName: "[DEMO] Developer" },
    update: {},
    create: { roleName: "[DEMO] Developer", manDayRate: (demoProject.contractValue / demoProject.plannedManDays) * 0.95 },
  });
  await prisma.person.updateMany({ where: { id: { in: demoPeople.map((p) => p.id) } }, data: { roleRateId: demoRoleRate.id } });

  await prisma.wbsTask.deleteMany({ where: { projectId: demoProject.id } });
  await prisma.sprint.deleteMany({ where: { projectId: demoProject.id } });

  const taskStoryPoints = [25, 25, 20, 20]; // sums to plannedStoryPoints (90)
  await prisma.project.update({ where: { id: demoProject.id }, data: { plannedStoryPoints: taskStoryPoints.reduce((a, b) => a + b, 0) } });

  const sprint = await prisma.sprint.create({
    data: { projectId: demoProject.id, name: "[DEMO] Sprint 1", startDate: daysAgo(21), endDate: daysAgo(7) },
  });

  // 1 story point ~ 1 actual man-day (8 hours) for this demo — actualHours
  // is what a PM would manually type in from checking Jira in real use.
  const tasks = await Promise.all(
    taskStoryPoints.map((storyPoints, i) =>
      prisma.wbsTask.create({
        data: {
          projectId: demoProject.id,
          wbsNumber: String(i + 1),
          title: `Demo workstream ${i + 1}`,
          storyPoints,
          personId: demoPeople[i % demoPeople.length].id,
          personName: demoPeople[i % demoPeople.length].name,
          sprintId: sprint.id,
          pctComplete: 1,
          actualHours: storyPoints * 8,
          competencyMultiplier: 1,
        },
      })
    )
  );

  const plannedValue = tasks.reduce((sum, t) => sum + t.storyPoints, 0);
  const earnedValue = tasks.reduce((sum, t) => sum + (t.pctComplete >= 1 ? t.storyPoints : 0), 0);
  const actualValue = tasks.reduce((sum, t) => sum + (t.actualHours / 8) * t.competencyMultiplier, 0);
  const frozenTaskSnapshot = tasks.map((t) => ({
    taskId: t.id,
    wbsNumber: t.wbsNumber,
    title: t.title,
    storyPoints: t.storyPoints,
    pctComplete: t.pctComplete,
  }));

  await prisma.sprint.update({
    where: { id: sprint.id },
    data: {
      closedAt: new Date(),
      frozenPlannedPoints: plannedValue,
      frozenEarnedPoints: earnedValue,
      frozenActualValue: actualValue,
      frozenTaskSnapshot,
    },
  });

  console.log(`Wrote 1 closed demo sprint at 100% complete, SPI 1.0 / CPI ~1.05.`);

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
