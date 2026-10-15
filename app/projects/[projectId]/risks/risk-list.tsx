"use client";

import { useState, useTransition } from "react";
import clsx from "clsx";
import { InlineText, InlineTextarea, InlineSelect, InlineDate } from "@/components/ui/inline-edit";
import { PersonPicker } from "@/components/resourcing/person-picker";
import { RISK_LEVELS, RISK_STATUSES, RISK_TYPES } from "@/lib/constants";
import { RISK_SEVERITY_COLORS, riskScoreSeverity, tagPillStyle } from "@/lib/colors";
import { riskScore } from "@/lib/calculations";
import { isRiskOpen } from "@/lib/risks";
import { formatDate, toDateInputValue } from "@/lib/format";
import { createRisk, updateRisk, deleteRisk } from "./risk-actions";

export type RiskRow = {
  id: string;
  type: string;
  category: string | null;
  description: string;
  probability: string;
  impact: string;
  owner: string | null;
  ownerPersonId: string | null;
  ownerPersonName: string | null;
  mitigation: string | null;
  status: string;
  dateRaised: Date | null;
  dateClosed: Date | null;
  notes: string | null; // null for Read Limited viewers
};

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  Open: { bg: "#E0E7FF", text: "#4338CA" },
  Monitoring: { bg: "#DBEAFE", text: "#1D4ED8" },
  Realized: { bg: "#FF7C80", text: "#7A0000" },
  Mitigated: { bg: "#D1FAE5", text: "#065F46" },
  Closed: { bg: "#E2E8F0", text: "#475569" },
  "Not Pursued": { bg: "#E2E8F0", text: "#475569" },
};

const TYPE_STYLE: Record<string, { bg: string; text: string }> = {
  Risk: { bg: "#FEF3C7", text: "#92400E" },
  Issue: { bg: "#FFE4E6", text: "#9F1239" },
  Opportunity: { bg: "#DCFCE7", text: "#166534" },
};

// Opportunities are scored the same way but a high score is good news, so
// their badge isn't painted red.
const OPPORTUNITY_BADGE = { bg: "#DBEAFE", text: "#1D4ED8" };

const TYPE_FILTERS = ["All", "Risk", "Issue", "Opportunity"] as const;
const PLURAL: Record<string, string> = { Risk: "Risks", Issue: "Issues", Opportunity: "Opportunities" };

/**
 * The register as a worst-first list: open items on top by score, closed
 * ones folded away. Items read as text; "Edit" opens all fields for one.
 */
export function RiskList({
  projectId,
  rows,
  canWrite,
  people,
}: {
  projectId: string;
  rows: RiskRow[]; // already sorted (lib/risks.ts sortRisks)
  canWrite: boolean;
  people: { id: string; name: string }[];
}) {
  const [filter, setFilter] = useState<(typeof TYPE_FILTERS)[number]>("All");
  const [showClosed, setShowClosed] = useState(false);
  const typesPresent = new Set(rows.map((r) => r.type));
  const visible = rows.filter((r) => filter === "All" || r.type === filter);
  const open = visible.filter((r) => isRiskOpen(r.status));
  const closed = visible.filter((r) => !isRiskOpen(r.status));

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      {canWrite && <QuickAdd projectId={projectId} people={people} />}

      {typesPresent.size > 1 && (
        <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-4 py-2.5">
          {TYPE_FILTERS.filter((t) => t === "All" || typesPresent.has(t)).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilter(t)}
              className={clsx(
                "rounded-full px-2.5 py-1 text-xs font-medium",
                filter === t ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {t === "All" ? `All · ${rows.length}` : `${PLURAL[t]} · ${rows.filter((r) => r.type === t).length}`}
            </button>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-400">No risks, issues or opportunities logged yet.</p>
      ) : (
        <>
          <ul className="divide-y divide-slate-100">
            {open.map((r) => (
              <RiskItem key={r.id} projectId={projectId} row={r} canWrite={canWrite} people={people} />
            ))}
            {open.length === 0 && <li className="px-4 py-4 text-sm text-slate-400">Nothing open{closed.length ? " — everything here is closed." : "."}</li>}
          </ul>
          {closed.length > 0 && (
            <div className="border-t border-slate-100">
              <button type="button" onClick={() => setShowClosed((v) => !v)} className="w-full px-4 py-2.5 text-left text-xs font-medium text-slate-500 hover:text-slate-800">
                {showClosed ? "▾" : "▸"} {closed.length} closed (mitigated, closed or not pursued)
              </button>
              {showClosed && (
                <ul className="divide-y divide-slate-100 border-t border-slate-100">
                  {closed.map((r) => (
                    <RiskItem key={r.id} projectId={projectId} row={r} canWrite={canWrite} people={people} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Pill({ style, children }: { style: { bg: string; text: string }; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: style.bg, color: style.text }}>
      {children}
    </span>
  );
}

function RiskItem({
  projectId,
  row,
  canWrite,
  people,
}: {
  projectId: string;
  row: RiskRow;
  canWrite: boolean;
  people: { id: string; name: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const score = riskScore(row.probability, row.impact);
  const severity = RISK_SEVERITY_COLORS[riskScoreSeverity(score)];
  const isOpportunity = row.type === "Opportunity";
  const badge = isOpportunity ? OPPORTUNITY_BADGE : severity;
  const open = isRiskOpen(row.status);
  const owner = row.ownerPersonName || row.owner;
  const save = (data: Parameters<typeof updateRisk>[2]) => updateRisk(row.id, projectId, data);
  const needsPlan = open && !isOpportunity && score >= 3 && !row.mitigation;

  return (
    <li className={clsx("px-4 py-3.5", pending && "opacity-60", !open && !editing && "opacity-75")}>
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg leading-none"
          style={{ backgroundColor: badge.bg, color: badge.text }}
          title={`${row.probability} probability × ${row.impact} impact = ${score}`}
        >
          <span className="text-sm font-bold">{score}</span>
          <span className="mt-0.5 text-[9px] font-semibold uppercase">{isOpportunity ? "opp." : severity.label}</span>
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill style={TYPE_STYLE[row.type] ?? TYPE_STYLE.Risk}>{row.type}</Pill>
            <Pill style={STATUS_STYLE[row.status] ?? STATUS_STYLE.Open}>{row.status}</Pill>
            {row.category && <Pill style={tagPillStyle(row.category)}>{row.category}</Pill>}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-slate-900">{row.description}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {row.probability} probability × {row.impact} impact · {owner ? <>owner <span className="font-medium text-slate-600">{owner}</span></> : <span className="text-amber-700">no owner</span>}
            {row.dateRaised && <> · raised {formatDate(row.dateRaised)}</>}
            {!open && row.dateClosed && <> · closed {formatDate(row.dateClosed)}</>}
          </p>
          {row.mitigation ? (
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
              <span className="text-slate-400">{isOpportunity ? "Plan: " : "Mitigation: "}</span>
              {row.mitigation}
            </p>
          ) : (
            needsPlan && <p className="mt-1 text-xs text-amber-700">No mitigation plan yet{canWrite ? " — add one with Edit." : "."}</p>
          )}
          {row.notes && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{row.notes}</p>}
        </div>

        {canWrite && (
          <button type="button" onClick={() => setEditing((v) => !v)} className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-700">
            {editing ? "Done" : "Edit"}
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-3 space-y-2.5 rounded-lg border border-slate-200 bg-slate-50/60 p-3 sm:ml-[3.25rem]">
          <Field label="Description">
            <InlineTextarea value={row.description} onSave={(v) => save({ description: v })} />
          </Field>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Field label="Type">
              <InlineSelect value={row.type} options={RISK_TYPES} onSave={(v) => save({ type: v })} />
            </Field>
            <Field label="Probability">
              <InlineSelect value={row.probability} options={RISK_LEVELS} onSave={(v) => save({ probability: v })} />
            </Field>
            <Field label="Impact">
              <InlineSelect value={row.impact} options={RISK_LEVELS} onSave={(v) => save({ impact: v })} />
            </Field>
            <Field label="Status">
              <InlineSelect value={row.status} options={RISK_STATUSES} onSave={(v) => save({ status: v })} />
            </Field>
            <Field label="Owner">
              <PersonPicker personId={row.ownerPersonId} legacyText={row.owner} people={people} onSave={(personId) => save({ ownerPersonId: personId })} />
            </Field>
            <Field label="Category">
              <InlineText value={row.category ?? ""} placeholder="e.g. Technical, Client" onSave={(v) => save({ category: v })} />
            </Field>
            <Field label="Date raised">
              <InlineDate value={toDateInputValue(row.dateRaised)} onSave={(v) => save({ dateRaised: v })} />
            </Field>
            <Field label="Date closed">
              {/* Keyed so a status change that stamps/clears this date on the server shows up here. */}
              <InlineDate key={toDateInputValue(row.dateClosed) ?? "none"} value={toDateInputValue(row.dateClosed)} onSave={(v) => save({ dateClosed: v })} />
            </Field>
          </div>
          <Field label={isOpportunity ? "Plan to take it" : "Mitigation / response plan"}>
            <InlineTextarea value={row.mitigation ?? ""} placeholder="What's being done about it" onSave={(v) => save({ mitigation: v })} />
          </Field>
          <Field label="Notes">
            <InlineTextarea value={row.notes ?? ""} placeholder="Internal notes (hidden from Read Limited viewers)" onSave={(v) => save({ notes: v })} />
          </Field>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`Delete this ${row.type.toLowerCase()}? It stays in the Activity log but disappears from the register. To keep it on record, set its status to Closed instead.`)) return;
              startTransition(() => deleteRisk(row.id, projectId));
            }}
            className="text-xs font-medium text-rose-600 hover:text-rose-700"
          >
            Delete
          </button>
        </div>
      )}
    </li>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-0.5 block text-[11px] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function QuickAdd({ projectId, people }: { projectId: string; people: { id: string; name: string }[] }) {
  const [description, setDescription] = useState("");
  const [type, setType] = useState<string>("Risk");
  const [probability, setProbability] = useState("Medium");
  const [impact, setImpact] = useState("Medium");
  const [owner, setOwner] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const select = "min-w-0 rounded-md border border-slate-300 bg-white px-2 py-2 text-sm";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await createRisk(projectId, { description, type, probability, impact, ownerPersonId: owner || null });
        setDescription("");
        setType("Risk");
        setProbability("Medium");
        setImpact("Medium");
        setOwner("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add.");
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="+ Log a risk, issue or opportunity — what could go wrong (or right)?"
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
        disabled={pending}
      />
      {description.trim() && (
        <div className="flex flex-wrap items-center gap-2">
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type" className={select} disabled={pending}>
            {RISK_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-xs text-slate-500">
            Probability
            <select value={probability} onChange={(e) => setProbability(e.target.value)} className={select} disabled={pending}>
              {RISK_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1 text-xs text-slate-500">
            Impact
            <select value={impact} onChange={(e) => setImpact(e.target.value)} className={select} disabled={pending}>
              {RISK_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <select value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Owner" className={clsx(select, "sm:max-w-[12rem]")} disabled={pending}>
            <option value="">Owner…</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button type="submit" disabled={pending} className="ml-auto shrink-0 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40">
            {pending ? "Adding..." : "Add"}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </form>
  );
}
