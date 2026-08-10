// Backfill step 2 of the Person migration. Only run this after reviewing
// `npm run match-people`'s output and deciding which exact-match name groups
// to approve. This script re-derives the same exact-match groups (never the
// ambiguous/fuzzy ones — those must be linked by hand through the Admin >
// People UI) and, for each APPROVED name, creates one Person record and
// backfills ownerPersonId on every ChecklistItem/RiskItem row that had that
// exact (normalized) owner string. The legacy `owner` string column is left
// untouched — this only adds the new reference, it never deletes data.
//
// Usage:
//   npm run apply-people-matches -- "Ayesha Rahman" "John Doe"
// (pass the exact display names from the match-people report to approve;
// anything not listed is left unmatched for manual linking later.)
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalize(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").replace(/[.,]/g, "").toLowerCase();
}

async function main() {
  const approvedNames = process.argv.slice(2);
  if (approvedNames.length === 0) {
    console.error('Usage: npm run apply-people-matches -- "Exact Name From Report" ["Another Name" ...]');
    process.exit(1);
  }

  for (const name of approvedNames) {
    const key = normalize(name);

    const existingPerson = await prisma.person.findFirst({ where: { name } });
    const person = existingPerson ?? (await prisma.person.create({ data: { name } }));
    if (!existingPerson) console.log(`Created Person "${name}" (${person.id})`);
    else console.log(`Reusing existing Person "${name}" (${person.id})`);

    const checklistItems = await prisma.checklistItem.findMany({ where: { owner: { not: null } } });
    const matchingChecklistIds = checklistItems.filter((c) => normalize(c.owner!) === key).map((c) => c.id);
    if (matchingChecklistIds.length > 0) {
      const res = await prisma.checklistItem.updateMany({
        where: { id: { in: matchingChecklistIds } },
        data: { ownerPersonId: person.id },
      });
      console.log(`  Linked ${res.count} ChecklistItem row(s).`);
    }

    const riskItems = await prisma.riskItem.findMany({ where: { owner: { not: null } } });
    const matchingRiskIds = riskItems.filter((r) => normalize(r.owner!) === key).map((r) => r.id);
    if (matchingRiskIds.length > 0) {
      const res = await prisma.riskItem.updateMany({
        where: { id: { in: matchingRiskIds } },
        data: { ownerPersonId: person.id },
      });
      console.log(`  Linked ${res.count} RiskItem row(s).`);
    }
  }

  console.log("\nDone. Anything not passed here (including every ambiguous pair from the report) is");
  console.log("still on the legacy free-text owner field only — link those by hand via Admin > People.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
