"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";

export type RowAction = {
  label: string;
  pendingLabel?: string;
  onClick: () => Promise<void>;
  danger?: boolean;
  /** When set, a native confirm() must be accepted before onClick runs — for
   * actions (delete) that used to fire on the first click with no chance to
   * back out of a mis-click. */
  confirmMessage?: string;
};

const MENU_WIDTH = 192; // matches w-48
const ITEM_HEIGHT = 32;
const GAP = 4;

/**
 * Generic "•••" row-actions dropdown for table rows (Checklist, Milestones,
 * ...). Rendered into a portal at document.body and positioned with fixed
 * coordinates (not `absolute` inside the row) so it can't get clipped by a
 * scrollable/overflow-hidden table container — which used to hide the whole
 * menu, Delete action included, for rows near the bottom of a table.
 */
export function RowActionsMenu({ actions }: { actions: RowAction[] }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; openUp: boolean } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const openMenu = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuHeight = actions.length * ITEM_HEIGHT + 8;
    const openUp = rect.bottom + GAP + menuHeight > window.innerHeight;
    setCoords({
      top: openUp ? rect.top : rect.bottom,
      left: Math.max(8, rect.right - MENU_WIDTH),
      openUp,
    });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          // preventDefault too, not just stopPropagation — this button is a
          // real DOM descendant of a caller's own ancestor <a> when it puts
          // this trigger inside a clickable card (e.g. a project card
          // that's a <Link>). stopPropagation alone only stops the event
          // from reaching that ancestor's React onClick handler (where
          // next/link's own preventDefault lives) — it does nothing about
          // the browser's native "navigate" default action on the <a>,
          // which still fires unless *something* calls preventDefault on
          // this same event before it finishes propagating.
          e.preventDefault();
          e.stopPropagation();
          if (open) setOpen(false);
          else openMenu();
        }}
        aria-label="Actions"
        className="rounded p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
      >
        •••
      </button>
      {open &&
        coords &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
            {/* stopPropagation here: this panel is rendered into a portal at
                document.body, but React's synthetic events still bubble
                along the *component* tree, not the DOM tree — so without
                this, a click on a menu item would also bubble through
                whatever ancestor this component is declared inside (e.g. a
                card's <Link>) and trigger that too. */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="fixed z-50 w-48 rounded-md border border-slate-200 bg-white p-1 text-sm shadow-lg"
              style={{
                left: coords.left,
                ...(coords.openUp ? { bottom: window.innerHeight - coords.top + GAP } : { top: coords.top + GAP }),
              }}
            >
              {actions.map((action) => (
                <RowActionItem key={action.label} action={action} onDone={() => setOpen(false)} />
              ))}
            </div>
          </>,
          document.body
        )}
    </>
  );
}

function RowActionItem({ action, onDone }: { action: RowAction; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (action.confirmMessage && !window.confirm(action.confirmMessage)) return;
        startTransition(async () => {
          try {
            await action.onClick();
          } catch (err) {
            window.alert(err instanceof Error ? err.message : "Something went wrong.");
          }
          onDone();
        });
      }}
      className={clsx(
        "w-full text-left rounded px-2.5 py-1.5 disabled:opacity-50",
        action.danger ? "text-red-600 hover:bg-red-50" : "text-slate-700 hover:bg-slate-50"
      )}
    >
      {pending ? action.pendingLabel ?? "Working..." : action.label}
    </button>
  );
}
