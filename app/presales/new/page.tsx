import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { AppShell } from "@/components/layout/app-shell";
import { NewPresalesForm } from "../new-presales-form";

export const dynamic = "force-dynamic";

const VIEW_ROLES = ["ADMIN", "PM", "TPM", "PROGRAM_MANAGER"] as const;

export default async function NewPresalesPage() {
  const user = await requireUser();
  if (!VIEW_ROLES.includes(user.role as (typeof VIEW_ROLES)[number])) redirect("/projects");
  if (user.role !== "ADMIN" && user.role !== "PM") redirect("/presales");

  const people = await prisma.person.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  return (
    <AppShell user={user}>
      <header className="border-b border-slate-200 bg-white px-4 sm:px-6 py-4">
        <Link href="/presales" className="text-xs text-slate-400 hover:text-slate-600">← Presales</Link>
        <h1 className="text-lg font-semibold text-slate-900">Create Opportunity</h1>
        <p className="text-sm text-slate-500">Capture and track a presales opportunity, follow-up actions, and convert it into a project.</p>
      </header>

      <main className="p-4 sm:p-6">
        <NewPresalesForm people={people} />
      </main>
    </AppShell>
  );
}
