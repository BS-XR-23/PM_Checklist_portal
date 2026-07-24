"use client";

import { useState, useTransition } from "react";
import { updatePmPlanField, type PmPlanScalarField } from "@/app/projects/[projectId]/pm-plan/pmplan-actions";

export function PlanField({
  pmPlanId,
  projectId,
  field,
  label,
  value,
  multiline = true,
}: {
  pmPlanId: string;
  projectId: string;
  field: PmPlanScalarField;
  label: string;
  value: string;
  multiline?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [pending, startTransition] = useTransition();

  const save = () => {
    if (draft !== value) startTransition(() => updatePmPlanField(pmPlanId, projectId, field, draft));
  };

  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {multiline ? (
        <textarea
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50"
          rows={2}
          value={draft}
          disabled={pending}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
        />
      ) : (
        <input
          type="text"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50"
          value={draft}
          disabled={pending}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
        />
      )}
    </div>
  );
}
