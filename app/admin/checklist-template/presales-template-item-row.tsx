"use client";

import { useTransition } from "react";
import { InlineText } from "@/components/ui/inline-edit";
import { updatePresalesTemplateItem, deletePresalesTemplateItem } from "./presales-template-actions";

export type PresalesTemplateItemRowData = {
  id: string;
  order: number;
  itemText: string;
};

export function PresalesTemplateItemRow({ item }: { item: PresalesTemplateItemRowData }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <span className="text-xs text-slate-400 pt-1.5 shrink-0">{item.order}</span>
      <div className="flex-1 min-w-0">
        <InlineText value={item.itemText} onSave={(v) => updatePresalesTemplateItem(item.id, v)} />
      </div>
      <button
        onClick={() => startTransition(() => deletePresalesTemplateItem(item.id))}
        disabled={pending}
        title="Delete template item"
        className="text-slate-300 hover:text-red-600 disabled:opacity-50 shrink-0"
      >
        ✕
      </button>
    </div>
  );
}
