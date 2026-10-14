"use client";

import { useState, useTransition } from "react";
import clsx from "clsx";
import { InlineText, InlineTextarea, InlineDate } from "@/components/ui/inline-edit";
import { formatDate, toDateInputValue } from "@/lib/format";
import { createPresalesDecision, updatePresalesDecision, deletePresalesDecision } from "./decision-actions";

export type PresalesDecisionRowData = {
  id: string;
  date: Date | null;
  decision: string;
  rationale: string | null;
  decidedBy: string | null;
  decidedByPersonId: string | null;
  decidedByPersonName: string | null;
  notes: string | null;
};

/** Decisions as a dated timeline (newest first) — reads like the deal's history. */
export function PresalesDecisionLog({
  presalesProjectId,
  items,
  canWrite,
}: {
  presalesProjectId: string;
  items: PresalesDecisionRowData[];
  canWrite: boolean;
}) {
  const sorted = [...items].sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 px-5 py-3.5">
        <h2 className="text-base font-semibold text-slate-900">Decision log</h2>
        <p className="text-xs text-slate-500">What was agreed, and why — carried into the project if this deal is won.</p>
      </header>

      {canWrite && <QuickAddDecision presalesProjectId={presalesProjectId} />}

      {sorted.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-400">No decisions logged yet.</p>
      ) : (
        <ol className="relative mx-5 my-4 space-y-5 border-l-2 border-slate-100">
          {sorted.map((d) => (
            <DecisionEntry key={d.id} presalesProjectId={presalesProjectId} item={d} canWrite={canWrite} />
          ))}
        </ol>
      )}
    </section>
  );
}

function DecisionEntry({ presalesProjectId, item, canWrite }: { presalesProjectId: string; item: PresalesDecisionRowData; canWrite: boolean }) {
  const [pending, startTransition] = useTransition();
  const who = item.decidedByPersonName || item.decidedBy;

  return (
    <li className={clsx("relative pl-5", pending && "opacity-60")}>
      <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-blue-500 ring-2 ring-blue-100" aria-hidden />
      {canWrite ? (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-40">
              <InlineDate value={toDateInputValue(item.date)} onSave={(v) => updatePresalesDecision(item.id, presalesProjectId, { date: v })} />
            </div>
            <div className="w-48">
              <InlineText value={who ?? ""} placeholder="Decided by" onSave={(v) => updatePresalesDecision(item.id, presalesProjectId, { decidedBy: v })} />
            </div>
            <button
              type="button"
              onClick={() => {
                if (!window.confirm("Delete this decision?")) return;
                startTransition(() => deletePresalesDecision(item.id, presalesProjectId));
              }}
              disabled={pending}
              title="Delete decision"
              className="ml-auto rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-red-600"
            >
              ✕
            </button>
          </div>
          <InlineTextarea value={item.decision} onSave={(v) => updatePresalesDecision(item.id, presalesProjectId, { decision: v })} />
          <InlineTextarea value={item.rationale ?? ""} placeholder="Why? (rationale)" onSave={(v) => updatePresalesDecision(item.id, presalesProjectId, { rationale: v })} />
          {item.notes && (
            <InlineText value={item.notes} onSave={(v) => updatePresalesDecision(item.id, presalesProjectId, { notes: v })} />
          )}
        </div>
      ) : (
        <div>
          <p className="text-xs text-slate-400">
            {formatDate(item.date)}
            {who && ` · ${who}`}
          </p>
          <p className="mt-0.5 text-sm font-medium text-slate-900 whitespace-pre-wrap">{item.decision}</p>
          {item.rationale && <p className="mt-0.5 text-sm text-slate-600 whitespace-pre-wrap">{item.rationale}</p>}
          {item.notes && <p className="mt-0.5 text-xs text-slate-500">{item.notes}</p>}
        </div>
      )}
    </li>
  );
}

function QuickAddDecision({ presalesProjectId }: { presalesProjectId: string }) {
  const [decision, setDecision] = useState("");
  const [rationale, setRationale] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!decision.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await createPresalesDecision(presalesProjectId, { decision, rationale });
        setDecision("");
        setRationale("");
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
        placeholder="+ Log a decision, e.g. Client chose Quest 3 over Pico"
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
        disabled={pending}
      />
      {decision.trim() && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="Why? (optional)"
            className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
            disabled={pending}
          />
          <button type="submit" disabled={pending} className="shrink-0 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40">
            {pending ? "Logging..." : "Log decision"}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}
