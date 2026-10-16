"use client";

import { useTransition } from "react";
import { InlineText, InlineNumber } from "@/components/ui/inline-edit";
import { updateCompetency, deleteCompetency } from "./competency-actions";

export type CompetencyRowData = { id: string; level: string; multiplier: number | null; peopleCount: number };

export function CompetencyRow({ competency, canEdit }: { competency: CompetencyRowData; canEdit: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <tr className="border-b border-slate-50 last:border-0 align-top">
      <td className="px-3 py-2">
        {canEdit ? <InlineText value={competency.level} onSave={(v) => updateCompetency(competency.id, { level: v })} /> : competency.level}
      </td>
      <td className="px-3 py-2">
        {canEdit ? (
          <InlineNumber value={competency.multiplier} step={0.1} onSave={(v) => updateCompetency(competency.id, { multiplier: v ?? 1 })} />
        ) : (
          <span className="text-slate-300">Hidden</span>
        )}
      </td>
      {canEdit && (
        <td className="px-3 py-2">
          <button
            onClick={() => {
              const msg = `Delete "${competency.level}"?` + (competency.peopleCount ? ` ${competency.peopleCount} ${competency.peopleCount === 1 ? "person uses" : "people use"} it and will lose their competency (new task assignments use no multiplier).` : "");
              if (window.confirm(msg)) startTransition(() => deleteCompetency(competency.id));
            }}
            disabled={pending}
            title="Delete competency"
            className="text-slate-300 hover:text-red-600 disabled:opacity-50"
          >
            ✕
          </button>
        </td>
      )}
    </tr>
  );
}
