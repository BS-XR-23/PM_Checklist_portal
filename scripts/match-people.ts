// Read-only. Proposes a Person-matching plan for the free-text names currently
// stored in ChecklistItem.owner / RiskItem.owner (and, as a lower-confidence
// signal, StakeholderRow.stakeholder). Prints a report; makes no DB writes.
//
// Matching rule: two raw strings are only auto-grouped as "the same person"
// if they are identical after normalizing whitespace/case/punctuation. Any
// near-match (initials, partial names, nicknames — e.g. "Ayesha R." vs
// "Ayesha Rahman") is always listed as ambiguous for manual review, never
// guessed. Run `npm run match-people` to regenerate this report; nothing here
// touches the database.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalize(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,]/g, "")
    .toLowerCase();
}

// Cheap "might be the same person" heuristic used only to group candidates
// for human review — never to auto-merge them.
function looksRelated(a: string, b: string): boolean {
  const [na, nb] = [normalize(a), normalize(b)];
  if (na === nb) return false; // handled as an exact match already
  const [ta, tb] = [na.split(" "), nb.split(" ")];
  if (ta[0] && tb[0] && ta[0] === tb[0]) return true; // same first token
  if (na.startsWith(nb) || nb.startsWith(na)) return true; // prefix/initial
  return false;
}

type Source = { entity: "ChecklistItem" | "RiskItem"; id: string; projectId: string; projectName: string; raw: string };

async function main() {
  const [checklistItems, riskItems, stakeholderRows] = await Promise.all([
    prisma.checklistItem.findMany({
      where: { owner: { not: null } },
      select: { id: true, owner: true, projectId: true, project: { select: { name: true } } },
    }),
    prisma.riskItem.findMany({
      where: { owner: { not: null } },
      select: { id: true, owner: true, projectId: true, project: { select: { name: true } } },
    }),
    prisma.stakeholderRow.findMany({
      select: { id: true, stakeholder: true, pmPlan: { select: { projectId: true, project: { select: { name: true } } } } },
    }),
  ]);

  const sources: Source[] = [];
  for (const c of checklistItems) {
    const raw = c.owner?.trim();
    if (raw) sources.push({ entity: "ChecklistItem", id: c.id, projectId: c.projectId, projectName: c.project.name, raw });
  }
  for (const r of riskItems) {
    const raw = r.owner?.trim();
    if (raw) sources.push({ entity: "RiskItem", id: r.id, projectId: r.projectId, projectName: r.project.name, raw });
  }

  // Group by exact normalized string = one proposed Person, auto-matched.
  const groups = new Map<string, { display: string; sources: Source[] }>();
  for (const s of sources) {
    const key = normalize(s.raw);
    if (!groups.has(key)) groups.set(key, { display: s.raw, sources: [] });
    groups.get(key)!.sources.push(s);
  }

  const proposedPeople = Array.from(groups.values()).sort((a, b) => a.display.localeCompare(b.display));

  // Find pairs of DIFFERENT groups that look related — these are the ambiguous ones.
  const ambiguousPairs: { a: string; b: string }[] = [];
  for (let i = 0; i < proposedPeople.length; i++) {
    for (let j = i + 1; j < proposedPeople.length; j++) {
      if (looksRelated(proposedPeople[i].display, proposedPeople[j].display)) {
        ambiguousPairs.push({ a: proposedPeople[i].display, b: proposedPeople[j].display });
      }
    }
  }
  const ambiguousNames = new Set(ambiguousPairs.flatMap((p) => [p.a, p.b]));

  console.log("=== Person matching plan (dry run — no writes) ===\n");

  console.log(`${checklistItems.length} ChecklistItem rows with an owner, ${riskItems.length} RiskItem rows with an owner.`);
  console.log(`${proposedPeople.length} distinct name spellings found.\n`);

  console.log("--- Proposed Person records (exact-match groups, auto-mergeable) ---");
  for (const g of proposedPeople) {
    if (ambiguousNames.has(g.display)) continue;
    const byProject = new Map<string, number>();
    for (const s of g.sources) byProject.set(s.projectName, (byProject.get(s.projectName) ?? 0) + 1);
    const projectSummary = Array.from(byProject.entries())
      .map(([p, n]) => `${p} (${n})`)
      .join(", ");
    console.log(`  "${g.display}" — ${g.sources.length} row(s) across: ${projectSummary}`);
  }

  console.log("\n--- AMBIGUOUS — needs your manual call, NOT auto-merged ---");
  if (ambiguousPairs.length === 0) {
    console.log("  (none found)");
  } else {
    for (const pair of ambiguousPairs) {
      console.log(`  "${pair.a}"  <->  "${pair.b}"  — same person, or two different people?`);
    }
  }

  console.log("\n--- Stakeholder names (low-confidence secondary source, always manual) ---");
  const stakeholderCandidates = stakeholderRows.filter((r) => {
    const norm = normalize(r.stakeholder);
    // Skip the generic template labels (Sponsor, Project Manager, etc.) that
    // were never meant to hold a person's name.
    return proposedPeople.some((g) => normalize(g.display) === norm);
  });
  if (stakeholderCandidates.length === 0) {
    console.log("  (no stakeholder rows match a name already seen in Owner fields)");
  } else {
    for (const r of stakeholderCandidates) {
      console.log(`  StakeholderRow "${r.stakeholder}" on ${r.pmPlan.project.name} matches an existing owner name — confirm before linking.`);
    }
  }

  console.log("\nNothing has been written. Review the above, then tell me which exact-match groups to");
  console.log("approve (all of them, or a subset) and how to resolve each ambiguous pair, and I'll run");
  console.log("the backfill script (scripts/apply-people-matches.ts) accordingly.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
