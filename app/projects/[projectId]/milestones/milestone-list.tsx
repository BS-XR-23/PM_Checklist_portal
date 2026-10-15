"use client";

import { useState, useTransition } from "react";
import clsx from "clsx";
import type { MilestoneType } from "@prisma/client";
import { InlineDate, InlinePercent, InlineSelect, InlineText, InlineTextarea } from "@/components/ui/inline-edit";
import { PersonPicker } from "@/components/resourcing/person-picker";
import { STATUS_COLORS } from "@/lib/colors";
import { INVOICE_STATUSES, ITEM_STATUSES, MILESTONE_TYPES, MILESTONE_TYPE_LABELS, SIGNOFF_STATUSES, type ItemStatus } from "@/lib/constants";
import { formatDate, formatMoney, formatPct, toDateInputValue } from "@/lib/format";
import { trancheAmount } from "@/lib/calculations";
import type { MilestoneFlag } from "@/lib/milestones";
import { createMilestone, updateMilestone, updateMilestonePayment, deleteMilestone } from "./milestone-actions";

export type MilestoneRow = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  acceptanceCriteria: string | null;
  plannedDate: Date | null;
  forecastDate: Date | null;
  actualDate: Date | null;
  status: ItemStatus;
  ownerPersonId: string | null;
  ownerName: string | null;
  // Payment fields are null when the viewer can't see money (Read Limited).
  paymentPct: number | null;
  invoiceStatus: string | null;
  clientSignoff: string;
  notes: string | null;
  checkpointsDone: number;
  checkpointsTotal: number;
  flags: MilestoneFlag[];
};

const SIGNOFF_STYLE: Record<string, { bg: string; text: string }> = {
  Pending: { bg: "#FEF3C7", text: "#92400E" },
  Signed: { bg: "#DCFCE7", text: "#166534" },
  Acknowledged: { bg: "#DBEAFE", text: "#1D4ED8" },
  "N/A": { bg: "#F1F5F9", text: "#475569" },
};

const INVOICE_STYLE: Record<string, { bg: string; text: string }> = {
  "Not Invoiced": { bg: "#F1F5F9", text: "#475569" },
  Invoiced: { bg: "#FEF3C7", text: "#92400E" },
  Paid: { bg: "#DCFCE7", text: "#166534" },
};

const FLAG_STYLE: Record<MilestoneFlag["tone"], string> = {
  red: "bg-rose-50 text-rose-700",
  amber: "bg-amber-50 text-amber-800",
  blue: "bg-blue-50 text-blue-700",
};

/**
 * Milestones as a date-ordered timeline. Each reads as text — status, when
 * it's due (or was done), the payment tranche and its invoice and sign-off —
 * with anything contradictory flagged on the item. "Edit" opens the fields.
 */
export function MilestoneList({
  projectId,
  rows,
  contractValue,
  canWrite,
  showMoney,
  people,
}: {
  projectId: string;
  rows: MilestoneRow[]; // already in timeline order
  contractValue: number;
  canWrite: boolean;
  showMoney: boolean;
  people: { id: string; name: string }[];
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      {canWrite && <QuickAdd projectId={projectId} showMoney={showMoney} />}
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-sm font-medium text-slate-700">No milestones yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Add what this project delivers to the client — e.g. Phase 1 MVP, UAT Complete, Go-Live — and split the contract&apos;s payment across them.
          </p>
        </div>
      ) : (
        <ol className="relative px-4 py-4">
          {rows.map((m, i) => (
            <MilestoneItem
              key={m.id}
              projectId={projectId}
              row={m}
              last={i === rows.length - 1}
              contractValue={contractValue}
              canWrite={canWrite}
              showMoney={showMoney}
              people={people}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function Pill({ style, children, title }: { style: { bg: string; text: string }; children: React.ReactNode; title?: string }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: style.bg, color: style.text }} title={title}>
      {children}
    </span>
  );
}

function whenLine(m: MilestoneRow): string {
  if (m.status === "NOT_APPLICABLE") return "Not applicable";
  if (m.status === "COMPLETED") return m.actualDate ? `Done ${formatDate(m.actualDate)}` : "Done";
  const due = m.forecastDate ?? m.plannedDate;
  if (!due) return "No date yet";
  return m.forecastDate && m.plannedDate && m.forecastDate.getTime() !== m.plannedDate.getTime()
    ? `Due ${formatDate(m.forecastDate)} (planned ${formatDate(m.plannedDate)})`
    : `Due ${formatDate(due)}`;
}

function MilestoneItem({
  projectId,
  row: m,
  last,
  contractValue,
  canWrite,
  showMoney,
  people,
}: {
  projectId: string;
  row: MilestoneRow;
  last: boolean;
  contractValue: number;
  canWrite: boolean;
  showMoney: boolean;
  people: { id: string; name: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const status = STATUS_COLORS[m.status] ?? STATUS_COLORS.NOT_STARTED;
  const done = m.status === "COMPLETED" || m.status === "NOT_APPLICABLE";
  const saveM = (data: Parameters<typeof updateMilestone>[2]) => updateMilestone(m.id, projectId, data);
  const saveP = (data: Parameters<typeof updateMilestonePayment>[2]) => updateMilestonePayment(m.id, projectId, data);

  return (
    <li className={clsx("relative pl-7", !last && "pb-5", pending && "opacity-60")}>
      {!last && <span className="absolute left-[7px] top-4 bottom-0 w-0.5 bg-slate-100" aria-hidden />}
      <span
        className="absolute left-0 top-1 h-4 w-4 rounded-full border-2 border-white ring-2"
        style={{ backgroundColor: done ? "#16A34A" : status.bg, ["--tw-ring-color" as string]: done ? "#BBF7D0" : "#E2E8F0" }}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-semibold text-slate-900">{m.name}</p>
            <Pill style={status}>{status.label}</Pill>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            <span className="font-medium text-slate-700">{whenLine(m)}</span>
            {" · "}
            {MILESTONE_TYPE_LABELS[m.type] ?? m.type}
            {m.ownerName ? <> · owner {m.ownerName}</> : null}
            {m.checkpointsTotal > 0 && (
              <span title="Checklist checkpoints linked to this milestone">
                {" "}
                · checkpoints {m.checkpointsDone}/{m.checkpointsTotal}
              </span>
            )}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {showMoney && m.paymentPct != null && m.paymentPct > 0 && (
              <>
                <span className="text-xs font-semibold text-slate-800">
                  {formatMoney(trancheAmount(contractValue, m.paymentPct))} <span className="font-normal text-slate-400">({formatPct(m.paymentPct)})</span>
                </span>
                <Pill style={INVOICE_STYLE[m.invoiceStatus ?? "Not Invoiced"] ?? INVOICE_STYLE["Not Invoiced"]}>{m.invoiceStatus}</Pill>
              </>
            )}
            {showMoney && (m.paymentPct ?? 0) === 0 && <span className="text-[11px] text-slate-400">No payment</span>}
            <Pill style={SIGNOFF_STYLE[m.clientSignoff] ?? SIGNOFF_STYLE["N/A"]}>Sign-off: {m.clientSignoff}</Pill>
          </div>
          {m.description && <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-600">{m.description}</p>}
          {m.acceptanceCriteria && (
            <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">
              <span className="text-slate-400">Accepted when: </span>
              {m.acceptanceCriteria}
            </p>
          )}
          {m.notes && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{m.notes}</p>}
          {m.flags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {m.flags.map((f) => (
                <span key={f.text} className={clsx("rounded-md px-1.5 py-0.5 text-[11px] font-medium", FLAG_STYLE[f.tone])}>
                  {f.text}
                </span>
              ))}
            </div>
          )}
        </div>
        {canWrite && (
          <button type="button" onClick={() => setEditing((v) => !v)} className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-700">
            {editing ? "Done" : "Edit"}
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-3 space-y-2.5 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_1fr]">
            <Field label="Name">
              <InlineText value={m.name} onSave={(v) => saveM({ name: v })} />
            </Field>
            <Field label="Type">
              <InlineSelect value={m.type} options={MILESTONE_TYPES} renderOption={(t) => MILESTONE_TYPE_LABELS[t] ?? t} onSave={(v) => saveM({ type: v as MilestoneType })} />
            </Field>
            <Field label="Status">
              <InlineSelect value={m.status} options={ITEM_STATUSES} renderOption={(s) => STATUS_COLORS[s as ItemStatus]?.label ?? s} onSave={(v) => saveM({ status: v })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Field label="Owner">
              <PersonPicker personId={m.ownerPersonId} legacyText={null} people={people} onSave={(personId) => saveM({ ownerPersonId: personId })} />
            </Field>
            <Field label="Planned date">
              <InlineDate value={toDateInputValue(m.plannedDate)} onSave={(v) => saveM({ plannedDate: v })} />
            </Field>
            <Field label="Forecast (if moved)">
              <InlineDate value={toDateInputValue(m.forecastDate)} onSave={(v) => saveM({ forecastDate: v })} />
            </Field>
            <Field label="Actual (done on)">
              {/* Keyed so a status change that stamps/clears this on the server shows up here. */}
              <InlineDate key={toDateInputValue(m.actualDate) ?? "none"} value={toDateInputValue(m.actualDate)} onSave={(v) => saveM({ actualDate: v })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {showMoney && (
              <>
                <Field label={`Payment % (${formatMoney(trancheAmount(contractValue, m.paymentPct ?? 0))})`}>
                  <InlinePercent value={m.paymentPct ?? 0} onSave={(v) => saveP({ paymentPct: v })} />
                </Field>
                <Field label="Invoice">
                  <InlineSelect value={m.invoiceStatus ?? "Not Invoiced"} options={INVOICE_STATUSES} onSave={(v) => saveP({ invoiceStatus: v })} />
                </Field>
              </>
            )}
            <Field label="Client sign-off">
              <InlineSelect value={m.clientSignoff} options={SIGNOFF_STATUSES} onSave={(v) => saveP({ clientSignoff: v })} />
            </Field>
          </div>
          <Field label="Description">
            <InlineTextarea value={m.description ?? ""} placeholder="What's delivered" onSave={(v) => saveM({ description: v })} />
          </Field>
          <Field label="Acceptance criteria">
            <InlineTextarea value={m.acceptanceCriteria ?? ""} placeholder="How the client will accept it" onSave={(v) => saveM({ acceptanceCriteria: v })} />
          </Field>
          <Field label="Payment notes">
            <InlineTextarea value={m.notes ?? ""} placeholder="Internal notes (hidden from Read Limited viewers)" onSave={(v) => saveP({ notes: v })} />
          </Field>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`Delete milestone "${m.name}" and its payment details? This can't be undone.`)) return;
              setError(null);
              startTransition(async () => {
                try {
                  await deleteMilestone(m.id, projectId);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed to delete.");
                }
              });
            }}
            className="text-xs font-medium text-rose-600 hover:text-rose-700"
          >
            Delete milestone
          </button>
          {error && <p className="text-xs text-rose-600">{error}</p>}
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

function QuickAdd({ projectId, showMoney }: { projectId: string; showMoney: boolean }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<MilestoneType>("DEVELOPMENT");
  const [plannedDate, setPlannedDate] = useState("");
  const [pct, setPct] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const field = "rounded-md border border-slate-300 bg-white px-2 py-2 text-sm";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await createMilestone(projectId, { name, type, plannedDate: plannedDate || null, paymentPct: pct === "" ? null : Number(pct) / 100 });
        setName("");
        setType("DEVELOPMENT");
        setPlannedDate("");
        setPct("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add.");
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="+ Add a milestone, e.g. Phase 1 MVP delivered"
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
        disabled={pending}
      />
      {name.trim() && (
        <div className="flex flex-wrap items-center gap-2">
          <select value={type} onChange={(e) => setType(e.target.value as MilestoneType)} aria-label="Type" className={field} disabled={pending}>
            {MILESTONE_TYPES.map((t) => (
              <option key={t} value={t}>
                {MILESTONE_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            Planned
            <input type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} className={field} disabled={pending} />
          </label>
          {showMoney && (
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              Payment
              <input type="number" min={0} max={100} step={1} value={pct} onChange={(e) => setPct(e.target.value)} className={clsx(field, "w-20")} disabled={pending} />
              %
            </label>
          )}
          <button type="submit" disabled={pending} className="ml-auto shrink-0 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40">
            {pending ? "Adding..." : "Add"}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </form>
  );
}
