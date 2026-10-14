// Phase 3 data cleanup (docs/FIX_PLAN.md). Until Phase 3, every checklist
// item tagged with a milestone name (an internal "gate") was copied into a
// Milestone row plus an empty MilestonePayment row — by the 2026-09-09
// backfill migration and by createProject() for every new project. Those
// copies duplicate the checklist instead of describing what the project
// delivers to the client.
//
// This script finds the copies (via the gate link ChecklistItem.milestoneId)
// and sorts them:
//   KEEP   — the copy carries real data someone entered: a payment tranche,
//            invoice/sign-off progress, payment notes, edits after creation,
//            links to WBS/sprints/releases/UAT/other milestones, or fields
//            only a person sets (non-default type, description, criteria,
//            forecast). It stays as a client milestone; its gate link stays.
//   DELETE — an untouched copy. The Milestone and its empty payment row are
//            removed; the checklist gate itself is never touched.
// Milestones that aren't gate copies (created from PM Plan or the new
// Milestones tab) are never touched.
//
// It also handles legacy payment rows with no milestone (from the old
// "+ Add Milestone"): re-homed onto a new Milestone if they hold real payment
// data, otherwise deleted.
//
// Usage:
//   npm run milestone-cleanup                                  # dry run — read-only report
//   npm run milestone-cleanup -- --project <projectId>         # dry run for one project
//   npm run milestone-cleanup -- --apply --actor you@bs23.com  # apply (all projects, or with --project)
//
// --apply writes one AuditLog row per project (attributed to --actor) whose
// diff holds every deleted row in full, so nothing is unrecoverable. Take a
// pg_dump backup first anyway.
import { PrismaClient, type Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const EDIT_GRACE_MS = 5_000; // createdAt vs updatedAt gap that counts as "edited after creation"

type Args = { apply: boolean; actorEmail: string | null; projectId: string | null };

function parseArgs(argv: string[]): Args {
  const valueOf = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] ?? null : null;
  };
  return { apply: argv.includes("--apply"), actorEmail: valueOf("--actor"), projectId: valueOf("--project") };
}

const milestoneInclude = {
  payment: true,
  checklistItems: { select: { id: true, milestoneName: true } },
  _count: { select: { wbsTasks: true, releases: true, uatCases: true, sprints: true, blockedBy: true, blocks: true } },
} satisfies Prisma.MilestoneInclude;
type MilestoneRow = Prisma.MilestoneGetPayload<{ include: typeof milestoneInclude }>;

/** Why a gate copy must be kept — empty when it's an untouched copy. */
function keepReasons(m: MilestoneRow): string[] {
  const reasons: string[] = [];
  const p = m.payment;
  if (p) {
    if (p.paymentPct > 0) reasons.push(`payment ${Math.round(p.paymentPct * 1000) / 10}%`);
    if (p.invoiceStatus !== "Not Invoiced") reasons.push(`invoice ${p.invoiceStatus}`);
    if (p.clientSignoff !== "Pending") reasons.push(`sign-off ${p.clientSignoff}`);
    if (p.notes?.trim()) reasons.push("payment notes");
  }
  if (m.updatedAt.getTime() - m.createdAt.getTime() > EDIT_GRACE_MS) reasons.push("edited after creation");
  const c = m._count;
  const links = [
    c.wbsTasks && `${c.wbsTasks} WBS`,
    c.sprints && `${c.sprints} sprint`,
    c.releases && `${c.releases} release`,
    c.uatCases && `${c.uatCases} UAT`,
    c.blockedBy + c.blocks && "milestone dependency",
  ].filter(Boolean);
  if (links.length) reasons.push(`linked: ${links.join(", ")}`);
  if (m.type !== "DEVELOPMENT") reasons.push(`type ${m.type}`);
  if (m.description?.trim()) reasons.push("description");
  if (m.acceptanceCriteria?.trim()) reasons.push("acceptance criteria");
  if (m.dependenciesNote?.trim()) reasons.push("dependencies note");
  if (m.forecastDate) reasons.push("forecast date");
  return reasons;
}

function isGateCopy(m: MilestoneRow): boolean {
  return m.id.startsWith("ms_") || m.checklistItems.some((g) => g.milestoneName != null);
}

function paymentHasData(p: { paymentPct: number; invoiceStatus: string; clientSignoff: string; notes: string | null }): boolean {
  return p.paymentPct > 0 || p.invoiceStatus !== "Not Invoiced" || p.clientSignoff !== "Pending" || !!p.notes?.trim();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.apply && !args.actorEmail) {
    console.error("--apply needs --actor <email> (the Admin the audit log attributes this cleanup to).");
    process.exit(1);
  }
  const actor = args.actorEmail ? await prisma.user.findUnique({ where: { email: args.actorEmail.toLowerCase() } }) : null;
  if (args.apply && !actor) {
    console.error(`No user with email ${args.actorEmail}.`);
    process.exit(1);
  }

  const projects = await prisma.project.findMany({
    where: args.projectId ? { id: args.projectId } : {},
    select: { id: true, name: true, deletedAt: true },
    orderBy: { name: "asc" },
  });

  console.log(args.apply ? "=== APPLYING milestone cleanup ===\n" : "=== DRY RUN — nothing will be changed ===\n");
  let totalDelete = 0;
  let totalKeep = 0;
  let totalOrphans = 0;

  for (const project of projects) {
    const milestones = await prisma.milestone.findMany({ where: { projectId: project.id }, include: milestoneInclude, orderBy: { name: "asc" } });
    const orphanPayments = await prisma.milestonePayment.findMany({
      where: { milestoneId: null, checklistItem: { projectId: project.id } },
      include: { checklistItem: true },
    });

    const copies = milestones.filter(isGateCopy);
    const others = milestones.filter((m) => !isGateCopy(m));
    const keep = copies.map((m) => ({ m, reasons: keepReasons(m) })).filter((x) => x.reasons.length > 0);
    const remove = copies.filter((m) => keepReasons(m).length === 0);
    if (copies.length === 0 && orphanPayments.length === 0) continue;

    console.log(`## ${project.name}${project.deletedAt ? " (soft-deleted)" : ""} — ${project.id}`);
    console.log(`   ${milestones.length} milestones: ${copies.length} gate copies, ${others.length} created directly (untouched)`);
    for (const { m, reasons } of keep) console.log(`   KEEP    ${m.name}  [${reasons.join("; ")}]`);
    for (const m of remove) console.log(`   DELETE  ${m.name}`);
    for (const p of orphanPayments) {
      const label = p.checklistItem?.milestoneName || p.checklistItem?.itemText || "(unnamed)";
      console.log(`   ORPHAN  payment row on checklist item "${label}" → ${paymentHasData(p) ? "RE-HOME onto a new milestone" : "DELETE (empty)"}`);
    }
    console.log("");
    totalKeep += keep.length;
    totalDelete += remove.length;
    totalOrphans += orphanPayments.length;

    if (!args.apply) continue;

    await prisma.$transaction(async (tx) => {
      const removeIds = remove.map((m) => m.id);
      // Explicit, so this is correct whether or not the Phase 3 migration
      // (payment -> milestone ON DELETE CASCADE) has been applied yet.
      await tx.milestonePayment.deleteMany({ where: { milestoneId: { in: removeIds } } });
      await tx.milestone.deleteMany({ where: { id: { in: removeIds } } });

      const rehomed: string[] = [];
      for (const p of orphanPayments) {
        if (!paymentHasData(p)) {
          await tx.milestonePayment.delete({ where: { id: p.id } });
          continue;
        }
        const name = p.checklistItem?.milestoneName || p.checklistItem?.itemText || "Payment milestone";
        const created = await tx.milestone.create({
          data: {
            projectId: project.id,
            name,
            status: p.checklistItem?.status ?? "NOT_STARTED",
            plannedDate: p.checklistItem?.plannedDate ?? null,
            actualDate: p.checklistItem?.actualDate ?? null,
          },
        });
        await tx.milestonePayment.update({ where: { id: p.id }, data: { milestoneId: created.id } });
        rehomed.push(name);
      }

      await tx.auditLog.create({
        data: {
          actorId: actor!.id,
          actorRole: actor!.role,
          projectId: project.id,
          action: "delete",
          entityType: "Milestone",
          summary: `Milestone cleanup (Phase 3): removed ${remove.length} untouched gate-copy milestone(s), kept ${keep.length}${
            rehomed.length ? `, re-homed ${rehomed.length} payment row(s)` : ""
          }`,
          diff: JSON.parse(
            JSON.stringify({
              deletedMilestones: remove.map(({ checklistItems: _gates, _count, ...m }) => m),
              orphanPayments: orphanPayments.map(({ checklistItem: _ci, ...p }) => p),
              kept: keep.map(({ m, reasons }) => ({ id: m.id, name: m.name, reasons })),
            })
          ),
        },
      });
    });
    console.log(`   ✓ applied\n`);
  }

  console.log(`Total: ${totalDelete} to delete, ${totalKeep} to keep, ${totalOrphans} orphan payment row(s).`);
  if (!args.apply && totalDelete + totalOrphans > 0) {
    console.log("\nReview the list above. To apply (after a pg_dump backup):");
    console.log("  npm run milestone-cleanup -- --apply --actor <your-admin-email>");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
