"use client";

import { useState, useTransition } from "react";
import clsx from "clsx";
import { InlineText, InlineDate } from "@/components/ui/inline-edit";
import { PersonPicker } from "@/components/resourcing/person-picker";
import { formatDate, formatShortDate, toDateInputValue } from "@/lib/format";
import { createActionItem, updateActionItem, deleteActionItem } from "../action-items/action-item-actions";

export type ActionItemData = {
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

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Project action items as a to-do list: open first (overdue, then by due
 * date, undated last), done folded away, and a one-line quick-add instead
 * of an "Add" button that created a blank "New action item" to edit.
 */
export function ActionItemsList({
  projectId,
  items,
  canWrite,
  people,
}: {
  projectId: string;
  items: ActionItemData[];
  canWrite: boolean;
  people: { id: string; name: string }[];
}) {
  const [showDone, setShowDone] = useState(false);
  const today = startOfToday();
  const open = items
    .filter((i) => i.status !== "Done")
    .sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity));
  const done = items.filter((i) => i.status === "Done");
  const overdue = open.filter((i) => i.dueDate && i.dueDate.getTime() < today).length;
  const thisWeek = open.filter((i) => i.dueDate && i.dueDate.getTime() >= today && i.dueDate.getTime() < today + 7 * DAY_MS).length;

  return (
    <section id="action-items" className="scroll-mt-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 px-5 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">Action items</h2>
          <a href={`/api/projects/${projectId}/action-items/export`} className="text-xs font-medium text-slate-500 hover:text-slate-800">
            Export .xlsx
          </a>
        </div>
        <p className="text-xs text-slate-500">Small follow-ups with an owner and a due date — too light for the Checklist, too easy to forget.</p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{open.length} open</span>
          {overdue > 0 && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-700">{overdue} overdue</span>}
          {thisWeek > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">{thisWeek} due this week</span>}
          {done.length > 0 && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">{done.length} done</span>}
        </div>
      </header>

      {canWrite && <QuickAdd projectId={projectId} people={people} />}

      <ul className="divide-y divide-slate-100">
        {open.map((item) => (
          <ActionRow key={item.id} projectId={projectId} item={item} canWrite={canWrite} people={people} today={today} />
        ))}
        {open.length === 0 && <li className="px-5 py-4 text-sm text-slate-400">Nothing open{done.length ? " — everything's done." : "."}</li>}
      </ul>

      {done.length > 0 && (
        <div className="border-t border-slate-100">
          <button type="button" onClick={() => setShowDone((v) => !v)} className="w-full px-5 py-2.5 text-left text-xs font-medium text-slate-500 hover:text-slate-800">
            {showDone ? "▾" : "▸"} {done.length} completed
          </button>
          {showDone && (
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {done.map((item) => (
                <ActionRow key={item.id} projectId={projectId} item={item} canWrite={canWrite} people={people} today={today} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function ActionRow({
  projectId,
  item,
  canWrite,
  people,
  today,
}: {
  projectId: string;
  item: ActionItemData;
  canWrite: boolean;
  people: { id: string; name: string }[];
  today: number;
}) {
  const [pending, startTransition] = useTransition();
  const isDone = item.status === "Done";
  const overdue = !isDone && item.dueDate != null && item.dueDate.getTime() < today;
  const ownerName = item.ownerPersonName || item.owner;
  // Undated items never reach Reminders or the Dashboard — call that out.
  const incomplete = !isDone && (!ownerName || !item.dueDate);

  return (
    <li className={clsx("flex items-start gap-3 px-5 py-3", pending && "opacity-60")}>
      <button
        type="button"
        disabled={!canWrite || pending}
        onClick={() => startTransition(() => updateActionItem(item.id, projectId, { status: isDone ? "Open" : "Done" }))}
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
          <InlineText value={item.description} onSave={(v) => updateActionItem(item.id, projectId, { description: v })} />
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
                onSave={(personId) => updateActionItem(item.id, projectId, { ownerPersonId: personId })}
              />
            </div>
            <div className="w-40">
              <InlineDate value={toDateInputValue(item.dueDate)} onSave={(v) => updateActionItem(item.id, projectId, { dueDate: v })} />
            </div>
            {overdue && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">Overdue</span>}
            {incomplete && (
              <span className="text-[11px] text-amber-700" title="Without an owner and a due date this never shows up in Reminders or on the Dashboard">
                needs {!ownerName && !item.dueDate ? "an owner and a date" : !ownerName ? "an owner" : "a date"}
              </span>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            {ownerName ?? "Unassigned"}
            {item.dueDate && (
              <span className={clsx(overdue && "font-semibold text-rose-600")} title={formatDate(item.dueDate)}>
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
              onSave={(v) => updateActionItem(item.id, projectId, { notes: v })}
            />
          ) : (
            <p className="text-xs text-slate-500">{item.notes}</p>
          ))}
      </div>

      {canWrite && (
        <button
          type="button"
          onClick={() => {
            if (!window.confirm(`Delete "${item.description}"?`)) return;
            startTransition(() => deleteActionItem(item.id, projectId));
          }}
          disabled={pending}
          title="Delete"
          aria-label="Delete action item"
          className="mt-0.5 shrink-0 rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-rose-600"
        >
          ✕
        </button>
      )}
    </li>
  );
}

function QuickAdd({ projectId, people }: { projectId: string; people: { id: string; name: string }[] }) {
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const [owner, setOwner] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await createActionItem(projectId, { description: text, dueDate: due || null, ownerPersonId: owner || null });
        setText("");
        setDue("");
        setOwner("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add.");
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-2 border-b border-slate-100 bg-slate-50/60 px-5 py-3">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="+ Add an action item, e.g. Send revised SOW to client"
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
        disabled={pending}
      />
      {text.trim() && (
        <div className="flex flex-wrap gap-2">
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            aria-label="Owner"
            className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-2 text-sm sm:max-w-[12rem]"
            disabled={pending}
          >
            <option value="">Owner…</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            aria-label="Due date"
            className="min-w-0 rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
            disabled={pending}
          />
          <button type="submit" disabled={pending} className="ml-auto shrink-0 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40">
            {pending ? "Adding..." : "Add"}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </form>
  );
}
