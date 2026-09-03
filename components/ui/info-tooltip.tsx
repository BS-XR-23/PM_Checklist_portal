"use client";

import { useState } from "react";
import { IconInfo } from "@/components/layout/icons";

/** Small hover-triggered note for a page/section heading — reusable so every
 * "what does this mean" aside on the app lands the same way instead of each
 * page inventing its own placement. */
export function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" className="text-slate-400 hover:text-slate-600" aria-label="More info">
        <IconInfo className="h-4 w-4" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-full z-20 mt-2 w-64 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs leading-relaxed text-white shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
