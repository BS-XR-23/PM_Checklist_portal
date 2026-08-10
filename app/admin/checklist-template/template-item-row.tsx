"use client";

import { useTransition } from "react";
import { InlineText } from "@/components/ui/inline-edit";
import { updateTemplateItem, deleteTemplateItem, moveTemplateItem } from "./template-actions";

export type TemplateItemRowData = {
  id: string;
  order: number;
  itemText: string;
  milestoneName: string | null;
};

export function TemplateItemRow({ item, isFirst, isLast }: { item: TemplateItemRowData; isFirst: boolean; isLast: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex flex-col shrink-0 pt-0.5">
        <button
          onClick={() => startTransition(() => moveTemplateItem(item.id, "up"))}
          disabled={pending || isFirst}
          title="Move up"
          className="text-slate-300 hover:text-slate-700 disabled:opacity-30 leading-none text-xs"
        >
          ▲
        </button>
        <button
          onClick={() => startTransition(() => moveTemplateItem(item.id, "down"))}
          disabled={pending || isLast}
          title="Move down"
          className="text-slate-300 hover:text-slate-700 disabled:opacity-30 leading-none text-xs"
        >
          ▼
        </button>
      </div>

      <div className="flex-1 min-w-0 grid sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Item Text</p>
          <InlineText value={item.itemText} onSave={(v) => updateTemplateItem(item.id, { itemText: v })} />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Milestone Name</p>
          <InlineText
            value={item.milestoneName ?? ""}
            placeholder="Not a milestone"
            onSave={(v) => updateTemplateItem(item.id, { milestoneName: v || null })}
          />
        </div>
      </div>

      <button
        onClick={() => startTransition(() => deleteTemplateItem(item.id))}
        disabled={pending}
        title="Delete template item"
        className="text-slate-300 hover:text-red-600 disabled:opacity-50 shrink-0"
      >
        ✕
      </button>
    </div>
  );
}
