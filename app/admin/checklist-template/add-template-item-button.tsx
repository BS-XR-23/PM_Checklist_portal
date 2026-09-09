"use client";

import { useTransition } from "react";
import type { ChecklistType } from "@/lib/checklist-types";
import { createTemplateItem } from "./template-actions";

export function AddTemplateItemButton({ type, stage }: { type: ChecklistType; stage: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      onClick={() => startTransition(() => createTemplateItem(type, stage))}
      disabled={pending}
      className="w-full rounded-lg border border-dashed border-slate-300 py-2 text-xs font-medium text-slate-400 hover:text-slate-600 hover:border-slate-400 disabled:opacity-50"
    >
      {pending ? "Adding..." : "+ Add Item"}
    </button>
  );
}
