import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { AppShell } from "@/components/layout/app-shell";
import { CHECKLIST_TYPES, templateStagesFor, type ChecklistType } from "@/lib/checklist-types";
import { ChecklistTemplateBoard, type BoardType, type TemplateItemWithStage } from "./checklist-template-board";
import { PresalesTemplateItemRow } from "./presales-template-item-row";
import { AddPresalesTemplateItemButton } from "./add-presales-template-item-button";
import { ExportTemplatesMenu } from "./export-templates-menu";

export const dynamic = "force-dynamic";

export default async function ChecklistTemplatePage() {
  const currentUser = await requireUser();
  if (currentUser.role !== "ADMIN") redirect("/projects");

  const [items, presalesItems] = await Promise.all([
    prisma.checklistTemplateItem.findMany({ orderBy: [{ type: "asc" }, { order: "asc" }] }),
    prisma.presalesChecklistTemplateItem.findMany({ orderBy: { order: "asc" } }),
  ]);

  const itemsByType = {} as Record<ChecklistType, TemplateItemWithStage[]>;
  for (const c of CHECKLIST_TYPES) itemsByType[c.key] = [];
  for (const item of items) {
    const list = itemsByType[item.type as ChecklistType];
    if (list) list.push(item);
  }

  const types: BoardType[] = CHECKLIST_TYPES.map((c) => ({ key: c.key, label: c.label, stages: templateStagesFor(c) }));

  return (
    <AppShell user={currentUser}>
      <header className="border-b border-slate-200 bg-white px-4 sm:px-6 py-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Checklist Template</h1>
          <p className="text-sm text-slate-500 mt-0.5 max-w-2xl">
            The master checklists new projects/opportunities are created from. Editing here only affects
            projects/opportunities created afterward — existing ones keep the checklist they already have.
          </p>
        </div>
        <ExportTemplatesMenu />
      </header>
      <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-10">
        <ChecklistTemplateBoard types={types} itemsByType={itemsByType} />

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
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
