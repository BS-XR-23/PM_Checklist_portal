"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { FORECAST_CATEGORY_COLORS, PRESALES_STAGE_COLORS } from "@/lib/colors";
import { STAGE_ORDER, SOURCE_ORDER, SOURCE_LABELS, LEAD_TYPE_ORDER, LEAD_TYPE_LABELS } from "@/lib/presales-stage";
import { IconFileText } from "@/components/layout/icons";
import { createPresalesProject } from "./actions";
import type { PresalesStage } from "@prisma/client";

export function NewPresalesForm({ people }: { people: { id: string; name: string }[] }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      action={(formData) => startTransition(() => createPresalesProject(formData))}
      className="rounded-lg border border-slate-200 bg-white p-5 space-y-4"
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-blue-50 text-blue-600">
          <IconFileText className="h-4 w-4" />
        </span>
        <h2 className="text-sm font-semibold text-slate-700">Presale Details</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Project / Opportunity Name *</label>
          <input name="name" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Client</label>
          <input name="client" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Deal Owner</label>
          <select name="dealOwnerPersonId" defaultValue="" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">—</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Estimated Value</label>
          <div className="flex gap-1.5">
            <input name="estimatedValue" type="number" step="0.01" min="0" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <select name="estimatedValueCurrency" defaultValue="USD" className="rounded-md border border-slate-300 px-2 py-2 text-sm">
              <option value="USD">USD</option>
              <option value="BDT">BDT</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Expected Close Date</label>
          <input name="expectedCloseDate" type="date" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Stage</label>
          <select name="stage" defaultValue="QUALIFYING" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            {STAGE_ORDER.map((s) => (
              <option key={s} value={s}>
                {PRESALES_STAGE_COLORS[s as PresalesStage].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Start Date</label>
          <input name="startDate" type="date" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Sales Contact</label>
          <input name="salesContact" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Who brought in this lead" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Estimated By</label>
          <input name="estimatedBy" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Who scoped the estimate" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Lead Type</label>
          <select name="leadType" defaultValue="" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">—</option>
            {LEAD_TYPE_ORDER.map((t) => (
              <option key={t} value={t}>
                {LEAD_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">POC Done?</label>
          <label className="flex items-center gap-1.5 text-sm text-slate-600 h-[38px]">
            <input type="checkbox" name="pocDone" className="rounded border-slate-300" />
            Yes
          </label>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Forecast Category</label>
          <select name="forecastCategory" defaultValue="" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">—</option>
            {(Object.keys(FORECAST_CATEGORY_COLORS) as (keyof typeof FORECAST_CATEGORY_COLORS)[]).map((k) => (
              <option key={k} value={k}>
                {FORECAST_CATEGORY_COLORS[k].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Practice Area</label>
          <input name="practiceArea" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. XR, InsurTech" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Industry</label>
          <input name="industry" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. Education, Healthcare" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Technology</label>
          <input name="technology" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. AI/RAG, Mobile" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Source</label>
          <select name="source" defaultValue="" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">—</option>
            {SOURCE_ORDER.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Presale Folder Link</label>
        <input name="presaleFolderLink" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="SharePoint/Drive folder URL" />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
        <textarea
          name="description"
          rows={3}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="What is this opportunity, and why might it happen?"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Creating..." : "Create Opportunity"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/presales")}
          className="rounded-md border border-slate-300 text-slate-600 text-sm font-medium px-4 py-2 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
