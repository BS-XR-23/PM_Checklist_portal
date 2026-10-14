"use client";

import { useState, useTransition } from "react";
import clsx from "clsx";
import { InlineText, InlineDate } from "@/components/ui/inline-edit";
import { PersonPicker } from "@/components/resourcing/person-picker";
import { formatDate, formatShortDate, toDateInputValue } from "@/lib/format";
import { createPresalesActionItem, updatePresalesActionItem, deletePresalesActionItem } from "./action-item-actions";

export type PresalesActionItemRowData = {
  id: string;
  description: string;
  ownerPersonId: string | null;
  ownerPersonName: string | null;
  owner: string | null;
  dueDate: Date | null;
  status: string;
  notes: string | null;
};

const DAY_MS = 86_400_000;

/**
 * Action items as a to-do list — the deal's "what happens next". Open items
 * first (earliest due on top), done ones folded away; a one-line quick-add
 * instead of an "Add" button that creates a blank "New action item" card.
 */
export function PresalesNextSteps({
  presalesProjectId,
  items,
  canWrite,
  people,
}: {
  presalesProjectId: string;
  items: PresalesActionItemRowData[];
  canWrite: boolean;
  people: { id: string; name: string }[];
}) {
  const [showDone, setShowDone] = useState(false);
  const byDue = (a: PresalesActionItemRowData, b: PresalesActionItemRowData) =>
    (a.dueDate?.getTime() ?? Number.POSITIVE_INFINITY) - (b.dueDate?.getTime() ?? Number.POSITIVE_INFINITY);
  const open = items.filter((i) => i.status !== "Done").sort(byDue);
  const done = items.filter((i) => i.status === "Done");

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Next steps</h2>
          <p className="text-xs text-slate-500">Follow-ups from calls and meetings — the earliest due is shown on the pipeline card.</p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">{open.length} open</span>
      </header>

      <ul className="divide-y divide-slate-100">
        {open.map((item) => (
          <StepRow key={item.id} presalesProjectId={presalesProjectId} item={item} canWrite={canWrite} people={people} />
        ))}
        {open.length === 0 && <li className="px-5 py-4 text-sm text-slate-400">Nothing planned. What&apos;s the next thing that moves this deal forward?</li>}
      </ul>

      {canWrite && <QuickAddStep presalesProjectId={presalesProjectId} />}

      {done.length > 0 && (
        <div className="border-t border-slate-100">
          <button type="button" onClick={() => setShowDone((v) => !v)} className="w-full px-5 py-2.5 text-left text-xs font-medium text-slate-500 hover:text-slate-800">
            {showDone ? "▾" : "▸"} {done.length} completed
          </button>
          {showDone && (
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {done.map((item) => (
                <StepRow key={item.id} presalesProjectId={presalesProjectId} item={item} canWrite={canWrite} people={people} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function StepRow({
  presalesProjectId,
  item,
  canWrite,
  people,
}: {
  presalesProjectId: string;
  item: PresalesActionItemRowData;
  canWrite: boolean;
  people: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const isDone = item.status === "Done";
  const overdue = !isDone && item.dueDate !== null && item.dueDate.getTime() < Date.now() - DAY_MS;

  return (
    <li className={clsx("flex items-start gap-3 px-5 py-3", pending && "opacity-60")}>
      <button
        type="button"
        disabled={!canWrite || pending}
        onClick={() => startTransition(() => updatePresalesActionItem(item.id, presalesProjectId, { status: isDone ? "Open" : "Done" }))}
        title={isDone ? "Mark as open" : "Mark as done"}
        aria-label={isDone ? "Mark as open" : "Mark as done"}
        className={clsx(
          "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold transition-colors",
          isDone ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-transparent hover:border-emerald-500 hover:text-emerald-500",
          !canWrite && "cursor-default"
        )}
      >
        ✓
      </button>

      <div className="min-w-0 flex-1 space-y-1.5">
        {canWrite && !isDone ? (
          <InlineText value={item.description} onSave={(v) => updatePresalesActionItem(item.id, presalesProjectId, { description: v })} />
        ) : (
          <p className={clsx("text-sm", isDone ? "text-slate-400 line-through" : "font-medium text-slate-800")}>{item.description}</p>
        )}

        {canWrite && !isDone ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-44">
              <PersonPicker
                personId={item.ownerPersonId}
                legacyText={item.owner}
                people={people}
                onSave={(personId) => updatePresalesActionItem(item.id, presalesProjectId, { ownerPersonId: personId })}
              />
            </div>
            <div className="w-40">
              <InlineDate value={toDateInputValue(item.dueDate)} onSave={(v) => updatePresalesActionItem(item.id, presalesProjectId, { dueDate: v })} />
            </div>
            {overdue && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">Overdue</span>}
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            {item.ownerPersonName || item.owner || "Unassigned"}
            {item.dueDate && (
              <span className={clsx(overdue && "font-semibold text-red-600")} title={formatDate(item.dueDate)}>
                {" "}
                · due {formatShortDate(item.dueDate)}
              </span>
            )}
          </p>
        )}

        {(item.notes || (canWrite && !isDone)) &&
          (canWrite && !isDone ? (
            <InlineText
              value={item.notes ?? ""}
              placeholder="Add a note…"
              className="w-full min-w-0 truncate rounded border border-transparent bg-transparent px-1.5 py-0.5 text-xs text-slate-500 hover:border-slate-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
              onSave={(v) => updatePresalesActionItem(item.id, presalesProjectId, { notes: v })}
            />
          ) : (
            <p className="text-xs text-slate-500">{item.notes}</p>
          ))}
      </div>

      {canWrite && (
        <button
          type="button"
          onClick={() => {
            if (!window.confirm("Delete this next step?")) return;
            startTransition(() => deletePresalesActionItem(item.id, presalesProjectId));
          }}
          disabled={pending}
          title="Delete"
          className="mt-0.5 shrink-0 rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-red-600"
        >
          ✕
        </button>
      )}
    </li>
  );
}

function QuickAddStep({ presalesProjectId }: { presalesProjectId: string }) {
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await createPresalesActionItem(presalesProjectId, { description: text, dueDate: due || null });
        setText("");
        setDue("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add.");
      }
    });
  };

  return (
    <form onSubmit={submit} className="border-t border-slate-100 bg-slate-50/60 px-5 py-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="+ Add a next step, e.g. Send revised estimate"
          className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
          disabled={pending}
        />
        <div className="flex gap-2">
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            aria-label="Due date"
            className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-2 text-sm sm:w-40 sm:flex-none"
            disabled={pending}
          />
          <button
            type="submit"
            disabled={pending || !text.trim()}
            className="shrink-0 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
          >
            {pending ? "Adding..." : "Add"}
          </button>
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </form>
  );
}
