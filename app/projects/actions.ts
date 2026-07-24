"use server";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { createProject } from "@/lib/create-project";

export async function createProjectAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Project name is required.");

  const client = String(formData.get("client") ?? "").trim();
  const contractValue = Number(formData.get("contractValue") ?? 0);
  const plannedManDays = Number(formData.get("plannedManDays") ?? 0);

  const project = await createProject({ name, client, contractValue, plannedManDays });

  revalidatePath("/projects");
  redirect(`/projects/${project.id}/dashboard`);
}
