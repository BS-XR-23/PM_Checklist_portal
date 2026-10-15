"use client";

import { useState, useTransition } from "react";
import clsx from "clsx";
import { InlineText, InlineTextarea, InlineSelect, InlineDate, InlineNumber } from "@/components/ui/inline-edit";
import { CR_TYPES, CR_SIGNOFF_STATUSES, CR_WBS_UPDATED, CR_STATUSES } from "@/lib/constants";
import { crAmount } from "@/lib/calculations";
import { crWarnings } from "@/lib/risks";
import { formatMoney, formatDate, toDateInputValue } from "@/lib/format";
import { createChangeRequest, updateChangeRequest, deleteChangeRequest } from "./cr-actions";

export type CrRow = {
  id: string;
  crCode: string;
  title: string;
  dateRaised: Date | null;
  description: string | null;
  manDaysPlanned: number | null;
  billableManDays: number | null;
  rate: number | null; // null when stripped for Read Limited
  type: string;
  clientSignoff: string;
  wbsUpdated: string;
  status: string;
  notes: string | null; // null when stripped for Read Limited
};

const TYPE_STYLE: Record<string, { bg: string; text: string }> = {
  Paid: { bg: "#D1FAE5", text: "#065F46" },
  Free: { bg: "#DBEAFE", text: "#1D4ED8" },
  Exchange: { bg: "#EDE9FE", text: "#6D28D9" },
};

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  Proposed: { bg: "#FFE699", text: "#7A5B00" },
  Approved: { bg: "#DBEAFE", text: "#1D4ED8" },
  "In Progress": { bg: "#E0E7FF", text: "#4338CA" },
  Completed: { bg: "#C6E0B4", text: "#2C5F2D" },
  Rejected: { bg: "#E2E8F0", text: "#475569" },
};

const SIGNOFF_STYLE: Record<string, { bg: string; text: string }> = {
  Pending: { bg: "#FFE699", text: "#7A5B00" },
  Signed: { bg: "#C6E0B4", text: "#2C5F2D" },
  "Email Acknowledgement": { bg: "#DBEAFE", text: "#1D4ED8" },
};

/**
 * CRs as a list: open ones (proposed, approved, in progress) first, then
 * completed; rejected folded away. Each reads as text with its money line
 * and anything missing; "Edit" opens the fields.
 */
export function CrList({ projectId, rows, canWrite, financialsHidden }: { projectId: string; rows: CrRow[]; canWrite: boolean; financialsHidden: boolean }) {
  const [showRejected, setShowRejected] = useState(false);
  const open = rows.filter((r) => r.status !== "Completed" && r.status !== "Rejected");
  const completed = rows.filter((r) => r.status === "Completed");
  const rejected = rows.filter((r) => r.status === "Rejected");
  const item = (r: CrRow) => <CrItem key={r.id} projectId={projectId} row={r} canWrite={canWrite} financialsHidden={financialsHidden} />;

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      {canWrite && <QuickAdd projectId={projectId} />}
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-400">No change requests logged yet.</p>
      ) : (
        <>
          <Group title="Open" count={open.length}>
            {open.map(item)}
          </Group>
          {completed.length > 0 && (
            <Group title="Completed" count={completed.length}>
              {completed.map(item)}
            </Group>
          )}
          {rejected.length > 0 && (
            <div className="border-t border-slate-100">
              <button type="button" onClick={() => setShowRejected((v) => !v)} className="w-full px-4 py-2.5 text-left text-xs font-medium text-slate-500 hover:text-slate-800">
                {showRejected ? "▾" : "▸"} {rejected.length} rejected
              </button>
              {showRejected && <ul className="divide-y divide-slate-100 border-t border-slate-100">{rejected.map(item)}</ul>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Group({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-100 first:border-t-0">
      <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {title} · {count}
      </p>
      {count === 0 ? <p className="px-4 pb-3 text-sm text-slate-400">Nothing open.</p> : <ul className="divide-y divide-slate-100">{children}</ul>}
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

function moneyLine(r: CrRow, financialsHidden: boolean): string {
  const parts: string[] = [];
  if (r.manDaysPlanned != null) parts.push(`${r.manDaysPlanned} man-days planned`);
  if (r.billableManDays != null) {
    const amount = crAmount(r.billableManDays, r.rate);
    parts.push(
      !financialsHidden && r.rate != null && amount != null
        ? `${r.billableManDays} billable × ${formatMoney(r.rate)} = ${formatMoney(amount)}`
        : `${r.billableManDays} billable man-days`
    );
  }
  return parts.join(" · ");
}

function CrItem({ projectId, row, canWrite, financialsHidden }: { projectId: string; row: CrRow; canWrite: boolean; financialsHidden: boolean }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const save = (data: Parameters<typeof updateChangeRequest>[2]) => updateChangeRequest(row.id, projectId, data);
  const warnings = crWarnings(row, financialsHidden);
  const money = moneyLine(row, financialsHidden);

  return (
    <li className={clsx("px-4 py-3.5", pending && "opacity-60", row.status === "Rejected" && !editing && "opacity-75")}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 rounded-md bg-slate-100 px-1.5 py-1 font-mono text-[11px] font-semibold text-slate-600">{row.crCode}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900">{row.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Pill style={TYPE_STYLE[row.type] ?? TYPE_STYLE.Paid}>{row.type}</Pill>
            <Pill style={STATUS_STYLE[row.status] ?? STATUS_STYLE.Proposed}>{row.status}</Pill>
            <Pill style={SIGNOFF_STYLE[row.clientSignoff] ?? SIGNOFF_STYLE.Pending}>Sign-off: {row.clientSignoff}</Pill>
            <span className="text-[11px] text-slate-500">WBS updated: {row.wbsUpdated}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {row.dateRaised ? `Raised ${formatDate(row.dateRaised)}` : "No date raised"}
            {money && <> · {money}</>}
          </p>
          {row.description && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{row.description}</p>}
          {row.notes && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{row.notes}</p>}
          {warnings.length > 0 && <p className="mt-1 text-xs text-amber-700">{warnings.join(" · ")}</p>}
        </div>
        {canWrite && (
          <button type="button" onClick={() => setEditing((v) => !v)} className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-700">
            {editing ? "Done" : "Edit"}
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-3 space-y-2.5 rounded-lg border border-slate-200 bg-slate-50/60 p-3 sm:ml-14">
          <Field label="Title">
            <InlineText value={row.title} onSave={(v) => save({ title: v })} />
          </Field>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Field label="Type">
              <InlineSelect value={row.type} options={CR_TYPES} onSave={(v) => save({ type: v })} />
            </Field>
            <Field label="Status">
              <InlineSelect value={row.status} options={CR_STATUSES} onSave={(v) => save({ status: v })} />
            </Field>
            <Field label="Client sign-off">
              <InlineSelect value={row.clientSignoff} options={CR_SIGNOFF_STATUSES} onSave={(v) => save({ clientSignoff: v })} />
            </Field>
            <Field label="WBS updated">
              <InlineSelect value={row.wbsUpdated} options={CR_WBS_UPDATED} onSave={(v) => save({ wbsUpdated: v })} />
            </Field>
            <Field label="Date raised">
              <InlineDate value={toDateInputValue(row.dateRaised)} onSave={(v) => save({ dateRaised: v })} />
            </Field>
            <Field label="Man-days planned">
              <InlineNumber value={row.manDaysPlanned} step={0.5} onSave={(v) => save({ manDaysPlanned: v })} />
            </Field>
            <Field label="Billable man-days">
              <InlineNumber value={row.billableManDays} step={0.5} onSave={(v) => save({ billableManDays: v })} />
            </Field>
            {!financialsHidden && (
              <Field label="Rate per man-day">
                <InlineNumber value={row.rate} step={1} onSave={(v) => save({ rate: v })} />
              </Field>
            )}
          </div>
          <Field label="Description">
            <InlineTextarea value={row.description ?? ""} placeholder="What changes, and why" onSave={(v) => save({ description: v })} />
          </Field>
          <Field label="Notes">
            <InlineTextarea value={row.notes ?? ""} placeholder="Internal notes (hidden from Read Limited viewers)" onSave={(v) => save({ notes: v })} />
          </Field>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`Delete ${row.crCode}? It stays in the Activity log but disappears from the CR Log. To keep it on record, set its status to Rejected instead.`)) return;
              startTransition(() => deleteChangeRequest(row.id, projectId));
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

function QuickAdd({ projectId }: { projectId: string }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<string>("Paid");
  const [manDays, setManDays] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await createChangeRequest(projectId, { title, type, manDaysPlanned: manDays === "" ? null : Number(manDays) });
        setTitle("");
        setType("Paid");
        setManDays("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add.");
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="+ Log a change request, e.g. Add Arabic voice-over to the tour"
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
        disabled={pending}
      />
      {title.trim() && (
        <div className="flex flex-wrap items-center gap-2">
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type" className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm" disabled={pending}>
            {CR_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            Man-days (estimate)
            <input
              type="number"
              min={0}
              step={0.5}
              value={manDays}
              onChange={(e) => setManDays(e.target.value)}
              className="w-20 rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
              disabled={pending}
            />
          </label>
          <span className="text-xs text-slate-400">Starts as Proposed, raised today.</span>
          <button type="submit" disabled={pending} className="ml-auto shrink-0 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40">
            {pending ? "Adding..." : "Add"}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </form>
  );
}
