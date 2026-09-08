"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { formatDate } from "@/lib/format";
import { RISK_SEVERITY_COLORS, REMINDER_SOURCE_STYLE, DEPENDENCY_PRIORITY_COLORS, tagPillStyle } from "@/lib/colors";
import { IconSearch, IconChevronDown, IconFolder, IconTarget, IconClipboardList, IconCheckCircle, IconCalendar } from "@/components/layout/icons";
import type { ReminderItem } from "@/lib/notifications";

const SOURCE_ICON: Record<ReminderItem["source"], (props: React.SVGProps<SVGSVGElement>) => React.JSX.Element> = {
  CHECKLIST: IconClipboardList,
  ACTION_ITEM: IconCheckCircle,
  PRESALES_OPPORTUNITY: IconTarget,
  PRESALES_ACTION_ITEM: IconTarget,
};

type Group = {
  id: string;
  label: string;
  viewHref: string | null;
  viewLabel: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => React.JSX.Element;
  items: ReminderItem[];
};

function byOverdueThenSize(a: Group, b: Group) {
  const overdueA = a.items.filter((i) => i.band === "OVERDUE").length;
  const overdueB = b.items.filter((i) => i.band === "OVERDUE").length;
  if (overdueA !== overdueB) return overdueB - overdueA;
  return b.items.length - a.items.length;
}

function groupByProject(items: ReminderItem[]): Group[] {
  const map = new Map<string, Group>();
  for (const r of items) {
    let g = map.get(r.groupId);
    if (!g) {
      g = {
        id: r.groupId,
        label: r.contextLabel,
        viewHref: r.projectId ? `/projects/${r.projectId}/dashboard` : `/presales/${r.groupId}`,
        viewLabel: r.projectId ? "View Project" : "View Opportunity",
        icon: r.projectId ? IconFolder : IconTarget,
        items: [],
      };
      map.set(r.groupId, g);
    }
    g.items.push(r);
  }
  return Array.from(map.values()).sort(byOverdueThenSize);
}

function groupByType(items: ReminderItem[]): Group[] {
  const map = new Map<string, Group>();
  for (const r of items) {
    let g = map.get(r.source);
    if (!g) {
      g = { id: r.source, label: REMINDER_SOURCE_STYLE[r.source].label, viewHref: null, viewLabel: "", icon: SOURCE_ICON[r.source], items: [] };
      map.set(r.source, g);
    }
    g.items.push(r);
  }
  return Array.from(map.values()).sort(byOverdueThenSize);
}

export function ReminderFilters({ items }: { items: ReminderItem[] }) {
  const [bandFilter, setBandFilter] = useState<"ALL" | "OVERDUE" | "DUE_SOON">("ALL");
  const [groupBy, setGroupBy] = useState<"PROJECT" | "TYPE">("PROJECT");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string> | null>(null);

  const overdueCount = items.filter((r) => r.band === "OVERDUE").length;
  const dueSoonCount = items.filter((r) => r.band === "DUE_SOON").length;

  const q = search.trim().toLowerCase();
  const filtered = items
    .filter((r) => bandFilter === "ALL" || r.band === bandFilter)
    .filter((r) => !q || r.itemText.toLowerCase().includes(q) || r.contextLabel.toLowerCase().includes(q));

  const groups = groupBy === "PROJECT" ? groupByProject(filtered) : groupByType(filtered);
  const expandedIds = expanded ?? new Set(groups[0] ? [groups[0].id] : []);

  function toggle(id: string) {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FilterPill label="All" active={bandFilter === "ALL"} onClick={() => { setBandFilter("ALL"); setExpanded(null); }} />
        <FilterPill
          label="Overdue"
          count={overdueCount}
          badge={RISK_SEVERITY_COLORS.high}
          active={bandFilter === "OVERDUE"}
          onClick={() => { setBandFilter("OVERDUE"); setExpanded(null); }}
        />
        <FilterPill
          label="Due Soon"
          count={dueSoonCount}
          badge={RISK_SEVERITY_COLORS.medium}
          active={bandFilter === "DUE_SOON"}
          onClick={() => { setBandFilter("DUE_SOON"); setExpanded(null); }}
        />

        <select
          value={groupBy}
          onChange={(e) => { setGroupBy(e.target.value as "PROJECT" | "TYPE"); setExpanded(null); }}
          aria-label="Group by"
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
        >
          <option value="PROJECT">By Project</option>
          <option value="TYPE">By Type</option>
        </select>

        <div className="relative ml-auto">
          <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by project or reminder…"
            className="w-64 rounded-md border border-slate-200 pl-8 pr-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </div>
      </div>

      <h2 className="text-sm font-semibold text-slate-700">{groupBy === "PROJECT" ? "Grouped by Project" : "Grouped by Type"}</h2>

      {groups.length === 0 ? (
        <p className="text-sm text-slate-400 rounded-xl border border-slate-200 bg-white p-4">
          {items.length === 0 ? "Nothing overdue or due soon — you're caught up." : "No reminders match the current filters."}
        </p>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <GroupCard key={g.id} group={g} expanded={expandedIds.has(g.id)} onToggle={() => toggle(g.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function GroupCard({ group, expanded, onToggle }: { group: Group; expanded: boolean; onToggle: () => void }) {
  const overdue = group.items.filter((i) => i.band === "OVERDUE").length;
  const dueSoon = group.items.filter((i) => i.band === "DUE_SOON").length;
  const iconStyle = tagPillStyle(group.id);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <button type="button" onClick={onToggle} className="shrink-0 text-slate-400 hover:text-slate-600" aria-label={expanded ? "Collapse" : "Expand"}>
          <IconChevronDown className={clsx("h-4 w-4 transition-transform", !expanded && "-rotate-90")} />
        </button>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: iconStyle.bg, color: iconStyle.text }}
        >
          <group.icon className="h-4 w-4" />
        </span>
        <button type="button" onClick={onToggle} className="flex-1 min-w-0 flex items-center gap-2 flex-wrap text-left">
          <span className="text-sm font-semibold text-slate-800 truncate">{group.label}</span>
          <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap">
            {group.items.length} reminder{group.items.length === 1 ? "" : "s"}
          </span>
          {overdue > 0 ? (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
              style={{ backgroundColor: RISK_SEVERITY_COLORS.high.bg, color: RISK_SEVERITY_COLORS.high.text }}
            >
              {overdue} overdue
            </span>
          ) : dueSoon > 0 ? (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
              style={{ backgroundColor: RISK_SEVERITY_COLORS.medium.bg, color: RISK_SEVERITY_COLORS.medium.text }}
            >
              {dueSoon} due soon
            </span>
          ) : null}
        </button>
        {group.viewHref && (
          <Link
            href={group.viewHref}
            prefetch={false}
            className="shrink-0 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {group.viewLabel}
          </Link>
        )}
      </div>

      {expanded && (
        <div className="border-t border-slate-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                <th className="px-4 py-2 font-medium whitespace-nowrap">Type</th>
                <th className="px-4 py-2 font-medium">Item / Action</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">Due Date</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">Priority</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {group.items.map((r, i) => (
                <ReminderRow key={i} item={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ReminderRow({ item }: { item: ReminderItem }) {
  const sourceStyle = REMINDER_SOURCE_STYLE[item.source];
  const SourceIcon = SOURCE_ICON[item.source];
  const bandColor = item.band === "OVERDUE" ? RISK_SEVERITY_COLORS.high : RISK_SEVERITY_COLORS.medium;
  const priorityColor = DEPENDENCY_PRIORITY_COLORS[item.priority];

  return (
    <tr className="hover:bg-slate-50/70">
      <td className="px-4 py-2.5 whitespace-nowrap">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
          style={{ backgroundColor: sourceStyle.bg, color: sourceStyle.text }}
        >
          <SourceIcon className="h-3 w-3" />
          {sourceStyle.label}
        </span>
      </td>
      <td className="px-4 py-2.5 max-w-xs">
        <Link href={item.href} prefetch={false} className="text-slate-700 hover:text-blue-600 hover:underline truncate block" title={item.itemText}>
          {item.itemText}
        </Link>
      </td>
      <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
        <IconCalendar className="h-3.5 w-3.5 inline-block mr-1 text-slate-300 align-[-2px]" />
        {formatDate(item.plannedDate)}
      </td>
      <td className="px-4 py-2.5 whitespace-nowrap">
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
          style={{ backgroundColor: priorityColor.bg, color: priorityColor.text }}
        >
          {item.priority}
        </span>
      </td>
      <td className="px-4 py-2.5 whitespace-nowrap">
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
          style={{ backgroundColor: bandColor.bg, color: bandColor.text }}
        >
          {item.band === "OVERDUE" ? "Overdue" : "Due Soon"}
        </span>
      </td>
    </tr>
  );
}

function FilterPill({
  label,
  active,
  onClick,
  count,
  badge,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
  badge?: { bg: string; text: string };
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap",
        active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
      )}
    >
      {label}
      {count != null && count > 0 && badge && (
        <span
          className="inline-flex items-center justify-center rounded-full px-1.5 min-w-[1.1rem] text-[10px] font-semibold"
          style={{ backgroundColor: badge.bg, color: badge.text }}
        >
          {count}
        </span>
      )}
    </button>
  );
}
