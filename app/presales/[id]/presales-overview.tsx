"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { InlineText, InlineTextarea, InlineNumber, InlineDate } from "@/components/ui/inline-edit";
import { formatMoney, formatDate, toDateInputValue } from "@/lib/format";
import { RAG_COLORS } from "@/lib/rag";
import { updatePresalesProject, winPresalesProject, markPresalesLost, reopenPresalesProject } from "../actions";
import type { PresalesOutcome } from "@prisma/client";

export type PresalesOverviewData = {
  id: string;
  name: string;
  client: string | null;
  description: string | null;
  estimatedValue: number | null;
  expectedCloseDate: Date | null;
  outcome: PresalesOutcome;
  lostReason: string | null;
  wonProject: { id: string; name: string } | null;
};

const OUTCOME_BADGE: Record<PresalesOutcome, { bg: string; text: string; label: string }> = {
  OPEN: RAG_COLORS.AMBER,
  WON: RAG_COLORS.GREEN,
  LOST: RAG_COLORS.RED,
};

export function PresalesOverview({ data, canWrite }: { data: PresalesOverviewData; canWrite: boolean }) {
  const badge = OUTCOME_BADGE[data.outcome];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          {canWrite ? (
            <InlineText value={data.name} onSave={(v) => updatePresalesProject(data.id, { name: v })} />
          ) : (
            <h1 className="text-lg font-semibold text-slate-900">{data.name}</h1>
          )}
          {canWrite ? (
            <InlineText value={data.client ?? ""} onSave={(v) => updatePresalesProject(data.id, { client: v })} placeholder="Client" />
          ) : (
            data.client && <p className="text-sm text-slate-500">{data.client}</p>
          )}
        </div>
        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0" style={{ backgroundColor: badge.bg, color: badge.text }}>
          {data.outcome === "OPEN" ? "Open" : data.outcome === "WON" ? "Won" : "Lost"}
        </span>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">Estimated Value</p>
          {canWrite ? (
            <InlineNumber value={data.estimatedValue} onSave={(v) => updatePresalesProject(data.id, { estimatedValue: v })} step={0.01} />
          ) : (
            <p className="text-sm text-slate-800">{data.estimatedValue ? formatMoney(data.estimatedValue) : "—"}</p>
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
      </div>

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
