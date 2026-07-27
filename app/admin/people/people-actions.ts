"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, writeAudit } from "@/lib/rbac";
import { canManagePersonRegistry } from "@/lib/resourcing-rbac";

async function requirePersonAdmin() {
  const user = await requireUser();
  if (!canManagePersonRegistry(user.role)) throw new Error("Only an Admin can manage the People registry.");
  return user;
}

export async function createPerson(input: { name: string; title?: string; email?: string; phone?: string; userId?: string }) {
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
    },
  });

  await writeAudit({ actor: admin, action: "create", entityType: "Person", entityId: created.id, summary: `Created Person "${created.name}"` });
  revalidatePath("/admin/people");
}

export async function updatePerson(personId: string, input: { name?: string; title?: string; email?: string; phone?: string; userId?: string | null }) {
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
    },
  });

  await writeAudit({ actor: admin, action: "update", entityType: "Person", entityId: personId, summary: `Updated Person "${existing.name}"` });
  revalidatePath("/admin/people");
}

export async function deletePerson(personId: string) {
  const admin = await requirePersonAdmin();
  const existing = await prisma.person.findUniqueOrThrow({ where: { id: personId } });

  await prisma.person.delete({ where: { id: personId } });

  await writeAudit({ actor: admin, action: "delete", entityType: "Person", entityId: personId, summary: `Deleted Person "${existing.name}"` });
  revalidatePath("/admin/people");
}
