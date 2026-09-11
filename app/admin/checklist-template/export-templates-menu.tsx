"use client";

import { useEffect, useState } from "react";
import { CHECKLIST_TYPES } from "@/lib/checklist-types";
import { IconChevronDown, IconDownload } from "@/components/layout/icons";

/**
 * Not portal-positioned like RowActionsMenu/DuplicateBadge — this button
 * lives in the page header, which has no scrollable/overflow-hidden
 * ancestor to clip it, so plain `absolute` positioning is safe here.
 */
export function ExportTemplatesMenu() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("click", close);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", close);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
      >
        Export Templates
        <IconChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-md border border-slate-200 bg-white p-1 text-sm shadow-lg">
          {CHECKLIST_TYPES.map((c) => (
            <a
              key={c.key}
              href={`/api/admin/checklist-template/export?type=${c.key}`}
              className="flex items-center gap-2 rounded px-2.5 py-1.5 text-slate-700 hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              <IconDownload className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              {c.label}
            </a>
          ))}
          <a
            href="/api/admin/checklist-template/export?type=PRESALES"
            className="flex items-center gap-2 rounded px-2.5 py-1.5 text-slate-700 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            <IconDownload className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            Presales Checklist
          </a>
        </div>
      )}
    </div>
  );
}
