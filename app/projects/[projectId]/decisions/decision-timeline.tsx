"use client";

import { useState, useTransition } from "react";
import clsx from "clsx";
import { InlineText, InlineTextarea, InlineDate } from "@/components/ui/inline-edit";
import { IconSearch } from "@/components/layout/icons";
import { formatDate, formatMonthLabel, toDateInputValue } from "@/lib/format";
import { createDecision, updateDecision, deleteDecision } from "./decision-actions";

export type DecisionData = {
  id: string;
  date: Date | null;
  decision: string;
  rationale: string | null;
  decidedBy: string | null;
  decidedByPersonId: string | null;
  decidedByPersonName: string | null;
  notes: string | null;
};

// Local calendar month, matching formatDate() — decision dates are stored
// at local midnight, so a UTC month would file "Sep 1" under August.
function monthKey(d: Date | null): string {
  return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` : "none";
}

/**
 * The Decision Log as what it is — a dated record, newest first, grouped by
 * month, shown as text. Editing is an explicit per-entry "Edit" rather than
 * every field always being an input, and deleting asks first: these are
 * the entries meant to stop a decision being re-argued later.
 */
export function DecisionTimeline({ projectId, items, canWrite }: { projectId: string; items: DecisionData[]; canWrite: boolean }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = items
    .filter(
      (d) =>
        !q ||
        [d.decision, d.rationale, d.notes, d.decidedByPersonName, d.decidedBy].some((v) => (v ?? "").toLowerCase().includes(q))
    )
    .sort((a, b) => (b.date?.getTime() ?? -Infinity) - (a.date?.getTime() ?? -Infinity));

  const groups: { key: string; label: string; items: DecisionData[] }[] = [];
  for (const d of filtered) {
    const key = monthKey(d.date);
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, label: d.date ? formatMonthLabel(new Date(Date.UTC(d.date.getFullYear(), d.date.getMonth(), 1))) : "No date", items: [] };
      groups.push(g);
    }
    g.items.push(d);
  }

  return (
    <section id="decision-log" className="scroll-mt-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 px-5 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">Decision log</h2>
          <a href={`/api/projects/${projectId}/decisions/export`} className="text-xs font-medium text-slate-500 hover:text-slate-800">
            Export .xlsx
          </a>
        </div>
        <p className="text-xs text-slate-500">What was decided, when, by whom, and why — a permanent record so it doesn&apos;t get re-litigated later.</p>
        {items.length > 3 && (
          <div className="relative mt-2">
            <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${items.length} decisions…`}
              className="w-full rounded-md border border-slate-200 pl-8 pr-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>
        )}
      </header>

      {canWrite && <QuickAdd projectId={projectId} />}

      {items.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-400">No decisions logged yet.</p>
      ) : filtered.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-400">No decisions match &ldquo;{query}&rdquo;.</p>
      ) : (
        <div className="space-y-5 px-5 py-4">
          {groups.map((g) => (
            <div key={g.key}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{g.label}</p>
              <ol className="relative space-y-4 border-l-2 border-slate-100">
                {g.items.map((d) => (
                  <DecisionEntry key={d.id} projectId={projectId} item={d} canWrite={canWrite} />
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function DecisionEntry({ projectId, item, canWrite }: { projectId: string; item: DecisionData; canWrite: boolean }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const who = item.decidedByPersonName || item.decidedBy;

  return (
    <li className={clsx("relative pl-5", pending && "opacity-60")}>
      <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-blue-500 ring-2 ring-blue-100" aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-slate-400">
          {item.date ? formatDate(item.date) : "No date"}
          {who && <> · decided by <span className="font-medium text-slate-600">{who}</span></>}
        </p>
        {canWrite && (
          <div className="flex shrink-0 items-center gap-2 text-xs">
            {editing && (
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm("Delete this decision from the log? It stays in the Activity log, but disappears from here.")) return;
                  startTransition(() => deleteDecision(item.id, projectId));
                }}
                disabled={pending}
                className="font-medium text-rose-600 hover:text-rose-700"
              >
                Delete
              </button>
            )}
            <button type="button" onClick={() => setEditing((v) => !v)} className="font-medium text-indigo-600 hover:text-indigo-700">
              {editing ? "Done" : "Edit"}
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="mt-1.5 space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="mb-0.5 block text-[11px] text-slate-500">Date</span>
              <InlineDate value={toDateInputValue(item.date)} onSave={(v) => updateDecision(item.id, projectId, { date: v })} />
            </label>
            <label className="block">
              {/* Free text, not a Person picker — "decided by" is often a client
                  or company (e.g. "DED"), not one person. */}
              <span className="mb-0.5 block text-[11px] text-slate-500">Decided by</span>
              <InlineText value={who ?? ""} placeholder="Person, team or client" onSave={(v) => updateDecision(item.id, projectId, { decidedBy: v })} />
            </label>
          </div>
          <label className="block">
            <span className="mb-0.5 block text-[11px] text-slate-500">Decision</span>
            <InlineTextarea value={item.decision} onSave={(v) => updateDecision(item.id, projectId, { decision: v })} />
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[11px] text-slate-500">Why (rationale)</span>
            <InlineTextarea value={item.rationale ?? ""} onSave={(v) => updateDecision(item.id, projectId, { rationale: v })} />
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[11px] text-slate-500">Notes</span>
            <InlineTextarea value={item.notes ?? ""} onSave={(v) => updateDecision(item.id, projectId, { notes: v })} />
          </label>
        </div>
      ) : (
        <div className="mt-0.5">
          <p className="whitespace-pre-wrap text-sm font-medium text-slate-900">{item.decision}</p>
          {item.rationale && (
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
              <span className="text-slate-400">Why: </span>
              {item.rationale}
            </p>
          )}
          {item.notes && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{item.notes}</p>}
          {!who && canWrite && <p className="mt-1 text-[11px] text-amber-700">Who decided this? Add it with Edit.</p>}
        </div>
      )}
    </li>
  );
}

function QuickAdd({ projectId }: { projectId: string }) {
  const [decision, setDecision] = useState("");
  const [rationale, setRationale] = useState("");
  const [decidedBy, setDecidedBy] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!decision.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await createDecision(projectId, { decision, rationale, decidedBy });
        setDecision("");
        setRationale("");
        setDecidedBy("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add.");
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-2 border-b border-slate-100 bg-slate-50/60 px-5 py-3">
      <input
        value={decision}
        onChange={(e) => setDecision(e.target.value)}
        placeholder="+ Log a decision, e.g. Client approved the Phase 1 split"
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
        disabled={pending}
      />
      {decision.trim() && (
        <>
          <textarea
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="Why? (rationale)"
            rows={2}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
            disabled={pending}
          />
          <div className="flex flex-wrap gap-2">
            <input
              value={decidedBy}
              onChange={(e) => setDecidedBy(e.target.value)}
              placeholder="Decided by (person, team or client)"
              className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
              disabled={pending}
            />
            <button type="submit" disabled={pending} className="shrink-0 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40">
              {pending ? "Logging..." : "Log decision (today)"}
            </button>
          </div>
        </>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </form>
  );
}
