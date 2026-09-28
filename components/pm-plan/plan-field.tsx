"use client";

import { useState, useTransition } from "react";
import { updatePmPlanField, updatePmPlanFieldLink, type PmPlanScalarField, type PmPlanLinkableField } from "@/app/projects/[projectId]/pm-plan/pmplan-actions";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { FieldLinkEditor } from "./field-link-editor";

export function PlanField({
  pmPlanId,
  projectId,
  field,
  label,
  value,
  multiline = true,
  linkField,
  linkUrl,
}: {
  pmPlanId: string;
  projectId: string;
  field: PmPlanScalarField;
  label: string;
  value: string;
  // Every multiline PlanField (the actual "textboxes" — Rationale, Charter,
  // Methodology, Test/Deploy detail fields, Escalation Path) edits as rich
  // text (bold/italic/lists/links) via Tiptap rather than a plain textarea.
  // Single-line fields (Version, Budget, Cadence, ...) stay plain inputs —
  // formatting doesn't apply to a one-line factual value.
  multiline?: boolean;
  /** Omit for fields that don't get a reference-link affordance (see PmPlanLinkableField). */
  linkField?: PmPlanLinkableField;
  linkUrl?: string | null;
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
        <RichTextEditor value={value} onSave={(v) => updatePmPlanField(pmPlanId, projectId, field, v)} />
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
      {linkField && <FieldLinkEditor url={linkUrl} onSave={(url) => updatePmPlanFieldLink(pmPlanId, projectId, linkField, url)} />}
    </div>
  );
}
