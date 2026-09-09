"use client";

import { useState, useTransition } from "react";
import { ITEM_STATUSES, type ItemStatus } from "@/lib/constants";
import type { ChecklistType } from "@/lib/checklist-types";
import { STATUS_COLORS } from "@/lib/colors";
import { toDateInputValue } from "@/lib/format";
import { tpmOverrideChecklistItem } from "@/app/projects/[projectId]/checklist-actions";

export function TpmOverrideChecklistModal({
  projectId,
  checklistType,
  item,
}: {
  projectId: string;
  checklistType: ChecklistType;
  item: {
    id: string;
    itemText: string;
    owner: string | null;
    plannedDate: Date | null;
    actualDate: Date | null;
    link: string | null;
    status: string;
    notes: string | null;
  };
}) {
  const [open, setOpen] = useState(false);
  const [owner, setOwner] = useState(item.owner ?? "");
  const [plannedDate, setPlannedDate] = useState(toDateInputValue(item.plannedDate) ?? "");
  const [actualDate, setActualDate] = useState(toDateInputValue(item.actualDate) ?? "");
  const [link, setLink] = useState(item.link ?? "");
  const [status, setStatus] = useState(item.status);
  const [notes, setNotes] = useState(item.notes ?? "");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="TPM override — edits this PM's data directly, logged distinctly"
        className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 hover:bg-amber-100 whitespace-nowrap"
      >
        Override
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-5 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">TPM Override</h3>
          <p className="text-xs text-slate-500 mt-0.5">{item.itemText}</p>
        </div>

        <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
          This edits the PM&apos;s data directly. It will be logged and shown as a distinct &quot;TPM Override&quot;
          in the Activity log — never blended in as if the PM made the change.
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Owner</label>
            <input value={owner} onChange={(e) => setOwner(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              style={{ backgroundColor: STATUS_COLORS[status as ItemStatus].bg, color: STATUS_COLORS[status as ItemStatus].text }}
            >
              {ITEM_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_COLORS[s].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Planned Date</label>
            <input type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Actual Date</label>
            <input type="date" value={actualDate} onChange={(e) => setActualDate(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Link</label>
          <input value={link} onChange={(e) => setLink(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Reason for override *</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            required
            placeholder="Why is a TPM changing this instead of the PM?"
            className="w-full rounded border border-amber-300 px-2 py-1.5 text-sm"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={() => setOpen(false)}
            disabled={pending}
            className="rounded-md border border-slate-300 text-slate-600 text-sm font-medium px-3 py-1.5 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() =>
              startTransition(async () => {
                await tpmOverrideChecklistItem(
                  item.id,
                  projectId,
                  checklistType,
                  { owner, plannedDate: plannedDate || null, actualDate: actualDate || null, link, status: status as ItemStatus, notes },
                  reason
                );
                setOpen(false);
              })
            }
            disabled={pending || !reason.trim()}
            className="rounded-md bg-amber-600 text-white text-sm font-medium px-3 py-1.5 hover:bg-amber-700 disabled:opacity-50"
          >
            {pending ? "Saving..." : "Save Override"}
          </button>
        </div>
      </div>
    </div>
  );
}
