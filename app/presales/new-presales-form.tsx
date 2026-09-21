"use client";

import { useState, useTransition } from "react";
import { FORECAST_CATEGORY_COLORS } from "@/lib/colors";
import { SOURCE_ORDER, SOURCE_LABELS } from "@/lib/presales-stage";
import { createPresalesProject } from "./actions";

export function NewPresalesForm() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800">
        + New Opportunity
      </button>
    );
  }

  return (
    <form
      action={(formData) => startTransition(() => createPresalesProject(formData))}
      className="rounded-lg border border-slate-200 bg-white p-4 space-y-3"
    >
      <h2 className="text-sm font-semibold text-slate-700">New Opportunity</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Opportunity Name *</label>
          <input name="name" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Client</label>
          <input name="client" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </div>
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
          <label className="block text-xs font-medium text-slate-600 mb-1">Practice Area</label>
          <input name="practiceArea" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. XR, InsurTech, MERN" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Industry</label>
          <input name="industry" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. Education, Insurance" />
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
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Presale Folder Link</label>
          <input name="presaleFolderLink" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="SharePoint/Drive folder URL" />
        </div>
      </div>

      {/* A brand-new Lead realistically hasn't had a POC or been forecast
          yet — de-emphasized so it doesn't compete with the fields above
          that matter at creation time. */}
      <div className="pt-2 border-t border-slate-100 space-y-2">
        <p className="text-[11px] text-slate-400">Optional — usually set later</p>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" name="pocDone" className="rounded border-slate-300" />
            POC Done?
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            Forecast Category
            <select name="forecastCategory" className="rounded-md border border-slate-300 px-2 py-1 text-xs">
              <option value="">—</option>
              {(Object.keys(FORECAST_CATEGORY_COLORS) as (keyof typeof FORECAST_CATEGORY_COLORS)[]).map((k) => (
                <option key={k} value={k}>
                  {FORECAST_CATEGORY_COLORS[k].label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Creating..." : "Create Opportunity"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-slate-300 text-slate-600 text-sm font-medium px-4 py-2 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
