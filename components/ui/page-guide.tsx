"use client";

import { useEffect, useState } from "react";
import { IconInfo, IconChevronDown } from "@/components/layout/icons";

/**
 * Collapsible "why this page / how to fill it in" panel. Auto-expands only
 * on a viewer's first-ever visit to this `id` (tracked in localStorage), then
 * defaults to whatever they last left it as — so a first-time user sees it,
 * a daily user isn't stuck re-collapsing it every visit.
 */
export function PageGuide({ id, title, points }: { id: string; title: string; points: React.ReactNode[] }) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const prefKey = `pageGuide:${id}:expanded`;
    const visitedKey = `pageGuide:${id}:visited`;
    try {
      const pref = localStorage.getItem(prefKey);
      if (pref === "1") {
        setExpanded(true);
        return;
      }
      if (pref === "0") {
        setExpanded(false);
        return;
      }
      if (!localStorage.getItem(visitedKey)) {
        localStorage.setItem(visitedKey, "1");
        setExpanded(true);
      }
    } catch {
      // localStorage unavailable (private mode, etc.) — stays collapsed.
    }
  }, [id]);

  function toggle() {
    setExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(`pageGuide:${id}:expanded`, next ? "1" : "0");
      } catch {
        // ignore — the toggle still works for this session
      }
      return next;
    });
  }

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/50">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-blue-900">
          <IconInfo className="h-4 w-4 shrink-0" />
          {title}
        </span>
        <IconChevronDown className={`h-4 w-4 shrink-0 text-blue-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <ul className="px-4 pb-3.5 pt-0.5 space-y-1.5 text-sm text-blue-900/80 list-disc list-inside">
          {points.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
