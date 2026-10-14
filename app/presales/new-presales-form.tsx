"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { FORECAST_CATEGORY_COLORS, PRESALES_STAGE_COLORS } from "@/lib/colors";
import { STAGE_ORDER, STAGE_INFO, SOURCE_ORDER, SOURCE_LABELS, LEAD_TYPE_ORDER, LEAD_TYPE_LABELS } from "@/lib/presales-stage";
import { STAGE_WIN_PROBABILITY } from "@/lib/presales-pipeline";
import { formatPct } from "@/lib/format";
import { createPresalesProject } from "./actions";
import type { PresalesStage } from "@prisma/client";

const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400";
const labelClass = "block text-xs font-medium text-slate-600 mb-1";

/**
 * Six fields to get a deal on the board — everything else is optional and
 * folded under "More details", since it's usually only known later and can
 * be filled in on the deal page.
 */
export function NewPresalesForm({ people }: { people: { id: string; name: string }[] }) {
  const [pending, startTransition] = useTransition();
  const [stage, setStage] = useState<PresalesStage>("QUALIFYING");
  const router = useRouter();

  return (
    <form action={(formData) => startTransition(() => createPresalesProject(formData))} className="max-w-3xl space-y-5">
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <label className={labelClass}>Opportunity name *</label>
          <input name="name" required autoFocus className={clsx(inputClass, "text-base")} placeholder="e.g. Glenrich International School — VR campus tour" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Client</label>
            <input name="client" className={inputClass} placeholder="Client company" />
          </div>
          <div>
            <label className={labelClass}>Deal owner</label>
            <select name="dealOwnerPersonId" defaultValue="" className={inputClass}>
              <option value="">—</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Estimated value</label>
            <div className="flex gap-1.5">
              <input name="estimatedValue" type="number" step="0.01" min="0" className={inputClass} placeholder="0" />
              <select name="estimatedValueCurrency" defaultValue="USD" className="rounded-md border border-slate-300 px-2 py-2 text-sm">
                <option value="USD">USD</option>
                <option value="BDT">BDT</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Expected close date</label>
            <input name="expectedCloseDate" type="date" className={inputClass} />
          </div>
        </div>

        <fieldset>
          <legend className={labelClass}>Stage</legend>
          <input type="hidden" name="stage" value={stage} />
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {STAGE_ORDER.map((s) => {
              const color = PRESALES_STAGE_COLORS[s];
              const active = s === stage;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStage(s)}
                  aria-pressed={active}
                  className={clsx("rounded-lg border px-3 py-2 text-left transition-colors", active ? "border-transparent shadow-sm" : "border-slate-200 hover:border-slate-400")}
                  style={active ? { backgroundColor: color.text, color: "#fff" } : undefined}
                >
                  <span className={clsx("block text-sm font-semibold", !active && "text-slate-700")}>{color.label}</span>
                  <span className={clsx("block text-[11px]", active ? "opacity-80" : "text-slate-400")}>{formatPct(STAGE_WIN_PROBABILITY[s])} win</span>
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">{STAGE_INFO[stage]}</p>
        </fieldset>
      </section>

      <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3.5 text-sm font-semibold text-slate-700 sm:px-6">
          <span>
            More details <span className="font-normal text-slate-400">— optional, can be filled in later</span>
          </span>
          <span className="text-slate-400 transition-transform group-open:rotate-90">›</span>
        </summary>
        <div className="space-y-4 border-t border-slate-100 p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className={labelClass}>Lead type</label>
              <select name="leadType" defaultValue="" className={inputClass}>
                <option value="">—</option>
                {LEAD_TYPE_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {LEAD_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Source</label>
              <select name="source" defaultValue="" className={inputClass}>
                <option value="">—</option>
                {SOURCE_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Owner&apos;s forecast</label>
              <select name="forecastCategory" defaultValue="" className={inputClass}>
                <option value="">—</option>
                {(Object.keys(FORECAST_CATEGORY_COLORS) as (keyof typeof FORECAST_CATEGORY_COLORS)[]).map((k) => (
                  <option key={k} value={k}>
                    {FORECAST_CATEGORY_COLORS[k].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Start date</label>
              <input name="startDate" type="date" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Sales contact</label>
              <input name="salesContact" className={inputClass} placeholder="Who brought in this lead" />
            </div>
            <div>
              <label className={labelClass}>Estimated by</label>
              <input name="estimatedBy" className={inputClass} placeholder="Who scoped the estimate" />
            </div>
            <div>
              <label className={labelClass}>Practice area</label>
              <input name="practiceArea" className={inputClass} placeholder="e.g. XR, InsurTech" />
            </div>
            <div>
              <label className={labelClass}>Industry</label>
              <input name="industry" className={inputClass} placeholder="e.g. Education, Healthcare" />
            </div>
            <div>
              <label className={labelClass}>Technology</label>
              <input name="technology" className={inputClass} placeholder="e.g. AI/RAG, Mobile" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="pocDone" className="rounded border-slate-300" />
            Proof of concept already done
          </label>
          <div>
            <label className={labelClass}>Presale folder link</label>
            <input name="presaleFolderLink" className={inputClass} placeholder="SharePoint/Drive folder URL" />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea name="description" rows={3} className={inputClass} placeholder="What is this opportunity, and why might it happen?" />
          </div>
        </div>
      </details>

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
          {pending ? "Creating..." : "Create opportunity"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/presales")}
          className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
