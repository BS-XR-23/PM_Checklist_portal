"use client";

import { useState } from "react";
import clsx from "clsx";
import { STATUS_COLORS } from "@/lib/colors";
import { IconPencil, IconChevronDown } from "@/components/layout/icons";

export type PmPlanSectionStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export type PmPlanSectionData = {
  id: string;
  number: number;
  title: string;
  hint?: string;
  required?: boolean;
  status: PmPlanSectionStatus;
  itemCountLabel?: string;
  view: React.ReactNode;
  edit?: React.ReactNode; // omitted entirely for a read-only viewer
};

function StatusPill({ status }: { status: PmPlanSectionStatus }) {
  const s = STATUS_COLORS[status];
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap" style={{ backgroundColor: s.bg, color: s.text }}>
      {s.label}
    </span>
  );
}

export function PmPlanSections({ sections, canWrite }: { sections: PmPlanSectionData[]; canWrite: boolean }) {
  const [expandedId, setExpandedId] = useState<string | null>(sections[0]?.id ?? null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const toggle = (id: string) => {
    setExpandedId((cur) => (cur === id ? null : id));
    setEditingId(null);
  };

  return (
    <div className="grid lg:grid-cols-[220px_1fr] gap-4">
      <nav className="rounded-xl border border-slate-200 bg-white p-2 h-fit lg:sticky lg:top-4">
        <p className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Sections</p>
        <ul className="space-y-0.5">
          {sections.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  setExpandedId(s.id);
                  setEditingId(null);
                }}
                className={clsx(
                  "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                  expandedId === s.id ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <span
                  className={clsx(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                    expandedId === s.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
                  )}
                >
                  {s.number}
                </span>
                <span className="truncate">{s.title}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-2">
        {sections.map((s) => {
          const expanded = expandedId === s.id;
          const editing = editingId === s.id;
          return (
            <section key={s.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => toggle(s.id)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50/60"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
                    {s.number}
                  </span>
                  <span className="text-sm font-semibold text-slate-900 truncate">{s.title}</span>
                  {s.required && expanded && (
                    <span className="inline-flex items-center rounded-full bg-rose-50 text-rose-600 text-[11px] font-medium px-2 py-0.5 shrink-0">
                      Required
                    </span>
                  )}
                  {!expanded && s.itemCountLabel && <span className="text-xs text-slate-400 shrink-0">{s.itemCountLabel}</span>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusPill status={s.status} />
                  <IconChevronDown className={clsx("h-4 w-4 text-slate-400 transition-transform", expanded && "-rotate-180")} />
                </div>
              </button>

              {expanded && (
                <div className="border-t border-slate-100 px-4 py-4">
                  {s.hint && <p className="text-xs text-slate-500 mb-3">{s.hint}</p>}

                  {canWrite && s.edit && (
                    <div className="flex justify-end mb-3">
                      <button
                        type="button"
                        onClick={() => setEditingId(editing ? null : s.id)}
                        className={clsx(
                          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
                          editing ? "bg-slate-900 text-white hover:bg-slate-800" : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                        )}
                      >
                        {!editing && <IconPencil className="h-3 w-3" />}
                        {editing ? "Done" : "Edit Section"}
                      </button>
                    </div>
                  )}

                  {editing && s.edit ? s.edit : s.view}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
