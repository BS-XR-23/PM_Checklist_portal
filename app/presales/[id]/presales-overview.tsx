"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { InlineText, InlineTextarea, InlineNumber, InlineDate, InlineSelect } from "@/components/ui/inline-edit";
import { PersonPicker } from "@/components/resourcing/person-picker";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { IconExternalLink, IconFileText } from "@/components/layout/icons";
import { formatDate, toDateInputValue } from "@/lib/format";
import { RAG_COLORS } from "@/lib/rag";
import { PRESALES_STAGE_COLORS, FORECAST_CATEGORY_COLORS } from "@/lib/colors";
import {
  STAGE_ORDER,
  STAGE_INFO,
  SOURCE_ORDER,
  SOURCE_LABELS,
  LEAD_TYPE_ORDER,
  LEAD_TYPE_LABELS,
  usdEquivalent,
  formatByCurrency,
  USD_TO_BDT_RATE,
} from "@/lib/presales-stage";
import { updatePresalesProject, winPresalesProject, markPresalesLost, reopenPresalesProject } from "../actions";
import type { PresalesOutcome, PresalesStage, PresalesForecastCategory, PresalesCurrency, PresalesSource, PresalesLeadType } from "@prisma/client";

export type PresalesOverviewData = {
  id: string;
  name: string;
  client: string | null;
  description: string | null;
  estimatedValue: number | null;
  estimatedValueCurrency: PresalesCurrency;
  expectedCloseDate: Date | null;
  outcome: PresalesOutcome;
  stage: PresalesStage;
  dealOwnerPersonId: string | null;
  dealOwnerPerson: { id: string; name: string } | null;
  pocDone: boolean;
  forecastCategory: PresalesForecastCategory | null;
  practiceArea: string | null;
  industry: string | null;
  technology: string | null;
  presaleFolderLink: string | null;
  source: PresalesSource | null;
  startDate: Date | null;
  salesContact: string | null;
  estimatedBy: string | null;
  leadType: PresalesLeadType | null;
  onHold: boolean;
  holdReason: string | null;
  lostReason: string | null;
  wonProject: { id: string; name: string } | null;
};

const OUTCOME_BADGE: Record<PresalesOutcome, { bg: string; text: string; label: string }> = {
  OPEN: RAG_COLORS.AMBER,
  WON: RAG_COLORS.GREEN,
  LOST: RAG_COLORS.RED,
};

export function PresalesOverview({
  data,
  canWrite,
  people,
}: {
  data: PresalesOverviewData;
  canWrite: boolean;
  people: { id: string; name: string }[];
}) {
  const badge = OUTCOME_BADGE[data.outcome];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-blue-50 text-blue-600">
            <IconFileText className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-semibold text-slate-700">Presale Details</h2>
        </div>
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0" style={{ backgroundColor: badge.bg, color: badge.text }}>
          {data.outcome === "OPEN" ? "In Progress" : data.outcome === "WON" ? "Won" : "Lost"}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">Project / Opportunity Name</p>
          {canWrite ? (
            <InlineText value={data.name} onSave={(v) => updatePresalesProject(data.id, { name: v })} />
          ) : (
            <p className="text-sm text-slate-800">{data.name}</p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">Client</p>
          {canWrite ? (
            <InlineText value={data.client ?? ""} onSave={(v) => updatePresalesProject(data.id, { client: v })} placeholder="Client" />
          ) : (
            <p className="text-sm text-slate-800">{data.client || "—"}</p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">Deal Owner</p>
          {canWrite ? (
            <div className="rounded border border-slate-200">
              <PersonPicker
                personId={data.dealOwnerPersonId}
                legacyText={null}
                people={people}
                onSave={(id) => updatePresalesProject(data.id, { dealOwnerPersonId: id })}
              />
            </div>
          ) : (
            <p className="text-sm text-slate-800">{data.dealOwnerPerson?.name ?? "—"}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">Estimated Value</p>
          {canWrite ? (
            <div className="flex items-center gap-1.5">
              <InlineNumber value={data.estimatedValue} onSave={(v) => updatePresalesProject(data.id, { estimatedValue: v })} step={0.01} />
              <InlineSelect
                value={data.estimatedValueCurrency}
                options={["USD", "BDT"]}
                className="rounded-md border border-slate-200 px-1.5 py-1 text-xs"
                onSave={(v) => updatePresalesProject(data.id, { estimatedValueCurrency: v as PresalesCurrency })}
              />
            </div>
          ) : (
            <p className="text-sm text-slate-800">{data.estimatedValue ? formatByCurrency(data.estimatedValue, data.estimatedValueCurrency) : "—"}</p>
          )}
          {data.estimatedValue != null && (
            <p className="text-xs text-slate-400 mt-0.5">
              {/* Derived, never stored — same "don't let two numbers drift apart" principle as win probability. */}
              ≈{" "}
              {data.estimatedValueCurrency === "USD"
                ? formatByCurrency(data.estimatedValue * USD_TO_BDT_RATE, "BDT")
                : formatByCurrency(usdEquivalent(data.estimatedValue, data.estimatedValueCurrency), "USD")}
              {" · 1 USD = "}
              {USD_TO_BDT_RATE} BDT
            </p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">Expected Close Date</p>
          {canWrite ? (
            <InlineDate value={toDateInputValue(data.expectedCloseDate)} onSave={(v) => updatePresalesProject(data.id, { expectedCloseDate: v })} />
          ) : (
            <p className="text-sm text-slate-800">{formatDate(data.expectedCloseDate)}</p>
          )}
        </div>
        {data.outcome === "OPEN" && (
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
              Stage
              <InfoTooltip text={STAGE_INFO[data.stage]} />
            </p>
            {canWrite ? (
              <InlineSelect
                value={data.stage}
                options={STAGE_ORDER}
                renderOption={(s) => PRESALES_STAGE_COLORS[s as PresalesStage].label}
                className="rounded-full border-0 px-2.5 py-0.5 text-xs font-semibold"
                style={{ backgroundColor: PRESALES_STAGE_COLORS[data.stage].bg, color: PRESALES_STAGE_COLORS[data.stage].text }}
                onSave={(v) => updatePresalesProject(data.id, { stage: v as PresalesStage })}
              />
            ) : (
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                style={{ backgroundColor: PRESALES_STAGE_COLORS[data.stage].bg, color: PRESALES_STAGE_COLORS[data.stage].text }}
              >
                {PRESALES_STAGE_COLORS[data.stage].label}
              </span>
            )}
          </div>
        )}
      </div>

      {data.outcome === "OPEN" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Start Date</p>
            {canWrite ? (
              <InlineDate value={toDateInputValue(data.startDate)} onSave={(v) => updatePresalesProject(data.id, { startDate: v })} />
            ) : (
              <p className="text-sm text-slate-800">{formatDate(data.startDate)}</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Sales Contact</p>
            {canWrite ? (
              <InlineText value={data.salesContact ?? ""} onSave={(v) => updatePresalesProject(data.id, { salesContact: v })} placeholder="Who brought in this lead" />
            ) : (
              <p className="text-sm text-slate-800">{data.salesContact || "—"}</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Estimated By</p>
            {canWrite ? (
              <InlineText value={data.estimatedBy ?? ""} onSave={(v) => updatePresalesProject(data.id, { estimatedBy: v })} placeholder="Who scoped the estimate" />
            ) : (
              <p className="text-sm text-slate-800">{data.estimatedBy || "—"}</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Lead Type</p>
            {canWrite ? (
              <InlineSelect
                value={data.leadType ?? ""}
                options={["", ...LEAD_TYPE_ORDER]}
                renderOption={(v) => (v ? LEAD_TYPE_LABELS[v as PresalesLeadType] : "—")}
                onSave={(v) => updatePresalesProject(data.id, { leadType: v ? (v as PresalesLeadType) : null })}
              />
            ) : (
              <p className="text-sm text-slate-800">{data.leadType ? LEAD_TYPE_LABELS[data.leadType] : "—"}</p>
            )}
          </div>
        </div>
      )}

      {data.outcome === "OPEN" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">POC Done?</p>
            {canWrite ? (
              <BooleanToggle
                value={data.pocDone}
                trueLabel="✓ POC Done"
                falseLabel="POC Not Done"
                onSave={(v) => updatePresalesProject(data.id, { pocDone: v })}
              />
            ) : (
              <p className="text-sm text-slate-800">{data.pocDone ? "Yes" : "No"}</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Forecast Category</p>
            {canWrite ? (
              <InlineSelect
                value={data.forecastCategory ?? ""}
                options={["", "COMMIT", "BEST_CASE", "PIPELINE"]}
                renderOption={(v) => (v ? FORECAST_CATEGORY_COLORS[v as PresalesForecastCategory].label : "—")}
                className="rounded-full border-0 px-2.5 py-0.5 text-xs font-semibold"
                style={
                  data.forecastCategory
                    ? { backgroundColor: FORECAST_CATEGORY_COLORS[data.forecastCategory].bg, color: FORECAST_CATEGORY_COLORS[data.forecastCategory].text }
                    : { backgroundColor: "#F1F5F9", color: "#64748B" }
                }
                onSave={(v) => updatePresalesProject(data.id, { forecastCategory: v ? (v as PresalesForecastCategory) : null })}
              />
            ) : data.forecastCategory ? (
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                style={{ backgroundColor: FORECAST_CATEGORY_COLORS[data.forecastCategory].bg, color: FORECAST_CATEGORY_COLORS[data.forecastCategory].text }}
              >
                {FORECAST_CATEGORY_COLORS[data.forecastCategory].label}
              </span>
            ) : (
              <p className="text-sm text-slate-400">—</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Practice Area</p>
            {canWrite ? (
              <InlineText value={data.practiceArea ?? ""} onSave={(v) => updatePresalesProject(data.id, { practiceArea: v })} placeholder="e.g. XR, InsurTech" />
            ) : (
              <p className="text-sm text-slate-800">{data.practiceArea || "—"}</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Industry</p>
            {canWrite ? (
              <InlineText value={data.industry ?? ""} onSave={(v) => updatePresalesProject(data.id, { industry: v })} placeholder="e.g. Education, Insurance" />
            ) : (
              <p className="text-sm text-slate-800">{data.industry || "—"}</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Technology</p>
            {canWrite ? (
              <InlineText value={data.technology ?? ""} onSave={(v) => updatePresalesProject(data.id, { technology: v })} placeholder="e.g. AI/RAG, Mobile" />
            ) : (
              <p className="text-sm text-slate-800">{data.technology || "—"}</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Source</p>
            {canWrite ? (
              <InlineSelect
                value={data.source ?? ""}
                options={["", ...SOURCE_ORDER]}
                renderOption={(v) => (v ? SOURCE_LABELS[v as PresalesSource] : "—")}
                onSave={(v) => updatePresalesProject(data.id, { source: v ? (v as PresalesSource) : null })}
              />
            ) : (
              <p className="text-sm text-slate-800">{data.source ? SOURCE_LABELS[data.source] : "—"}</p>
            )}
          </div>
        </div>
      )}

      {data.outcome === "OPEN" && (
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">On Hold?</p>
            {canWrite ? (
              <BooleanToggle
                value={data.onHold}
                trueLabel="On Hold"
                falseLabel="Active"
                onSave={(v) => updatePresalesProject(data.id, { onHold: v })}
              />
            ) : (
              <p className="text-sm text-slate-800">{data.onHold ? "On Hold" : "Active"}</p>
            )}
            {data.onHold && (
              <div className="mt-1.5">
                {canWrite ? (
                  <InlineText value={data.holdReason ?? ""} onSave={(v) => updatePresalesProject(data.id, { holdReason: v })} placeholder="Why is this on hold?" />
                ) : (
                  data.holdReason && <p className="text-xs text-slate-500">{data.holdReason}</p>
                )}
              </div>
            )}
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs font-medium text-slate-500 mb-1">Presale Folder Link</p>
            <PresaleFolderLink
              value={data.presaleFolderLink}
              canWrite={canWrite}
              onSave={(v) => updatePresalesProject(data.id, { presaleFolderLink: v })}
            />
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-slate-500 mb-1">Description</p>
        {canWrite ? (
          <InlineTextarea value={data.description ?? ""} onSave={(v) => updatePresalesProject(data.id, { description: v })} placeholder="What is this opportunity, and why might it happen?" />
        ) : (
          <p className="text-sm text-slate-800 whitespace-pre-wrap">{data.description || "—"}</p>
        )}
      </div>

      {canWrite && <OutcomeActions data={data} />}
      {!canWrite && data.outcome === "LOST" && data.lostReason && (
        <p className="text-sm text-slate-500">Lost reason: {data.lostReason}</p>
      )}
      {data.outcome === "WON" && data.wonProject && (
        <Link href={`/projects/${data.wonProject.id}/dashboard`} className="inline-block text-sm font-medium text-emerald-700 hover:underline">
          → View project: {data.wonProject.name}
        </Link>
      )}
    </div>
  );
}

function OutcomeActions({ data }: { data: PresalesOverviewData }) {
  const [pending, startTransition] = useTransition();
  const [showLostForm, setShowLostForm] = useState(false);
  const [lostReason, setLostReason] = useState("");

  if (data.outcome === "WON") return null;

  if (data.outcome === "LOST") {
    return (
      <div className="flex items-center gap-3 pt-1 border-t border-slate-100">
        <button
          onClick={() => startTransition(() => reopenPresalesProject(data.id))}
          disabled={pending}
          className="text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
        >
          {pending ? "..." : "Reopen"}
        </button>
      </div>
    );
  }

  if (showLostForm) {
    return (
      <div className="pt-1 border-t border-slate-100 space-y-2">
        <label className="block text-xs font-medium text-slate-600">Why was this lost?</label>
        <textarea
          value={lostReason}
          onChange={(e) => setLostReason(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Budget cut, went with a competitor, timing..."
        />
        <div className="flex gap-2">
          <button
            onClick={() => startTransition(() => markPresalesLost(data.id, lostReason))}
            disabled={pending}
            className="rounded-md bg-red-600 text-white text-sm font-medium px-3 py-1.5 hover:bg-red-700 disabled:opacity-50"
          >
            {pending ? "..." : "Confirm Lost"}
          </button>
          <button onClick={() => setShowLostForm(false)} className="rounded-md border border-slate-300 text-slate-600 text-sm font-medium px-3 py-1.5 hover:bg-slate-50">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 pt-1 border-t border-slate-100">
      <button
        onClick={() => {
          if (!window.confirm(`Mark "${data.name}" as Won? This creates a new active project with the standard checklist, seeded from this opportunity.`)) return;
          startTransition(() => winPresalesProject(data.id));
        }}
        disabled={pending}
        className="rounded-md bg-emerald-600 text-white text-sm font-medium px-3 py-1.5 hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? "..." : "Mark as Won"}
      </button>
      <button
        onClick={() => setShowLostForm(true)}
        disabled={pending}
        className="rounded-md border border-slate-300 text-slate-600 text-sm font-medium px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50"
      >
        Mark as Lost
      </button>
    </div>
  );
}

// Same pill-toggle pattern as PresalesActionItemStatusToggle, generalized
// for any boolean field on the opportunity itself (POC Done, Competitive Bid).
function BooleanToggle({
  value,
  trueLabel,
  falseLabel,
  onSave,
}: {
  value: boolean;
  trueLabel: string;
  falseLabel: string;
  onSave: (next: boolean) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => onSave(!value))}
      disabled={pending}
      className={
        value
          ? "inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-0.5 text-xs font-medium hover:bg-emerald-100 disabled:opacity-50"
          : "inline-flex items-center rounded-full bg-slate-100 text-slate-600 px-2.5 py-0.5 text-xs font-medium hover:bg-slate-200 disabled:opacity-50"
      }
    >
      {pending ? "..." : value ? trueLabel : falseLabel}
    </button>
  );
}

// Same "pill with an inline edit + a separate open-in-new-tab icon" idea as
// ChecklistLinkCell (components/checklist/checklist-table.tsx), simplified
// to plain InlineText since this is a single detail-page field, not a dense
// table cell that needs a floating editor.
function PresaleFolderLink({
  value,
  canWrite,
  onSave,
}: {
  value: string | null;
  canWrite: boolean;
  onSave: (v: string) => Promise<void>;
}) {
  if (!canWrite) {
    return value ? (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline break-all"
      >
        <IconExternalLink className="h-3.5 w-3.5 shrink-0" />
        {value}
      </a>
    ) : (
      <p className="text-sm text-slate-400">—</p>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="min-w-0 flex-1">
        <InlineText value={value ?? ""} onSave={onSave} placeholder="Paste a SharePoint/Drive folder link" />
      </div>
      {value && (
        <a href={value} target="_blank" rel="noopener noreferrer" title="Open link" className="shrink-0 text-slate-400 hover:text-slate-700">
          <IconExternalLink className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}
