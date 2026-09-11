import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { AppShell } from "@/components/layout/app-shell";
import { CHECKLIST_TYPES, type ChecklistType } from "@/lib/checklist-types";
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
  const itemsByType = new Map<string, typeof items>();
  for (const item of items) {
    const list = itemsByType.get(item.type);
    if (list) list.push(item);
    else itemsByType.set(item.type, [item]);
  }
  // "Presales" is a real ChecklistItem stage (lib/seed-data.ts's PM_STAGES),
  // but deliberately not part of PM_CHECKLIST_SEED/this template — it's
  // only ever populated by winPresalesProject, so it's filtered out of the
  // PM checklist type's stage list here, and only there.
  const stagesFor = (c: (typeof CHECKLIST_TYPES)[number]) => (c.key === "PM" ? c.stageOrder.filter((s) => s !== "Presales") : c.stageOrder);

  return (
    <AppShell user={currentUser}>
      <header className="border-b border-slate-200 bg-white px-4 sm:px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Checklist Template</h1>
        <p className="text-sm text-slate-500 mt-0.5">The master checklists new projects/opportunities are created from.</p>
      </header>
      <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-10">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-900">Only affects projects created after this edit.</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Existing projects/opportunities keep the checklist they already have — adding, removing, or reordering an
            item here does not retroactively change any project already created. To roll a change out to existing
            projects, that&apos;s a separate, deliberate step.
          </p>
        </div>

        {CHECKLIST_TYPES.map((c) => (
          <TemplateSection key={c.key} title={c.label} type={c.key} stages={stagesFor(c)} items={itemsByType.get(c.key) ?? []} />
        ))}
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
