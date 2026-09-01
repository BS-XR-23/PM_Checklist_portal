"use client";

import { useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useAnchoredPosition } from "./use-anchored-position";

const POPUP_WIDTH = 320;

/**
 * "Add note" / "View note" toggle that opens a floating multi-line textarea
 * — used by any table cell (Checklist, Milestones, ...) that carries a
 * free-text notes field. Floating (via the same portal positioning as
 * RowActionsMenu's dropdown) rather than expanding inline: a note box
 * squeezed into a ~180px table cell was unreadable both while typing and
 * while reopening it later, since it rendered as a single line clipped by
 * the table's own overflow. This one is never clipped or squeezed by
 * neighboring columns, and is comfortably sized to actually read/write in.
 */
export function NotesCell({
  value,
  canWrite,
  onSave,
  addLabel = "Add note",
  viewLabel = "View note",
  icon,
}: {
  value: string | null;
  canWrite: boolean;
  onSave: (value: string) => Promise<void>;
  addLabel?: string;
  viewLabel?: string;
  /** Optional leading icon on the trigger button — omitted by default so existing callers (Milestones) render unchanged. */
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [pending, startTransition] = useTransition();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const coords = useAnchoredPosition(open, buttonRef, () => setOpen(false), { width: POPUP_WIDTH, estHeight: 220 });

  if (!canWrite) {
    return value ? <span className="text-sm text-slate-600 whitespace-pre-wrap">{value}</span> : <span className="text-slate-300">—</span>;
  }

  const commit = () => {
    if (draft !== (value ?? "")) startTransition(() => onSave(draft));
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setDraft(value ?? "");
          setOpen((v) => !v);
        }}
        className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline whitespace-nowrap"
      >
        {icon}
        {value ? viewLabel : addLabel}
      </button>
      {open &&
        coords &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => {
                commit();
                setOpen(false);
              }}
            />
            <div
              className="fixed z-50 rounded-md border border-slate-200 bg-white p-2 shadow-lg"
              style={{
                width: POPUP_WIDTH,
                left: coords.left,
                ...(coords.openUp ? { bottom: window.innerHeight - coords.top + 4 } : { top: coords.top + 4 }),
              }}
            >
              <textarea
                autoFocus
                rows={5}
                className="w-full resize-y rounded border border-slate-200 p-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
                placeholder="—"
                disabled={pending}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setDraft(value ?? "");
                    setOpen(false);
                  }
                }}
              />
              <div className="mt-1.5 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    commit();
                    setOpen(false);
                  }}
                  className="text-xs font-medium text-slate-500 hover:text-slate-800"
                >
                  Done
                </button>
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
}
