"use client";

import { useState } from "react";
import { IconClipboardList } from "@/components/layout/icons";

type Scenario = { situation: string; action: React.ReactNode };

// Grounded in the actual delivery-actions.ts behavior (closeSprintWithMoves,
// assignTaskToSprint, reopenSprint) — not generic PM advice. Ordered from
// the everyday case to the rarer ones.
const SCENARIOS: Scenario[] = [
  {
    situation: "A sprint ends and every task hit 100%.",
    action: "Just click Close Sprint. There's nothing to decide — it freezes immediately, the same one-click flow as before triage existed.",
  },
  {
    situation: "A sprint ends with tasks still in progress, and another sprint is already open.",
    action:
      "Click Close Sprint — the triage panel opens automatically. Pick “Move to [sprint]” for each task you want to continue elsewhere, or leave it as spillover if the sprint should just close with it unfinished. Confirm & Close does both the moves and the freeze in one step.",
  },
  {
    situation: "A sprint ends with incomplete tasks, but no other sprint is open yet.",
    action:
      "The triage panel will only offer “Leave as spillover.” Create the next sprint first (top of this page), then close — or close with spillover now and move the task once the new sprint exists.",
  },
  {
    situation: "A task needs to skip ahead — e.g. from Sprint 1 straight to Sprint 4, not Sprint 2.",
    action:
      "That's fine. A task only needs its current sprint to be open and the destination sprint to be open — nothing requires it to move to “the next” one. Sprint 2 and 3 are never touched.",
  },
  {
    situation: "A sprint was closed by mistake, or something on it needs to change after closing.",
    action:
      "Only an Admin can reopen it (Reopen Sprint, in the closed-sprint panel). Once reopened, its PV/EV/AV go back to being computed live until it's closed again — treat this as a correction, not a routine step.",
  },
  {
    situation: "A task needs to be deleted, but it's stuck in a sprint.",
    action:
      "Remove it from the sprint first (Tasks table row menu, or from inside this sprint's detail view), then delete it from the Tasks tab. If that sprint is closed, an Admin has to reopen it before it can be removed.",
  },
  {
    situation: "A task needs to move out of a sprint early — not because the sprint is closing, just a reassignment.",
    action:
      "Use “Remove from sprint” on the task row, or commit it straight to a different sprint. Same underlying move as close-triage uses, just usable any time a sprint is open, not only when it's closing.",
  },
  {
    situation: "A sprint's numbers look different after it was reopened and closed again.",
    action:
      "Expected. Reopening un-freezes it, and any task that left in the meantime keeps a frozen “departed” snapshot of its state at the moment it left — not whatever it does afterward in its new sprint. Re-closing recomputes from what's still there plus those snapshots, so the final numbers are accurate, just not necessarily identical to the first close.",
  },
];

export function SprintPlaybookModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-slate-300 text-slate-700 text-sm font-medium px-4 py-2 hover:bg-slate-50 inline-flex items-center gap-1.5"
      >
        <IconClipboardList className="h-4 w-4" />
        Sprint Playbook
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setOpen(false)}>
          <div
            className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Sprint Playbook</h3>
                <p className="text-sm text-slate-500 mt-1">Common situations on this page, and what to actually do about them.</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-xl leading-none shrink-0"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {SCENARIOS.map((s, i) => (
                <div key={i} className="rounded-xl border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-900">{s.situation}</p>
                  <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{s.action}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
