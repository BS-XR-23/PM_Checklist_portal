"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createProject } from "@/lib/create-project";
import { requireUser, writeAudit } from "@/lib/rbac";

export async function createProjectAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new Error("Only an Admin can create projects.");
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Project name is required.");

  const client = String(formData.get("client") ?? "").trim();
  const contractValue = Number(formData.get("contractValue") ?? 0);
  const plannedManDays = Number(formData.get("plannedManDays") ?? 0);

  const project = await createProject({ name, client, contractValue, plannedManDays });

  await writeAudit({
    actor: user,
    projectId: project.id,
    action: "create",
    entityType: "Project",
    entityId: project.id,
    summary: `Created project "${project.name}"`,
  });

  revalidatePath("/projects");
  redirect(`/projects/${project.id}/dashboard`);
}
