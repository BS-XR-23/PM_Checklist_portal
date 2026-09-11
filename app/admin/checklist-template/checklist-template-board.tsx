"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { StatTile } from "@/components/ui/stat-tile";
import {
  IconFileText,
  IconLayers,
  IconClipboardList,
  IconCheckCircle,
  IconGauge,
  IconFolder,
  IconSearch,
  IconExpand,
  IconChevronDown,
} from "@/components/layout/icons";
import type { ChecklistType } from "@/lib/checklist-types";
import { TemplateItemRow, type TemplateItemRowData } from "./template-item-row";
import { AddTemplateItemButton } from "./add-template-item-button";

export type TemplateItemWithStage = TemplateItemRowData & { stage: string };
export type BoardType = { key: ChecklistType; label: string; stages: readonly string[] };

function sectionKey(type: ChecklistType, stage: string): string {
  return `${type}::${stage}`;
}

// Each checklist type gets its own color identity in the tab row — plain
// literal class strings (not template-built) so Tailwind's scanner picks
// them all up. Kept local to this page rather than added to lib/colors.ts:
// this is a tab-row accent, not a status/semantic color used elsewhere.
const TYPE_COLORS: Record<ChecklistType, { icon: string; activeText: string; activeBorder: string }> = {
  PM: { icon: "text-indigo-500", activeText: "text-indigo-600", activeBorder: "border-indigo-600" },
  ENGINEERING: { icon: "text-blue-500", activeText: "text-blue-600", activeBorder: "border-blue-600" },
  QA: { icon: "text-emerald-500", activeText: "text-emerald-600", activeBorder: "border-emerald-600" },
  DEVOPS: { icon: "text-violet-500", activeText: "text-violet-600", activeBorder: "border-violet-600" },
  CREATIVE_XR: { icon: "text-rose-500", activeText: "text-rose-600", activeBorder: "border-rose-600" },
  DEV: { icon: "text-amber-500", activeText: "text-amber-600", activeBorder: "border-amber-600" },
};

// Rotates per section (by position, not tied to any meaning) purely so a
// long section list isn't a wall of identical indigo badges — the "eye
// refreshing" ask. Milestone-set pills stay green everywhere (see below):
// that color is semantic ("done"/"covered"), not decorative, so it doesn't
// join the rotation. Left-border uses an inline hex (see StatTile's own
// accentColor for why: a `border-l-{color}` utility can lose to the
// element's own `border-slate-200` shorthand depending on Tailwind's
// generated CSS order — inline style always wins).
const SECTION_PALETTE = [
  { hex: "#3b82f6", badgeBg: "bg-blue-100", badgeText: "text-blue-700", pillBg: "bg-blue-50", pillText: "text-blue-700" },
  { hex: "#8b5cf6", badgeBg: "bg-violet-100", badgeText: "text-violet-700", pillBg: "bg-violet-50", pillText: "text-violet-700" },
  { hex: "#f43f5e", badgeBg: "bg-rose-100", badgeText: "text-rose-700", pillBg: "bg-rose-50", pillText: "text-rose-700" },
  { hex: "#f59e0b", badgeBg: "bg-amber-100", badgeText: "text-amber-700", pillBg: "bg-amber-50", pillText: "text-amber-700" },
  { hex: "#10b981", badgeBg: "bg-emerald-100", badgeText: "text-emerald-700", pillBg: "bg-emerald-50", pillText: "text-emerald-700" },
  { hex: "#06b6d4", badgeBg: "bg-cyan-100", badgeText: "text-cyan-700", pillBg: "bg-cyan-50", pillText: "text-cyan-700" },
  { hex: "#6366f1", badgeBg: "bg-indigo-100", badgeText: "text-indigo-700", pillBg: "bg-indigo-50", pillText: "text-indigo-700" },
  { hex: "#14b8a6", badgeBg: "bg-teal-100", badgeText: "text-teal-700", pillBg: "bg-teal-50", pillText: "text-teal-700" },
] as const;

export function ChecklistTemplateBoard({
  types,
  itemsByType,
}: {
  types: BoardType[];
  itemsByType: Record<ChecklistType, TemplateItemWithStage[]>;
}) {
  const [activeKey, setActiveKey] = useState<ChecklistType>(types[0].key);
  const [search, setSearch] = useState("");
  // Every section starts collapsed except each type's first — matches how a
  // long template reads best (skim the section list, drill into one).
  // Keyed by type+stage so switching tabs doesn't lose what you expanded
  // elsewhere.
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(types.filter((t) => t.stages.length > 0).map((t) => sectionKey(t.key, t.stages[0])))
  );

  const activeType = types.find((t) => t.key === activeKey) ?? types[0];
  const activeItems = useMemo(() => itemsByType[activeType.key] ?? [], [itemsByType, activeType.key]);

  const itemsByStage = useMemo(() => {
    const map = new Map<string, TemplateItemWithStage[]>();
    for (const item of activeItems) {
      const list = map.get(item.stage) ?? [];
      list.push(item);
      map.set(item.stage, list);
    }
    return map;
  }, [activeItems]);

  const q = search.trim().toLowerCase();
  // Searching filters which sections show at all (not just which items
  // inside them) — a section matches if its own name matches, or any item
  // in it does. Matches are always shown expanded regardless of the manual
  // open/closed state, which is restored once the search is cleared.
  const visibleStages = q
    ? activeType.stages.filter((stage) => {
        if (stage.toLowerCase().includes(q)) return true;
        return (itemsByStage.get(stage) ?? []).some(
          (item) => item.itemText.toLowerCase().includes(q) || (item.milestoneName ?? "").toLowerCase().includes(q)
        );
      })
    : activeType.stages;

  const allActiveOpen = activeType.stages.every((stage) => openSections.has(sectionKey(activeType.key, stage)));

  function toggleSection(stage: string) {
    const key = sectionKey(activeType.key, stage);
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleExpandAll() {
    setOpenSections((prev) => {
      const next = new Set(prev);
      for (const stage of activeType.stages) {
        const key = sectionKey(activeType.key, stage);
        if (allActiveOpen) next.delete(key);
        else next.add(key);
      }
      return next;
    });
  }

  const sectionsCount = activeType.stages.length;
  const itemsCount = activeItems.length;
  const milestonesSet = activeItems.filter((item) => item.milestoneName).length;
  // Averaged per section (not weighted by item count) — a template with one
  // huge, mostly-non-milestone section and several small, fully-covered
  // ones should read as "well covered" rather than being dragged down by
  // that one section's raw item count.
  const avgCoveragePct = useMemo(() => {
    if (activeType.stages.length === 0) return 0;
    const fractions = activeType.stages.map((stage) => {
      const items = itemsByStage.get(stage) ?? [];
      if (items.length === 0) return 0;
      return items.filter((item) => item.milestoneName).length / items.length;
    });
    return (fractions.reduce((sum, f) => sum + f, 0) / fractions.length) * 100;
  }, [activeType.stages, itemsByStage]);

  return (
    <div className="space-y-4">
      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {types.map((t) => {
          const active = t.key === activeType.key;
          const colors = TYPE_COLORS[t.key];
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveKey(t.key)}
              className={clsx(
                "inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors",
                active ? clsx(colors.activeBorder, colors.activeText) : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              )}
            >
              <IconFileText className={clsx("h-4 w-4 shrink-0", active ? colors.activeText : colors.icon)} />
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* grid-cols-1 below sm rather than the 2-up pattern used elsewhere
          (e.g. Delivery Tasks' 4 tiles) — 5 tiles in 2 columns leaves an
          awkward 3/2 split, and the sidebar's fixed 240px width (it doesn't
          collapse on narrow screens anywhere in the app) already eats most
          of a phone's viewport, so even 2 columns here get too cramped to
          read; full-width single-column tiles stay legible. */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
        <StatTile
          icon={<IconLayers />}
          iconWrapClass="bg-blue-100 text-blue-700"
          bgClass="bg-blue-50/60"
          accentColor="#3b82f6"
          label="Sections"
          value={String(sectionsCount)}
        />
        <StatTile
          icon={<IconClipboardList />}
          iconWrapClass="bg-indigo-100 text-indigo-700"
          bgClass="bg-indigo-50/60"
          accentColor="#6366f1"
          label="Checklist Items"
          value={String(itemsCount)}
        />
        <StatTile
          icon={<IconCheckCircle />}
          iconWrapClass="bg-emerald-100 text-emerald-700"
          bgClass="bg-emerald-50/60"
          accentColor="#10b981"
          label="Milestones Set"
          value={String(milestonesSet)}
        />
        <StatTile
          icon={<IconGauge />}
          iconWrapClass="bg-amber-100 text-amber-700"
          bgClass="bg-amber-50/60"
          accentColor="#f59e0b"
          label="Avg Coverage"
          nowrap
          value={`${avgCoveragePct.toFixed(0)}%`}
        />
        <StatTile
          icon={<IconFolder />}
          iconWrapClass="bg-violet-100 text-violet-700"
          bgClass="bg-violet-50/60"
          accentColor="#8b5cf6"
          label="Templates"
          value={String(types.length)}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">{activeType.label}</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleExpandAll}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900"
            >
              <IconExpand className="h-3.5 w-3.5" />
              {allActiveOpen ? "Collapse All" : "Expand All"}
            </button>
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search sections or items…"
                className="w-56 rounded-md border border-slate-200 pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>
          </div>
        </div>

        {visibleStages.length === 0 && (
          <p className="text-sm text-slate-400 py-4 text-center">No sections or items match &quot;{search}&quot;.</p>
        )}

        {visibleStages.map((stage) => {
          const items = itemsByStage.get(stage) ?? [];
          const milestonesInSection = items.filter((item) => item.milestoneName).length;
          const isOpen = q ? true : openSections.has(sectionKey(activeType.key, stage));
          // Section number reflects this type's fixed stage order, not its
          // position in the (possibly search-filtered) visible list.
          const sectionNumber = activeType.stages.indexOf(stage) + 1;
          const palette = SECTION_PALETTE[(sectionNumber - 1) % SECTION_PALETTE.length];

          return (
            <div
              key={stage}
              className="rounded-lg border border-slate-200 overflow-hidden"
              style={{ borderLeftColor: palette.hex, borderLeftWidth: 4 }}
            >
              <button
                type="button"
                onClick={() => toggleSection(stage)}
                className="w-full flex flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
              >
                <span
                  className={clsx(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    palette.badgeBg,
                    palette.badgeText
                  )}
                >
                  {sectionNumber}
                </span>
                <span className="font-semibold text-slate-900">{stage}</span>
                <span className={clsx("rounded-full px-2 py-0.5 text-xs font-medium", palette.pillBg, palette.pillText)}>
                  {items.length} item{items.length === 1 ? "" : "s"}
                </span>
                <span className="ml-auto flex items-center gap-3">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
                    {milestonesInSection} milestone{milestonesInSection === 1 ? "" : "s"} set
                  </span>
                  <IconChevronDown className={clsx("h-4 w-4 shrink-0 text-slate-400 transition-transform", isOpen && "rotate-180")} />
                </span>
              </button>
              {isOpen && (
                <div className="overflow-x-auto border-t border-slate-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200 bg-slate-50">
                        <th className="px-4 py-2.5 w-12">#</th>
                        <th className="px-4 py-2.5">Item Text</th>
                        <th className="px-4 py-2.5 w-48">Milestone</th>
                        <th className="px-4 py-2.5 w-28">Type</th>
                        <th className="px-4 py-2.5 w-28">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, itemIdx) => (
                        <TemplateItemRow
                          key={item.id}
                          item={item}
                          index={`${sectionNumber}.${itemIdx + 1}`}
                          isFirst={itemIdx === 0}
                          isLast={itemIdx === items.length - 1}
                        />
                      ))}
                      <tr>
                        <td colSpan={5} className="px-4 py-2.5">
                          <AddTemplateItemButton type={activeType.key} stage={stage} />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
