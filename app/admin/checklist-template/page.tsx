import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { AppShell } from "@/components/layout/app-shell";
import { PM_STAGES, DEVOPS_CATEGORIES } from "@/lib/seed-data";
import type { ChecklistType } from "@/lib/constants";
import { TemplateItemRow, type TemplateItemRowData } from "./template-item-row";
import { AddTemplateItemButton } from "./add-template-item-button";
import { PresalesTemplateItemRow } from "./presales-template-item-row";
import { AddPresalesTemplateItemButton } from "./add-presales-template-item-button";

export const dynamic = "force-dynamic";

export default async function ChecklistTemplatePage() {
  const currentUser = await requireUser();
  if (currentUser.role !== "ADMIN") redirect("/projects");

  const [items, presalesItems] = await Promise.all([
    prisma.checklistTemplateItem.findMany({ orderBy: [{ type: "asc" }, { order: "asc" }] }),
    prisma.presalesChecklistTemplateItem.findMany({ orderBy: { order: "asc" } }),
  ]);
  const pmItems = items.filter((i) => i.type === "PM");
  const devopsItems = items.filter((i) => i.type === "DEVOPS");
  // "Presales" is a real ChecklistItem stage (lib/seed-data.ts's PM_STAGES),
  // but deliberately not part of PM_CHECKLIST_SEED/this template — it's
  // only ever populated by winPresalesProject, so it isn't listed here.
  const pmStages = PM_STAGES.filter((s) => s !== "Presales");

  return (
    <AppShell user={currentUser}>
      <header className="border-b border-slate-200 bg-white px-4 sm:px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Checklist Template</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          The master checklists new projects/opportunities are created from. Editing here only affects
          projects/opportunities created afterward — existing ones keep the checklist they already have.
        </p>
      </header>
      <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-10">
        <TemplateSection title="PM Checklist" type="PM" stages={pmStages} items={pmItems} />
        <TemplateSection title="DevOps Checklist" type="DEVOPS" stages={DEVOPS_CATEGORIES} items={devopsItems} />
        <section className="space-y-6">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Presales Checklist</h2>
            <p className="text-sm text-slate-500">
              The standard playbook every new presales opportunity is seeded with. Flat — no stages, since the
              presales process is much shorter than delivery.
            </p>
          </div>
          <div className="space-y-2">
            {presalesItems.map((item) => (
              <PresalesTemplateItemRow key={item.id} item={item} />
            ))}
            <AddPresalesTemplateItemButton />
          </div>
        </section>
      </main>
    </AppShell>
  );
}

function TemplateSection({
  title,
  type,
  stages,
  items,
}: {
  title: string;
  type: ChecklistType;
  stages: readonly string[];
  items: (TemplateItemRowData & { stage: string })[];
}) {
  return (
    <section className="space-y-6">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {stages.map((stage) => {
        const rows = items.filter((i) => i.stage === stage);
        return (
          <div key={stage}>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">{stage}</h3>
            <div className="space-y-2">
              {rows.map((item, idx) => (
                <TemplateItemRow key={item.id} item={item} isFirst={idx === 0} isLast={idx === rows.length - 1} />
              ))}
              <AddTemplateItemButton type={type} stage={stage} />
            </div>
          </div>
        );
      })}
    </section>
  );
}
