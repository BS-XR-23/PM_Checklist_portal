"use server";

import * as XLSX from "xlsx";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, writeAudit } from "@/lib/rbac";
import { canManagePersonRegistry } from "@/lib/resourcing-rbac";

async function requirePersonAdmin() {
  const user = await requireUser();
  if (!canManagePersonRegistry(user.role)) throw new Error("Only an Admin can manage the People registry.");
  return user;
}

export async function createPerson(input: {
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  userId?: string;
  roleRateId?: string;
  competencyId?: string;
}) {
  const admin = await requirePersonAdmin();
  if (!input.name.trim()) throw new Error("Name is required.");

  if (input.userId) {
    const existingLink = await prisma.person.findUnique({ where: { userId: input.userId } });
    if (existingLink) throw new Error("That portal account is already linked to another Person record.");
  }

  const created = await prisma.person.create({
    data: {
      name: input.name.trim(),
      title: input.title?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      userId: input.userId || null,
      roleRateId: input.roleRateId || null,
      competencyId: input.competencyId || null,
    },
  });

  await writeAudit({ actor: admin, action: "create", entityType: "Person", entityId: created.id, summary: `Created Person "${created.name}"` });
  revalidatePath("/admin/people");
}

export async function updatePerson(
  personId: string,
  input: {
    name?: string;
    title?: string;
    email?: string;
    phone?: string;
    userId?: string | null;
    roleRateId?: string | null;
    competencyId?: string | null;
  }
) {
  const admin = await requirePersonAdmin();
  const existing = await prisma.person.findUniqueOrThrow({ where: { id: personId } });

  if (input.userId) {
    const existingLink = await prisma.person.findUnique({ where: { userId: input.userId } });
    if (existingLink && existingLink.id !== personId) throw new Error("That portal account is already linked to another Person record.");
  }

  await prisma.person.update({
    where: { id: personId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.title !== undefined ? { title: input.title.trim() || null } : {}),
      ...(input.email !== undefined ? { email: input.email.trim() || null } : {}),
      ...(input.phone !== undefined ? { phone: input.phone.trim() || null } : {}),
      ...(input.userId !== undefined ? { userId: input.userId || null } : {}),
      ...(input.roleRateId !== undefined ? { roleRateId: input.roleRateId || null } : {}),
      ...(input.competencyId !== undefined ? { competencyId: input.competencyId || null } : {}),
    },
  });

  await writeAudit({ actor: admin, action: "update", entityType: "Person", entityId: personId, summary: `Updated Person "${existing.name}"` });
  revalidatePath("/admin/people");
}

type ImportRow = { name: string; title: string; email: string; phone: string; rateRole: string; competency: string };

const IMPORT_HEADER_ALIASES: Record<string, keyof ImportRow> = {
  name: "name",
  "full name": "name",
  title: "title",
  role: "title",
  email: "email",
  "email address": "email",
  phone: "phone",
  "phone number": "phone",
  "rate role": "rateRole",
  "role rate": "rateRole",
  competency: "competency",
  level: "competency",
};

function parseImportRows(buffer: ArrayBuffer): ImportRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  return raw
    .map((rawRow) => {
      const row: Partial<ImportRow> = {};
      for (const [key, value] of Object.entries(rawRow)) {
        const field = IMPORT_HEADER_ALIASES[key.trim().toLowerCase()];
        if (field) row[field] = String(value).trim();
      }
      return { name: row.name ?? "", title: row.title ?? "", email: row.email ?? "", phone: row.phone ?? "", rateRole: row.rateRole ?? "", competency: row.competency ?? "" };
    })
    .filter((r) => r.name !== "");
}

/** CSV/XLSX bulk import — matches Rate Role/Competency by name (case-insensitive), skips rows whose email already exists. */
export async function importPeopleCsv(formData: FormData): Promise<{ importedCount: number; skippedDuplicateCount: number; unmatchedRoleCount: number; unmatchedCompetencyCount: number }> {
  const admin = await requirePersonAdmin();

  const file = formData.get("file");
  if (!(file instanceof Blob)) throw new Error("No file uploaded.");
  const buffer = await file.arrayBuffer();
  const rows = parseImportRows(buffer);
  if (rows.length === 0) throw new Error("No rows found — check the file has a Name column.");

  const [existingPeople, roleRates, competencies] = await Promise.all([
    prisma.person.findMany({ select: { email: true } }),
    prisma.roleRate.findMany(),
    prisma.competency.findMany(),
  ]);
  const existingEmails = new Set(existingPeople.filter((p) => p.email).map((p) => p.email!.toLowerCase()));
  const roleRateByName = new Map(roleRates.map((r) => [r.roleName.toLowerCase(), r.id]));
  const competencyByLevel = new Map(competencies.map((c) => [c.level.toLowerCase(), c.id]));

  let importedCount = 0;
  let skippedDuplicateCount = 0;
  let unmatchedRoleCount = 0;
  let unmatchedCompetencyCount = 0;
  const seenEmailsInBatch = new Set<string>();

  for (const row of rows) {
    const emailKey = row.email.toLowerCase();
    if (row.email && (existingEmails.has(emailKey) || seenEmailsInBatch.has(emailKey))) {
      skippedDuplicateCount++;
      continue;
    }
    if (row.email) seenEmailsInBatch.add(emailKey);

    const roleRateId = row.rateRole ? roleRateByName.get(row.rateRole.toLowerCase()) : undefined;
    if (row.rateRole && !roleRateId) unmatchedRoleCount++;
    const competencyId = row.competency ? competencyByLevel.get(row.competency.toLowerCase()) : undefined;
    if (row.competency && !competencyId) unmatchedCompetencyCount++;

    await prisma.person.create({
      data: {
        name: row.name,
        title: row.title || null,
        email: row.email || null,
        phone: row.phone || null,
        roleRateId: roleRateId ?? null,
        competencyId: competencyId ?? null,
      },
    });
    importedCount++;
  }

  await writeAudit({ actor: admin, action: "create", entityType: "Person", entityId: "bulk-import", summary: `Imported ${importedCount} people from a file` });
  revalidatePath("/admin/people");
  return { importedCount, skippedDuplicateCount, unmatchedRoleCount, unmatchedCompetencyCount };
}

export async function deletePerson(personId: string) {
  const admin = await requirePersonAdmin();
  const existing = await prisma.person.findUniqueOrThrow({ where: { id: personId } });

  await prisma.person.delete({ where: { id: personId } });

  await writeAudit({ actor: admin, action: "delete", entityType: "Person", entityId: personId, summary: `Deleted Person "${existing.name}"` });
  revalidatePath("/admin/people");
}
