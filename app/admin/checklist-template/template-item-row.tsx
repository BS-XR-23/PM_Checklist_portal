"use client";

import { useRef, useTransition } from "react";
import { InlineText } from "@/components/ui/inline-edit";
import { IconPencil, IconTrash } from "@/components/layout/icons";
import { updateTemplateItem, deleteTemplateItem, moveTemplateItem } from "./template-actions";

export type TemplateItemRowData = {
  id: string;
  order: number;
  itemText: string;
  milestoneName: string | null;
};

export function TemplateItemRow({
  item,
  index,
  isFirst,
  isLast,
}: {
  item: TemplateItemRowData;
  /** Display position within its section, e.g. "1.3" — section# + item#. */
  index: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const itemTextRef = useRef<HTMLTableCellElement>(null);
  const isMilestone = !!item.milestoneName;

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-2 text-xs text-slate-400 align-top">{index}</td>
      <td className="px-4 py-2 align-top" ref={itemTextRef}>
        <InlineText value={item.itemText} onSave={(v) => updateTemplateItem(item.id, { itemText: v })} />
      </td>
      <td className="px-4 py-2 align-top">
        <span
          className={
            isMilestone
              ? "inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
              : "inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-400"
          }
        >
          {item.milestoneName || "Not a milestone"}
        </span>
      </td>
      <td className="px-4 py-2 align-top">
        <span
          className={
            isMilestone
              ? "inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
              : "inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600"
          }
        >
          {isMilestone ? "Milestone" : "Task"}
        </span>
      </td>
      <td className="px-4 py-2 align-top">
        <div className="flex items-center gap-2">
          <div className="flex flex-col shrink-0">
            <button
              onClick={() => startTransition(() => moveTemplateItem(item.id, "up"))}
              disabled={pending || isFirst}
              title="Move up"
              className="text-slate-300 hover:text-slate-700 disabled:opacity-30 leading-none text-[10px]"
            >
              ▲
            </button>
            <button
              onClick={() => startTransition(() => moveTemplateItem(item.id, "down"))}
              disabled={pending || isLast}
              title="Move down"
              className="text-slate-300 hover:text-slate-700 disabled:opacity-30 leading-none text-[10px]"
            >
              ▼
            </button>
          </div>
          <button
            type="button"
            onClick={() => itemTextRef.current?.querySelector("input")?.focus()}
            title="Edit item text"
            className="rounded p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <IconPencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`Delete "${item.itemText}"? This can't be undone.`)) return;
              startTransition(() => deleteTemplateItem(item.id));
            }}
            title="Delete template item"
            className="rounded p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <IconTrash className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
