"use client";

import { useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { InlineDate, InlineSelect } from "@/components/ui/inline-edit";
import { useAnchoredPosition } from "@/components/ui/use-anchored-position";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatTile } from "@/components/ui/stat-tile";
import { ProgressRing } from "@/components/ui/progress-ring";
import { NotesCell } from "@/components/ui/notes-cell";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import {
  IconCheckCircle,
  IconTarget,
  IconCircle,
  IconClock,
  IconLayers,
  IconCalendar,
  IconExternalLink,
  IconFileText,
} from "@/components/layout/icons";
import { STATUS_COLORS, STATUS_ORDER, SLIPPED_FLAG_COLOR, avatarColorFromString } from "@/lib/colors";
import { ITEM_STATUSES, type ItemStatus } from "@/lib/constants";
import type { ChecklistType } from "@/lib/checklist-types";
import { formatPct, formatDate, toDateInputValue, initials } from "@/lib/format";
import { isSlipped, currentStage } from "@/lib/calculations";
import { updateChecklistItem, createChecklistItem, deleteChecklistItem } from "@/app/projects/[projectId]/checklist-actions";
import { TpmOverrideChecklistModal } from "@/components/rbac/tpm-override-checklist-modal";
import { PersonPicker } from "@/components/resourcing/person-picker";
import type { AccessLevel, Role } from "@prisma/client";

export type ChecklistTableItem = {
  id: string;
  order: number;
  stage: string;
  itemText: string;
  milestoneName: string | null;
  owner: string | null;
  ownerPersonId: string | null;
  ownerPersonName: string | null;
  plannedDate: Date | null;
  actualDate: Date | null;
  link: string | null;
  status: string;
  notes: string | null; // null when stripped by READ_LIMITED access
  isCustom: boolean;
};

// Reads as "Overdue" on this page (a not-yet-done item past its planned
// date) even though the underlying status value is still DELAYED — same
// status everywhere else in the app calls "Delayed". Display-only alias, so
// filters/exports elsewhere keep the one true label.
const LEGEND_LABEL: Partial<Record<ItemStatus, string>> = { DELAYED: "Overdue" };

const PAGE_SIZES = [10, 25, 50] as const;

export function ChecklistTable({
  projectId,
  checklistType,
  items,
  stageOrder,
  stageLabel = "Stage",
  access,
  viewerRole,
  people,
}: {
  projectId: string;
  checklistType: ChecklistType;
  items: ChecklistTableItem[];
  stageOrder: readonly string[];
  stageLabel?: string;
  access: AccessLevel;
  viewerRole: Role;
  people: { id: string; name: string }[];
}) {
  const canWrite = access === "WRITE";
  const notesHidden = access === "READ_LIMITED";
  const canOverride = viewerRole === "TPM" && access === "READ_FULL";

  const applicable = items.filter((i) => i.status !== "NOT_APPLICABLE");
  const completedCount = applicable.filter((i) => i.status === "COMPLETED").length;
  const overallPct = applicable.length ? completedCount / applicable.length : 0;
  const inProgressCount = applicable.filter((i) => i.status === "IN_PROGRESS").length;
  const notStartedCount = applicable.filter((i) => i.status === "NOT_STARTED").length;
  const overdueCount = applicable.filter((i) => i.status === "DELAYED").length;

  const groups = stageOrder
    .map((stage) => ({ stage, rows: items.filter((i) => i.stage === stage) }))
    .filter((g) => g.rows.length > 0);

  // Default to the first stage/category that isn't fully complete yet, so
  // opening the checklist lands you on the work still in front of you
  // instead of always Stage 1. "All" (everything stacked) is one click away.
  const firstIncomplete = currentStage(items, stageOrder);
  const [activeStage, setActiveStage] = useState<string>(groups.length > 1 && firstIncomplete ? firstIncomplete : "ALL");

  const visibleGroups = activeStage === "ALL" ? groups : groups.filter((g) => g.stage === activeStage);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 flex items-center gap-3">
          <ProgressRing pct={overallPct} size={52} stroke={6} />
          <div className="min-w-0">
            <p className="text-xs text-slate-500">Overall Progress</p>
            <p className="text-lg font-bold text-slate-900 leading-tight">{formatPct(overallPct)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">
              {completedCount} of {applicable.length} completed
            </p>
          </div>
        </div>
        <StatTile
          icon={<IconCheckCircle />}
          iconWrapClass="bg-emerald-50 text-emerald-600"
          label="On Track"
          value={String(completedCount)}
          subtitle={formatPct(applicable.length ? completedCount / applicable.length : 0)}
        />
        <StatTile
          icon={<IconTarget />}
          iconWrapClass="bg-blue-50 text-blue-600"
          label="In Progress"
          value={String(inProgressCount)}
          subtitle={formatPct(applicable.length ? inProgressCount / applicable.length : 0)}
        />
        <StatTile
          icon={<IconCircle />}
          iconWrapClass="bg-slate-100 text-slate-500"
          label="Not Started"
          value={String(notStartedCount)}
          subtitle={formatPct(applicable.length ? notStartedCount / applicable.length : 0)}
        />
        <StatTile
          icon={<IconClock />}
          iconWrapClass="bg-rose-50 text-rose-600"
          label="Overdue"
          value={String(overdueCount)}
          subtitle={formatPct(applicable.length ? overdueCount / applicable.length : 0)}
        />
        <StatTile icon={<IconLayers />} iconWrapClass="bg-violet-50 text-violet-600" label="Total Stages" value={String(groups.length)} subtitle={`${stageLabel}s`} />
      </div>

      {groups.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <StagePill label={`All (${items.length})`} active={activeStage === "ALL"} onClick={() => setActiveStage("ALL")} />
          {groups.map((g) => {
            // N/A items are excluded from the denominator entirely and count
            // as "done" for the stage's completion flag (nothing left to do).
            const stageApplicable = g.rows.filter((r) => r.status !== "NOT_APPLICABLE");
            const stageCompleted = stageApplicable.filter((r) => r.status === "COMPLETED").length;
            const done = stageApplicable.every((r) => r.status === "COMPLETED");
            return (
              <StagePill
                key={g.stage}
                label={`${g.stage} (${stageCompleted}/${stageApplicable.length})`}
                active={activeStage === g.stage}
                done={done}
                onClick={() => setActiveStage(g.stage)}
              />
            );
          })}
        </div>
      )}

      <div className="space-y-4">
        {visibleGroups.map((group) => (
          <StageGroupCard
            key={group.stage}
            stage={group.stage}
            stageLabel={stageLabel}
            rows={group.rows}
            projectId={projectId}
            checklistType={checklistType}
            canWrite={canWrite}
            notesHidden={notesHidden}
            canOverride={canOverride}
            viewerRole={viewerRole}
            people={people}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
        {STATUS_ORDER.map((s) => (
          <div key={s} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[s].bg }} />
            {LEGEND_LABEL[s] ?? STATUS_COLORS[s].label}
          </div>
        ))}
      </div>
    </div>
  );
}

function StageGroupCard({
  stage,
  stageLabel,
  rows,
  projectId,
  checklistType,
  canWrite,
  notesHidden,
  canOverride,
  viewerRole,
  people,
}: {
  stage: string;
  stageLabel: string;
  rows: ChecklistTableItem[];
  projectId: string;
  checklistType: ChecklistType;
  canWrite: boolean;
  notesHidden: boolean;
  canOverride: boolean;
  viewerRole: Role;
  people: { id: string; name: string }[];
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(10);

  const applicable = rows.filter((r) => r.status !== "NOT_APPLICABLE");
  const completed = applicable.filter((r) => r.status === "COMPLETED").length;
  const pct = applicable.length ? completed / applicable.length : 0;

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const clampedPage = Math.min(page, pageCount);
  const pageRows = rows.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button type="button" onClick={() => setCollapsed((v) => !v)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50/60">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
          <IconCalendar className="h-4 w-4" />
        </span>
        <span className="text-sm font-bold text-slate-900">
          {stageLabel}: {stage}
        </span>
        <span className="hidden sm:flex flex-1 items-center gap-2.5 min-w-[160px] max-w-xs ml-2">
          <span className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <span className="block h-full rounded-full bg-violet-600" style={{ width: `${pct * 100}%` }} />
          </span>
        </span>
        <span className="ml-auto shrink-0 text-xs text-slate-500">
          {completed} of {applicable.length} completed ({formatPct(pct)})
        </span>
        <span className={clsx("text-slate-400 text-xs transition-transform", collapsed ? "-rotate-90" : "")}>▾</span>
      </button>

      {!collapsed && (
        <>
          <div className="overflow-x-auto border-t border-slate-100">
            <table className="w-full text-sm min-w-[1100px]">
              <thead>
                <tr className="text-left text-xs font-medium text-slate-500 bg-slate-50">
                  <th className="px-3 py-2.5 w-10">#</th>
                  <th className="px-3 py-2.5 min-w-[260px]">Checklist Item</th>
                  <th className="px-3 py-2.5 w-40">Milestone</th>
                  <th className="px-3 py-2.5 w-44">Owner</th>
                  <th className="px-3 py-2.5 w-36">Planned Date</th>
                  <th className="px-3 py-2.5 w-36">Actual Date</th>
                  <th className="px-3 py-2.5 w-40">Link</th>
                  <th className="px-3 py-2.5 w-28">Notes</th>
                  <th className="px-3 py-2.5 w-36">Status</th>
                  <th className="px-3 py-2.5 w-14">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((item) => (
                  <ChecklistItemRow
                    key={item.id}
                    item={item}
                    projectId={projectId}
                    checklistType={checklistType}
                    canWrite={canWrite}
                    notesHidden={notesHidden}
                    canOverride={canOverride}
                    viewerRole={viewerRole}
                    people={people}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {rows.length > PAGE_SIZES[0] && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
              <span>
                Showing {(clampedPage - 1) * pageSize + 1} to {Math.min(clampedPage * pageSize, rows.length)} of {rows.length} items
              </span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((v) => Math.max(1, v - 1))}
                    disabled={clampedPage <= 1}
                    className="rounded-md border border-slate-200 px-2 py-1 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                  >
                    ‹
                  </button>
                  {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPage(n)}
                      className={clsx(
                        "min-w-[1.75rem] rounded-md px-2 py-1",
                        n === clampedPage ? "bg-indigo-600 text-white" : "border border-slate-200 text-slate-500 hover:bg-slate-50"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPage((v) => Math.min(pageCount, v + 1))}
                    disabled={clampedPage >= pageCount}
                    className="rounded-md border border-slate-200 px-2 py-1 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                  >
                    ›
                  </button>
                </div>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value) as (typeof PAGE_SIZES)[number]);
                    setPage(1);
                  }}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n} / page
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {canWrite && (
            <div className="px-4 py-3 border-t border-slate-100">
              <AddItemButton projectId={projectId} checklistType={checklistType} stage={stage} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: ItemStatus }) {
  const color = STATUS_COLORS[status];
  const hollow = status === "NOT_STARTED";
  return (
    <span
      className="h-3.5 w-3.5 rounded-full shrink-0 border-2"
      style={hollow ? { borderColor: color.text, backgroundColor: "transparent" } : { borderColor: color.bg, backgroundColor: color.bg }}
    />
  );
}

const FLOAT_WIDTH = 360;

/**
 * Always shows the item's full wording, wrapped across as many lines as it
 * needs — no truncated single-line input chrome at rest. Editing (canWrite
 * only) still goes through the same floating textarea popup as everywhere
 * else (see InlineText/NotesCell), just triggered by clicking the plain
 * text instead of an input box, since an `<input>` can't wrap text and this
 * design deliberately doesn't want a boxed-looking cell until you interact
 * with it.
 */
function ChecklistItemText({ value, onSave }: { value: string; onSave: (v: string) => Promise<void> }) {
  const [draft, setDraft] = useState(value);
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const anchorRef = useRef<HTMLParagraphElement>(null);
  const coords = useAnchoredPosition(expanded, anchorRef, () => setExpanded(false), { width: FLOAT_WIDTH, estHeight: 140 });

  const commit = () => {
    if (draft !== value) startTransition(() => onSave(draft));
  };

  return (
    <>
      <p
        ref={anchorRef}
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(true)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setExpanded(true)}
        className="text-sm font-medium text-slate-900 rounded px-1 -mx-1 py-0.5 hover:bg-slate-50 cursor-text"
      >
        {draft}
      </p>
      {expanded &&
        coords &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setExpanded(false)} />
            <textarea
              autoFocus
              className="fixed z-50 resize-none rounded-md border border-slate-300 bg-white p-2 text-sm shadow-lg focus:outline-none focus:ring-1 focus:ring-slate-400"
              style={{
                width: FLOAT_WIDTH,
                minHeight: 96,
                left: coords.left,
                ...(coords.openUp ? { bottom: window.innerHeight - coords.top + 4 } : { top: coords.top + 4 }),
              }}
              value={draft}
              disabled={pending}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  commit();
                  setExpanded(false);
                } else if (e.key === "Escape") {
                  setDraft(value);
                  setExpanded(false);
                }
              }}
              onBlur={() => {
                commit();
                setExpanded(false);
              }}
            />
          </>,
          document.body
        )}
    </>
  );
}

/**
 * A link shown as a chip (icon + text) rather than a plain input — matches
 * the rest of this table's badge-y styling. Clicking the chip (canWrite
 * only) opens the same floating-textarea edit pattern as ChecklistItemText/
 * InlineText; the separate small icon-button always navigates, so the two
 * affordances (edit vs. open) never fight over the same click target.
 */
function ChecklistLinkCell({ value, canWrite, onSave }: { value: string | null; canWrite: boolean; onSave: (v: string) => Promise<void> }) {
  const [draft, setDraft] = useState(value ?? "");
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const coords = useAnchoredPosition(expanded, anchorRef, () => setExpanded(false), { width: 320, estHeight: 90 });

  const commit = () => {
    if (draft !== (value ?? "")) startTransition(() => onSave(draft));
  };

  if (!canWrite) {
    return value ? (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        title={value}
        className="inline-flex max-w-[220px] items-center gap-1.5 rounded-full bg-indigo-50 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-100"
      >
        <IconExternalLink className="h-3 w-3 shrink-0" />
        <span className="truncate">{value}</span>
      </a>
    ) : (
      <span className="text-slate-300">—</span>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        ref={anchorRef}
        type="button"
        onClick={() => {
          setDraft(value ?? "");
          setExpanded(true);
        }}
        title={value ?? undefined}
        className={clsx(
          "inline-flex max-w-[180px] items-center gap-1.5 rounded-full px-2 py-1 text-xs",
          value ? "bg-indigo-50 text-indigo-700 hover:bg-indigo-100" : "border border-dashed border-slate-300 text-slate-400 hover:border-slate-400 hover:text-slate-600"
        )}
      >
        <IconExternalLink className="h-3 w-3 shrink-0" />
        <span className="truncate">{value || "Add link"}</span>
      </button>
      {value && (
        <a href={value} target="_blank" rel="noopener noreferrer" title="Open link" className="shrink-0 text-slate-400 hover:text-indigo-600">
          <IconExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
      {expanded &&
        coords &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setExpanded(false)} />
            <textarea
              autoFocus
              className="fixed z-50 resize-none rounded-md border border-slate-300 bg-white p-2 text-sm shadow-lg focus:outline-none focus:ring-1 focus:ring-slate-400"
              style={{
                width: 320,
                minHeight: 60,
                left: coords.left,
                ...(coords.openUp ? { bottom: window.innerHeight - coords.top + 4 } : { top: coords.top + 4 }),
              }}
              value={draft}
              placeholder="https://…"
              disabled={pending}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  commit();
                  setExpanded(false);
                } else if (e.key === "Escape") {
                  setDraft(value ?? "");
                  setExpanded(false);
                }
              }}
              onBlur={() => {
                commit();
                setExpanded(false);
              }}
            />
          </>,
          document.body
        )}
    </div>
  );
}

function ChecklistItemRow({
  item,
  projectId,
  checklistType,
  canWrite,
  notesHidden,
  canOverride,
  viewerRole,
  people,
}: {
  item: ChecklistTableItem;
  projectId: string;
  checklistType: ChecklistType;
  canWrite: boolean;
  notesHidden: boolean;
  canOverride: boolean;
  viewerRole: Role;
  people: { id: string; name: string }[];
}) {
  const slipped = isSlipped(item.plannedDate, item.actualDate, item.status);
  // A PM may reword an item they added themselves; rewording a fixed
  // template item's text is Admin-only (enforced server-side too).
  const canEditText = item.isCustom ? canWrite : viewerRole === "ADMIN";

  return (
    <tr className="border-t border-slate-100 align-top hover:bg-slate-50/40">
      <td className="px-3 py-3 text-xs text-slate-400">{item.order}</td>
      <td className="px-3 py-3">
        <div className="flex items-start gap-2">
          <span className="mt-1"><StatusDot status={item.status as ItemStatus} /></span>
          <div className="min-w-0 flex-1">
            {item.isCustom && (
              <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-500 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide mb-1">
                Custom
              </span>
            )}
            {canEditText ? (
              <ChecklistItemText value={item.itemText} onSave={(v) => updateChecklistItem(item.id, projectId, checklistType, { itemText: v })} />
            ) : (
              <p className="text-sm font-medium text-slate-900">{item.itemText}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        {item.milestoneName ? (
          <span className="inline-flex items-center rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5 text-xs font-medium">
            {item.milestoneName}
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
            style={{ backgroundColor: avatarColorFromString(item.ownerPersonName ?? item.owner ?? "?") }}
          >
            {initials(item.ownerPersonName ?? item.owner ?? "?")}
          </span>
          <div className="min-w-0 flex-1">
            {canWrite ? (
              <PersonPicker
                personId={item.ownerPersonId}
                legacyText={item.owner}
                people={people}
                onSave={(personId) => updateChecklistItem(item.id, projectId, checklistType, { ownerPersonId: personId })}
              />
            ) : (
              <span className="text-sm text-slate-700 truncate block">{item.ownerPersonName || item.owner || "—"}</span>
            )}
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5 text-slate-400">
          <IconCalendar className="h-3.5 w-3.5 shrink-0" />
          {canWrite ? (
            <InlineDate value={toDateInputValue(item.plannedDate)} onSave={(v) => updateChecklistItem(item.id, projectId, checklistType, { plannedDate: v })} />
          ) : (
            <span className="text-sm text-slate-600">{formatDate(item.plannedDate)}</span>
          )}
        </div>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5 text-slate-400">
          <IconCalendar className="h-3.5 w-3.5 shrink-0" />
          {canWrite ? (
            <InlineDate value={toDateInputValue(item.actualDate)} onSave={(v) => updateChecklistItem(item.id, projectId, checklistType, { actualDate: v })} />
          ) : (
            <span className="text-sm text-slate-600">{formatDate(item.actualDate)}</span>
          )}
          {slipped && (
            <span title="Actual Date has slipped past Planned Date" className="text-xs font-bold shrink-0" style={{ color: SLIPPED_FLAG_COLOR }}>
              ⚠
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-3">
        <ChecklistLinkCell value={item.link} canWrite={canWrite} onSave={(v) => updateChecklistItem(item.id, projectId, checklistType, { link: v })} />
      </td>
      <td className="px-3 py-3">
        {!notesHidden && (
          <NotesCell
            icon={<IconFileText className="h-3.5 w-3.5 shrink-0" />}
            value={item.notes}
            canWrite={canWrite}
            onSave={(v) => updateChecklistItem(item.id, projectId, checklistType, { notes: v })}
          />
        )}
      </td>
      <td className="px-3 py-3">
        {canWrite ? (
          <InlineSelect
            value={item.status}
            options={ITEM_STATUSES}
            renderOption={(s) => STATUS_COLORS[s as ItemStatus].label}
            className="rounded-full px-2.5 py-1 text-xs font-medium border-0 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
            style={{ backgroundColor: STATUS_COLORS[item.status as ItemStatus].bg, color: STATUS_COLORS[item.status as ItemStatus].text }}
            onSave={(v) => updateChecklistItem(item.id, projectId, checklistType, { status: v as ItemStatus })}
          />
        ) : (
          <StatusBadge status={item.status as ItemStatus} />
        )}
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5">
          {canOverride && viewerRole === "TPM" && <TpmOverrideChecklistModal projectId={projectId} checklistType={checklistType} item={item} />}
          {canWrite && item.isCustom && (
            <RowActionsMenu actions={[{ label: "Delete item", pendingLabel: "Deleting...", danger: true, onClick: () => deleteChecklistItem(item.id, projectId, checklistType) }]} />
          )}
        </div>
      </td>
    </tr>
  );
}


function AddItemButton({ projectId, checklistType, stage }: { projectId: string; checklistType: ChecklistType; stage: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      onClick={() => startTransition(() => createChecklistItem(projectId, checklistType, stage))}
      disabled={pending}
      className="w-full rounded-lg border border-dashed border-slate-300 py-2 text-xs font-medium text-slate-400 hover:text-slate-600 hover:border-slate-400 disabled:opacity-50"
    >
      {pending ? "Adding..." : "+ Add Item"}
    </button>
  );
}

function StagePill({
  label,
  active,
  done,
  onClick,
}: {
  label: string;
  active: boolean;
  done?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap",
        active
          ? "bg-indigo-600 text-white border-indigo-600"
          : done
          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-300"
          : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
      )}
    >
      {label}
    </button>
  );
}
