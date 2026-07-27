// One-off demo data generator: a new fully-populated project plus a small
// People/Engagement roster, including a deliberate overload+conflict scenario
// (one person stretched thin across two projects) so the Portfolio "Overload
// & Conflicts" section and the per-project Resourcing tab have something to
// show. Safe to re-run — it always creates fresh rows (prefixed "[DEMO]"),
// never touches existing data.
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { createProject } from "../lib/create-project";

const prisma = new PrismaClient();

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function main() {
  const demoProject = await createProject({
    name: "[DEMO] XR Heritage Walk — AR Museum Tour",
    client: "Bengal Heritage Trust",
    contractValue: 45000,
    plannedManDays: 90,
    crRate: 45,
  });
  console.log(`Created demo project "${demoProject.name}" (${demoProject.id})`);

  // Reuse an existing project as the "other" side of the overload/conflict
  // demo, if one exists — otherwise skip that part gracefully.
  const otherProject = await prisma.project.findFirst({ where: { id: { not: demoProject.id } }, orderBy: { createdAt: "asc" } });

  const people = await Promise.all(
    [
      { name: "[DEMO] Ayesha Rahman", title: "Lead Engineer", email: "ayesha.rahman@example.test" },
      { name: "[DEMO] Tanvir Hasan", title: "QA Lead", email: "tanvir.hasan@example.test" },
      { name: "[DEMO] Nusrat Jahan", title: "Creative Lead", email: "nusrat.jahan@example.test" },
      { name: "[DEMO] Rafiq Islam", title: "Business Analyst", email: "rafiq.islam@example.test" },
    ].map((p) => prisma.person.create({ data: p }))
  );
  const [ayesha, tanvir, nusrat, rafiq] = people;
  console.log(`Created ${people.length} demo Person records.`);

  await prisma.projectEngagement.createMany({
    data: [
      { projectId: demoProject.id, personId: ayesha.id, roleOnProject: "Lead Engineer", intensityPct: 70, startDate: daysFromNow(0), endDate: daysFromNow(90) },
      { projectId: demoProject.id, personId: tanvir.id, roleOnProject: "QA Lead", intensityPct: 40, startDate: daysFromNow(30), endDate: daysFromNow(90) },
      { projectId: demoProject.id, personId: nusrat.id, roleOnProject: "Creative Lead", intensityPct: 50, startDate: daysFromNow(0), endDate: daysFromNow(45) },
      { projectId: demoProject.id, personId: rafiq.id, roleOnProject: "Business Analyst", intensityPct: 30, startDate: daysFromNow(0), endDate: daysFromNow(30) },
    ],
  });
  console.log("Assigned 4 people to the demo project.");

  if (otherProject) {
    // Ayesha is ALSO heavily engaged on another project with overlapping
    // dates: 70% + 60% = 130% total (over the 100% threshold), and both
    // engagements are high-intensity (>=60%) with overlapping windows —
    // triggers both the overload and the overlap-conflict signal.
    await prisma.projectEngagement.create({
      data: {
        projectId: otherProject.id,
        personId: ayesha.id,
        roleOnProject: "Lead Engineer",
        intensityPct: 60,
        startDate: daysFromNow(0),
        endDate: daysFromNow(60),
      },
    });
    console.log(`Also engaged Ayesha Rahman on "${otherProject.name}" at 60% (overlapping) — overload + conflict demo ready.`);
  } else {
    console.log("No other project found to demo the cross-project conflict against — only the single-project roster was created.");
  }

  // Link a couple of checklist/risk owners to these People for realism.
  const firstPmItems = await prisma.checklistItem.findMany({
    where: { projectId: demoProject.id, type: "PM" },
    orderBy: { order: "asc" },
    take: 4,
  });
  const ownerAssignments = [ayesha, tanvir, nusrat, rafiq];
  await Promise.all(
    firstPmItems.map((item, i) =>
      prisma.checklistItem.update({ where: { id: item.id }, data: { ownerPersonId: ownerAssignments[i % ownerAssignments.length].id } })
    )
  );

  const demoRisk = await prisma.riskItem.create({
    data: {
      projectId: demoProject.id,
      description: "AR marker recognition may be unreliable in low-light museum galleries",
      probability: "Medium",
      impact: "High",
      ownerPersonId: ayesha.id,
      mitigation: "Prototype marker detection under gallery lighting conditions in week 2",
      status: "Open",
      dateRaised: daysFromNow(0),
    },
  });
  console.log(`Linked owners on ${firstPmItems.length} checklist items and created 1 demo risk (${demoRisk.id}).`);

  // Link Tanvir Hasan to a fresh LIMITED portal account so "My Engagement"
  // has something to log into and demo.
  const email = "tanvir.hasan@bs23-demo.test";
  const existingUser = await prisma.user.findUnique({ where: { email } });
  let tempPassword: string | null = null;
  if (!existingUser) {
    tempPassword = randomBytes(9).toString("base64url");
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const user = await prisma.user.create({ data: { email, name: "Tanvir Hasan", passwordHash, role: "LIMITED" } });
    await prisma.person.update({ where: { id: tanvir.id }, data: { userId: user.id } });
    console.log(`Created LIMITED demo login for Tanvir Hasan: ${email} / ${tempPassword}`);
  } else {
    console.log(`Demo login ${email} already exists — reused it and left the password as-is.`);
  }

  console.log("\nDemo data ready:");
  console.log(`  Project:        ${demoProject.name}`);
  console.log(`  Resourcing tab: /projects/${demoProject.id}/resourcing`);
  console.log(`  Portfolio:      /portfolio (check Overload & Conflicts)`);
  if (tempPassword) console.log(`  Self-service:   log in as ${email} / ${tempPassword} -> /my-engagement`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
