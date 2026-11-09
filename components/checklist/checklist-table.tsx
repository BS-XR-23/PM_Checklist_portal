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
import { IconTarget, IconCircle, IconClock, IconCalendar, IconExternalLink, IconFileText, IconAlertTriangle } from "@/components/layout/icons";
import { STATUS_COLORS, avatarColorFromString } from "@/lib/colors";
import { ITEM_STATUSES, type ItemStatus } from "@/lib/constants";
import type { ChecklistType } from "@/lib/checklist-types";
import { formatPct, formatDate, toDateInputValue, initials } from "@/lib/format";
import { currentStage } from "@/lib/calculations";
import { summarizeChecklist, checklistFlag, isChecklistItemOverdue, lastDoneLabel, safeHref, type ChecklistFlag } from "@/lib/checklist";
import { canViewQms, missingQmsEvidence, qmsItemStatus } from "@/lib/qms";
import { QMS_CRITERION_BY_ID } from "@/lib/qms-criteria";
import { updateChecklistItem, createChecklistItem, deleteChecklistItem, logChecklistOccurrence, deleteChecklistOccurrence } from "@/app/projects/[projectId]/checklist-actions";
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
  isRecurring: boolean;
  qmsRefs: string[];
  occurrences: ChecklistOccurrenceRow[];
};

export type ChecklistOccurrenceRow = {
  id: string;
  date: Date;
  link: string;
  notes: string | null; // null when stripped by READ_LIMITED access
  recordedByName: string | null;
  sprintName: string | null;
};

const PAGE_SIZES = [10, 25, 50] as const;
const OVERDUE = "__OVERDUE__";
const ALL = "ALL";

const FLAG_CLASS: Record<ChecklistFlag["tone"], string> = {
  red: "bg-rose-50 text-rose-700",
  amber: "bg-amber-50 text-amber-700",
  slate: "bg-slate-100 text-slate-600",
};

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
  const showQms = canViewQms(viewerRole);
  const today = new Date();

  // Recurring cadence items (weekly report, monthly retro, ...) are never
  // "done" — they live in their own block below the stages, outside the
  // counts and current-stage logic (see isTrackedChecklistItem).
  const recurringItems = items.filter((i) => i.isRecurring);
  const stagedItems = items.filter((i) => !i.isRecurring);
  const summary = summarizeChecklist(items, today);

  // Stages the registry doesn't list (a stage retired after items were
  // filed under it, or a typo'd custom stage) still get a group at the end —
  // an item must never silently disappear from its checklist.
  const extraStages = Array.from(new Set(stagedItems.map((i) => i.stage))).filter((st) => !stageOrder.includes(st));
  const groups = [...stageOrder, ...extraStages]
    .map((stage) => ({ stage, rows: stagedItems.filter((i) => i.stage === stage) }))
    .filter((g) => g.rows.length > 0);

  // Dev Checklist (and any other checklist type that never tags an item
  // with a checkpoint) would otherwise show an empty chip slot on every row.
  const showMilestone = items.some((i) => i.milestoneName);
  // A writer always has "Move to ongoing cadence"; a TPM viewer has Override.
  const showActions = canOverride || canWrite;

  // Default to the first stage/category that isn't fully complete yet, so
  // opening the checklist lands you on the work still in front of you
  // instead of always Stage 1. "All" (everything stacked) is one click away.
  const firstIncomplete = currentStage(items, stageOrder);
  const [activeStage, setActiveStage] = useState<string>(groups.length > 1 && firstIncomplete ? firstIncomplete : ALL);
  const [qmsOnly, setQmsOnly] = useState(false);
  const hasQmsItems = showQms && items.some((i) => i.qmsRefs.length > 0);
  const keepRow = (r: ChecklistTableItem) => !qmsOnly || r.qmsRefs.length > 0;

  const visibleGroups = (
    activeStage === ALL
      ? groups
      : activeStage === OVERDUE
        ? groups.map((g) => ({ ...g, rows: g.rows.filter((r) => isChecklistItemOverdue(r, today)) })).filter((g) => g.rows.length > 0)
        : groups.filter((g) => g.stage === activeStage)
  )
    .map((g) => ({ ...g, rows: g.rows.filter(keepRow) }))
    .filter((g) => g.rows.length > 0);
  const visibleRecurring = recurringItems.filter(keepRow);

  const pctOf = (n: number) => formatPct(summary.applicable ? n / summary.applicable : 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="col-span-2 sm:col-span-1 rounded-xl border border-slate-200 bg-white p-3.5 flex items-center gap-3">
          <ProgressRing pct={summary.pct} size={52} stroke={6} />
          <div className="min-w-0">
            <p className="text-xs text-slate-500">Overall Progress</p>
            <p className="text-lg font-bold text-slate-900 leading-tight">{formatPct(summary.pct)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">
              {summary.completed} of {summary.applicable} completed
            </p>
          </div>
        </div>
        <StatTile icon={<IconTarget />} iconWrapClass="bg-blue-50 text-blue-600" label="In Progress" value={String(summary.inProgress)} subtitle={pctOf(summary.inProgress)} />
        <StatTile icon={<IconCircle />} iconWrapClass="bg-slate-100 text-slate-500" label="Not Started" value={String(summary.notStarted)} subtitle={pctOf(summary.notStarted)} />
        <StatTile
          icon={<IconCalendar />}
          iconWrapClass="bg-amber-50 text-amber-600"
          label="Due this week"
          value={String(summary.dueThisWeek)}
          subtitle="planned within 7 days"
        />
        <button
          type="button"
          disabled={summary.overdue === 0}
          onClick={() => setActiveStage(activeStage === OVERDUE ? ALL : OVERDUE)}
          title={summary.overdue ? (activeStage === OVERDUE ? "Show everything again" : "Show only the overdue items") : undefined}
          className={clsx("text-left rounded-xl", summary.overdue > 0 && "hover:ring-1 hover:ring-rose-200", activeStage === OVERDUE && "ring-2 ring-rose-300")}
        >
          <StatTile
            icon={<IconClock />}
            iconWrapClass={summary.overdue ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-400"}
            label="Overdue"
            value={String(summary.overdue)}
            valueColor={summary.overdue ? "#BE123C" : undefined}
            subtitle={summary.overdue ? (activeStage === OVERDUE ? "showing only these" : "click to show them") : "nothing past its date"}
          />
        </button>
      </div>

      {(groups.length > 1 || summary.overdue > 0 || hasQmsItems) && (
        <div className="flex flex-wrap gap-1.5">
          <StagePill label={`All (${stagedItems.length})`} active={activeStage === ALL} onClick={() => setActiveStage(ALL)} />
          {groups.length > 1 &&
            groups.map((g) => {
              // N/A items are excluded from the denominator entirely and count
              // as "done" for the stage's completion flag (nothing left to do).
              const stageApplicable = g.rows.filter((r) => r.status !== "NOT_APPLICABLE");
              const stageCompleted = stageApplicable.filter((r) => r.status === "COMPLETED").length;
              return (
                <StagePill
                  key={g.stage}
                  label={`${g.stage} (${stageCompleted}/${stageApplicable.length})`}
                  active={activeStage === g.stage}
                  done={stageApplicable.every((r) => r.status === "COMPLETED")}
                  onClick={() => setActiveStage(g.stage)}
                />
              );
            })}
          {summary.overdue > 0 && (
            <StagePill label={`Overdue (${summary.overdue})`} active={activeStage === OVERDUE} danger onClick={() => setActiveStage(OVERDUE)} />
          )}
          {hasQmsItems && <StagePill label="QMS items only" active={qmsOnly} onClick={() => setQmsOnly((v) => !v)} />}
        </div>
      )}

      <div className="space-y-4">
        {visibleGroups.map((group) => (
          <StageGroupCard
            key={`${activeStage}-${group.stage}`}
            stage={group.stage}
            stageLabel={stageLabel}
            rows={group.rows}
            projectId={projectId}
            checklistType={checklistType}
            canWrite={canWrite && activeStage !== OVERDUE}
            canEditRows={canWrite}
            notesHidden={notesHidden}
            canOverride={canOverride}
            viewerRole={viewerRole}
            people={people}
            showMilestone={showMilestone}
            showActions={showActions}
            showQms={showQms}
            today={today}
          />
        ))}
        {qmsOnly && activeStage !== OVERDUE && visibleGroups.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
            No QMS items in this stage.{" "}
            <button type="button" onClick={() => setActiveStage(ALL)} className="font-medium text-indigo-600 hover:underline">
              Show all stages
            </button>
          </div>
        )}
        {activeStage === OVERDUE && visibleGroups.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
            Nothing is overdue any more.{" "}
            <button type="button" onClick={() => setActiveStage(ALL)} className="font-medium text-indigo-600 hover:underline">
              Show everything
            </button>
          </div>
        )}
      </div>

      {visibleRecurring.length > 0 && (
        <CadenceBlock rows={visibleRecurring} canWrite={canWrite} notesHidden={notesHidden} showQms={showQms} people={people} today={today} />
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
        {ITEM_STATUSES.map((s) => (
          <div key={s} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[s].bg }} />
            {STATUS_COLORS[s].label}
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
  canEditRows,
  notesHidden,
  canOverride,
  viewerRole,
  people,
  showMilestone,
  showActions,
  showQms,
  today,
}: {
  stage: string;
  stageLabel: string;
  rows: ChecklistTableItem[];
  projectId: string;
  checklistType: ChecklistType;
  /** Shows the add-item form — off in the Overdue filter, where a new item would vanish from view. */
  canWrite: boolean;
  canEditRows: boolean;
  notesHidden: boolean;
  canOverride: boolean;
  viewerRole: Role;
  people: { id: string; name: string }[];
  showMilestone: boolean;
  showActions: boolean;
  showQms: boolean;
  today: Date;
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
          <div className="overflow-x-auto scroll-shadow-x border-t border-slate-100">
            <table className={clsx("w-full text-sm", showActions ? "min-w-[1000px]" : "min-w-[940px]")}>
              <thead>
                <tr className="text-left text-xs font-medium text-slate-500 bg-slate-50">
                  <th className="px-3 py-2.5 w-10">#</th>
                  <th className="px-3 py-2.5 min-w-[260px]">Checklist Item</th>
                  <th className="px-3 py-2.5 w-36">Status</th>
                  <th className="px-3 py-2.5 w-44">Owner</th>
                  <th className="px-3 py-2.5 w-36">Planned Date</th>
                  <th className="px-3 py-2.5 w-36">Actual Date</th>
                  <th className="px-2 py-2.5 w-10">Link</th>
                  <th className="px-2 py-2.5 w-10">Notes</th>
                  {showActions && <th className="px-2 py-2.5 w-12" />}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((item, idx) => (
                  <ChecklistItemRow
                    key={item.id}
                    displayIndex={(clampedPage - 1) * pageSize + idx + 1}
                    item={item}
                    canWrite={canEditRows}
                    notesHidden={notesHidden}
                    canOverride={canOverride}
                    viewerRole={viewerRole}
                    people={people}
                    showMilestone={showMilestone}
                    showActions={showActions}
                    showQms={showQms}
                    today={today}
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

          {canWrite && <AddItemForm projectId={projectId} checklistType={checklistType} stage={stage} />}
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
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const anchorRef = useRef<HTMLParagraphElement>(null);
  const coords = useAnchoredPosition(expanded, anchorRef, () => setExpanded(false), { width: FLOAT_WIDTH, estHeight: 140 });

  const commit = () => {
    if (draft.trim() === value) return setDraft(value);
    if (!draft.trim()) {
      setDraft(value);
      return setError("The item needs some wording — kept the old text.");
    }
    setError(null);
    startTransition(async () => {
      try {
        await onSave(draft);
      } catch (err) {
        setDraft(value);
        setError(err instanceof Error ? err.message : "Couldn't save the wording.");
      }
    });
  };

  return (
    <>
      <p
        ref={anchorRef}
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(true)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setExpanded(true)}
        title={draft}
        className="text-sm font-medium text-slate-900 rounded px-1 -mx-1 py-0.5 hover:bg-slate-50 cursor-text line-clamp-2"
      >
        {draft}
      </p>
      {error && <p className="text-[11px] text-rose-600 mt-0.5">{error}</p>}
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
 * Link as a small icon: filled when set (hover shows the address, the
 * separate arrow opens it), dashed when empty. Writers click the icon to
 * edit in the same floating-textarea pattern as the item text. Only http(s)
 * addresses are ever put in an href (safeHref) — the server refuses
 * anything else on save, and this guards rows saved before that rule.
 */
function ChecklistLinkCell({ value, canWrite, onSave }: { value: string | null; canWrite: boolean; onSave: (v: string) => Promise<void> }) {
  const [draft, setDraft] = useState(value ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const coords = useAnchoredPosition(expanded, anchorRef, () => setExpanded(false), { width: 320, estHeight: 90 });
  const href = safeHref(value);

  const commit = () => {
    if (draft.trim() === (value ?? "")) return;
    setError(null);
    startTransition(async () => {
      try {
        await onSave(draft);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save the link.");
      }
    });
  };

  if (!canWrite) {
    return href ? (
      <a href={href} target="_blank" rel="noopener noreferrer" title={href} className="inline-flex rounded-full bg-indigo-50 p-1.5 text-indigo-700 hover:bg-indigo-100">
        <IconExternalLink className="h-3.5 w-3.5" />
      </a>
    ) : (
      <span className="text-slate-300">—</span>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-1">
        <button
          ref={anchorRef}
          type="button"
          onClick={() => {
            setDraft(value ?? "");
            setExpanded(true);
          }}
          title={value ? `${value} — click to edit` : "Add link"}
          className={clsx(
            "inline-flex rounded-full p-1.5",
            value ? "bg-indigo-50 text-indigo-700 hover:bg-indigo-100" : "border border-dashed border-slate-300 text-slate-400 hover:border-slate-400 hover:text-slate-600"
          )}
        >
          <IconExternalLink className="h-3 w-3" />
        </button>
        {href && (
          <a href={href} target="_blank" rel="noopener noreferrer" title="Open link" className="shrink-0 text-[11px] font-medium text-indigo-600 hover:underline">
            Open
          </a>
        )}
      </div>
      {error && <p className="text-[11px] text-rose-600 mt-0.5 w-40">{error}</p>}
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
                left: Math.max(8, coords.left - 260),
                ...(coords.openUp ? { bottom: window.innerHeight - coords.top + 4 } : { top: coords.top + 4 }),
              }}
              value={draft}
              placeholder="https://… (leave empty to remove)"
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
  displayIndex,
  canWrite,
  notesHidden,
  canOverride,
  viewerRole,
  people,
  showMilestone,
  showActions,
  showQms,
  today,
}: {
  item: ChecklistTableItem;
  /** Position within the currently-filtered view (1, 2, 3, ...), not item.order — the
      item's real template order jumps around once you've filtered to a single stage
      (e.g. 1, 2, 3, 4, 29, 35...), which reads as "items are missing" at a glance. */
  displayIndex: number;
  canWrite: boolean;
  notesHidden: boolean;
  canOverride: boolean;
  viewerRole: Role;
  people: { id: string; name: string }[];
  showMilestone: boolean;
  showActions: boolean;
  showQms: boolean;
  today: Date;
}) {
  const flag = checklistFlag(item, today);
  const linkedToQms = showQms && item.qmsRefs.length > 0;
  // A PM may reword an item they added themselves; rewording a fixed
  // template item's text is Admin-only (enforced server-side too).
  const canEditText = item.isCustom ? canWrite : viewerRole === "ADMIN";
  const save = (data: Parameters<typeof updateChecklistItem>[1]) => updateChecklistItem(item.id, data);

  return (
    <tr className="border-t border-slate-100 align-top hover:bg-slate-50/40">
      <td className="px-3 py-2 text-xs text-slate-400" title={`Template order: ${item.order}`}>{displayIndex}</td>
      <td className="px-3 py-2">
        <div className="flex items-start gap-2">
          <span className="mt-1"><StatusDot status={item.status as ItemStatus} /></span>
          <div className="min-w-0 flex-1">
            {canEditText ? (
              <ChecklistItemText value={item.itemText} onSave={(v) => save({ itemText: v })} />
            ) : (
              <p className="text-sm font-medium text-slate-900 line-clamp-2" title={item.itemText}>
                {item.itemText}
              </p>
            )}
            {(flag || item.isCustom || linkedToQms || (showMilestone && item.milestoneName)) && (
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {flag && (
                  <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", FLAG_CLASS[flag.tone])}>
                    {flag.tone === "red" && <IconAlertTriangle className="h-3 w-3" />}
                    {flag.text}
                  </span>
                )}
                {/* milestoneName is a checklist *checkpoint* label — an internal step,
                    never a payment milestone (those live on Milestones & Payments),
                    and not a G0-G6 gate (those live in the PM Plan). */}
                {showMilestone && item.milestoneName && (
                  <span className="inline-flex items-center rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5 text-[11px] font-medium" title="Checkpoint — an internal step, not a payment milestone">
                    Checkpoint: {item.milestoneName}
                  </span>
                )}
                {linkedToQms && <QmsBadge item={item} />}
                {item.isCustom && (
                  <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-500 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">Custom</span>
                )}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-3 py-2">
        {canWrite ? (
          <InlineSelect
            value={item.status}
            options={ITEM_STATUSES}
            renderOption={(s) => STATUS_COLORS[s as ItemStatus].label}
            className="rounded-full px-2.5 py-1 text-xs font-medium border-0 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer"
            style={{ backgroundColor: STATUS_COLORS[item.status as ItemStatus].bg, color: STATUS_COLORS[item.status as ItemStatus].text }}
            onSave={(v) => save({ status: v as ItemStatus })}
          />
        ) : (
          <StatusBadge status={item.status as ItemStatus} />
        )}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
            style={{ backgroundColor: avatarColorFromString(item.ownerPersonName ?? item.owner ?? "?") }}
          >
            {initials(item.ownerPersonName ?? item.owner ?? "?")}
          </span>
          {/* A fixed width floor, not min-w-0: in auto table layout a flex-1
              child with no floor can get collapsed to near-zero by the
              browser's column-width algorithm. */}
          <div className="min-w-[120px] flex-1">
            {canWrite ? (
              <PersonPicker personId={item.ownerPersonId} legacyText={item.owner} people={people} onSave={(personId) => save({ ownerPersonId: personId })} />
            ) : (
              <span className="text-sm text-slate-700 truncate block" title={item.ownerPersonName || item.owner || undefined}>
                {item.ownerPersonName || item.owner || "—"}
              </span>
            )}
          </div>
        </div>
      </td>
      <td className="px-3 py-2">
        {/* Empty date cells recede (opacity) so a scan down the column finds the
            filled-in dates first. */}
        <div className={clsx("flex items-center gap-1.5 text-slate-400", !item.plannedDate && "opacity-50")}>
          {!canWrite && <IconCalendar className="h-3.5 w-3.5 shrink-0" />}
          {canWrite ? (
            <InlineDate value={toDateInputValue(item.plannedDate)} onSave={(v) => save({ plannedDate: v })} />
          ) : (
            <span className="text-sm text-slate-600">{formatDate(item.plannedDate)}</span>
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        <div className={clsx("flex items-center gap-1.5 text-slate-400", !item.actualDate && "opacity-50")}>
          {!canWrite && <IconCalendar className="h-3.5 w-3.5 shrink-0" />}
          {canWrite ? (
            <InlineDate value={toDateInputValue(item.actualDate)} onSave={(v) => save({ actualDate: v })} />
          ) : (
            <span className="text-sm text-slate-600">{formatDate(item.actualDate)}</span>
          )}
        </div>
      </td>
      <td className="px-2 py-2">
        <ChecklistLinkCell value={item.link} canWrite={canWrite} onSave={(v) => save({ link: v })} />
      </td>
      <td className="px-2 py-2">
        {!notesHidden && (
          <NotesCell icon={<IconFileText className="h-3.5 w-3.5 shrink-0" />} value={item.notes} canWrite={canWrite} iconOnly onSave={(v) => save({ notes: v })} />
        )}
      </td>
      {showActions && (
        <td className="px-2 py-2">
          <div className="flex items-center gap-1.5">
            {canOverride && <TpmOverrideChecklistModal item={item} people={people} />}
            {canWrite && (
              <RowActionsMenu
                actions={[
                  {
                    label: "Move to ongoing cadence",
                    pendingLabel: "Moving...",
                    confirmMessage: `Move "${item.itemText.slice(0, 60)}" to Ongoing cadence? It stops counting toward completion % and overdue until you move it back.`,
                    onClick: () => save({ isRecurring: true }),
                  },
                  ...(item.isCustom
                    ? [
                        {
                          label: "Delete item",
                          pendingLabel: "Deleting...",
                          danger: true,
                          confirmMessage: `Delete "${item.itemText.slice(0, 60)}"? This can't be undone.`,
                          onClick: () => deleteChecklistItem(item.id),
                        },
                      ]
                    : []),
                ]}
              />
            )}
          </div>
        </td>
      )}
    </tr>
  );
}

/** Shows which QMS criteria an item answers, and warns when a completed item doesn't count yet. */
function QmsBadge({ item }: { item: ChecklistTableItem }) {
  const criteria = item.qmsRefs.flatMap((ref) => (QMS_CRITERION_BY_ID[ref] ? [QMS_CRITERION_BY_ID[ref]] : []));
  const title = criteria.map((c) => `QMS: ${c.text}\nExpected evidence: ${c.evidence}`).join("\n\n");
  const status = qmsItemStatus({ ...item, ownerName: item.ownerPersonName ?? item.owner });
  const missing =
    status !== "EVIDENCE_MISSING"
      ? null
      : item.status === "NOT_APPLICABLE"
        ? "add a reason in notes"
        : `add ${missingQmsEvidence({ ...item, ownerName: item.ownerPersonName ?? item.owner }).join(", ")}`;

  return (
    <>
      <span title={title} className="inline-flex cursor-help items-center rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700">
        QMS
      </span>
      {missing && <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">Not counted yet: {missing}</span>}
    </>
  );
}

/**
 * Ongoing cadence activities — recurring work (weekly CPI/SPI report, monthly
 * retro, status meetings) that's never "done", so it sits outside the stage
 * groups and doesn't count toward completion % or current stage. Each time one
 * happens the owner logs it with a link; "Last done" follows the newest log, and
 * those logs are what QMS reads. How often is guidance only: nothing is flagged
 * as overdue here.
 */
function CadenceBlock({
  rows,
  canWrite,
  notesHidden,
  showQms,
  people,
  today,
}: {
  rows: ChecklistTableItem[];
  canWrite: boolean;
  notesHidden: boolean;
  showQms: boolean;
  people: { id: string; name: string }[];
  today: Date;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <p className="text-sm font-semibold text-slate-900">Ongoing cadence</p>
        <p className="text-xs text-slate-500">
          Recurring activities — not counted in completion % or stage progress. Use <strong>Log</strong> each time one happens, with a link to the evidence.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-left text-xs font-medium text-slate-500 bg-slate-50">
              <th className="px-3 py-2.5">Activity</th>
              <th className="px-3 py-2.5 w-52">Owner</th>
              <th className="px-3 py-2.5 w-44">Last done</th>
              <th className="px-3 py-2.5 w-40">Evidence</th>
              <th className="px-2 py-2.5 w-10">Notes</th>
              {canWrite && <th className="px-2 py-2.5 w-10" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <CadenceRow key={item.id} item={item} canWrite={canWrite} notesHidden={notesHidden} showQms={showQms} people={people} today={today} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CadenceRow({
  item,
  canWrite,
  notesHidden,
  showQms,
  people,
  today,
}: {
  item: ChecklistTableItem;
  canWrite: boolean;
  notesHidden: boolean;
  showQms: boolean;
  people: { id: string; name: string }[];
  today: Date;
}) {
  const [panel, setPanel] = useState<"none" | "log" | "history">("none");
  const logCount = item.occurrences.length;
  const notApplicable = item.status === "NOT_APPLICABLE";
  const columns = canWrite ? 6 : 5;
  const togglePanel = (next: "log" | "history") => setPanel((p) => (p === next ? "none" : next));

  return (
    <>
      <tr className="border-t border-slate-100 align-top">
        <td className="px-3 py-2.5 text-slate-800">
          {item.itemText}
          {(notApplicable || (showQms && item.qmsRefs.length > 0)) && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {notApplicable && <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">Not applicable</span>}
              {showQms && item.qmsRefs.length > 0 && <QmsBadge item={item} />}
            </div>
          )}
        </td>
        <td className="px-3 py-2.5">
          {canWrite ? (
            <div className="min-w-[160px]">
              <PersonPicker personId={item.ownerPersonId} legacyText={item.owner} people={people} onSave={(personId) => updateChecklistItem(item.id, { ownerPersonId: personId })} />
            </div>
          ) : (
            <span className="text-slate-600">{item.ownerPersonName ?? item.owner ?? "—"}</span>
          )}
        </td>
        <td className="px-3 py-2.5">
          <p className="text-slate-600">{item.actualDate ? formatDate(item.actualDate) : "—"}</p>
          <p className="text-xs text-slate-500 whitespace-nowrap">{item.actualDate ? lastDoneLabel(item.actualDate, today) : "never logged"}</p>
        </td>
        <td className="px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {canWrite && !notApplicable && (
              <button type="button" onClick={() => togglePanel("log")} className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                Log
              </button>
            )}
            {logCount > 0 ? (
              <button type="button" onClick={() => togglePanel("history")} className="text-xs font-medium text-indigo-600 hover:underline">
                {logCount} log{logCount === 1 ? "" : "s"}
              </button>
            ) : (
              !canWrite && <span className="text-xs text-slate-400">No logs</span>
            )}
          </div>
        </td>
        <td className="px-2 py-2.5">
          {!notesHidden && <NotesCell icon={<IconFileText className="h-3.5 w-3.5 shrink-0" />} value={item.notes} canWrite={canWrite} iconOnly onSave={(v) => updateChecklistItem(item.id, { notes: v })} />}
        </td>
        {canWrite && (
          <td className="px-2 py-2.5">
            <RowActionsMenu
              actions={[
                notApplicable
                  ? {
                      label: "Mark as applicable",
                      pendingLabel: "Saving...",
                      onClick: () => updateChecklistItem(item.id, { status: "NOT_STARTED" }),
                    }
                  : {
                      label: "Mark Not Applicable",
                      pendingLabel: "Saving...",
                      confirmMessage: `Mark "${item.itemText.slice(0, 60)}" Not Applicable? Add the reason in its notes, or it won't count for QMS.`,
                      onClick: () => updateChecklistItem(item.id, { status: "NOT_APPLICABLE" }),
                    },
                {
                  label: "Move back to its stage",
                  pendingLabel: "Moving...",
                  onClick: () => updateChecklistItem(item.id, { isRecurring: false }),
                },
              ]}
            />
          </td>
        )}
      </tr>
      {panel === "log" && (
        <tr className="bg-slate-50/60">
          <td colSpan={columns} className="px-3 py-3">
            <LogOccurrenceForm itemId={item.id} today={today} onDone={() => setPanel("none")} />
          </td>
        </tr>
      )}
      {panel === "history" && (
        <tr className="bg-slate-50/60">
          <td colSpan={columns} className="px-3 py-3">
            <OccurrenceHistory occurrences={item.occurrences} canWrite={canWrite} />
          </td>
        </tr>
      )}
    </>
  );
}

function LogOccurrenceForm({ itemId, today, onDone }: { itemId: string; today: Date; onDone: () => void }) {
  const [date, setDate] = useState(toDateInputValue(today) ?? "");
  const [link, setLink] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputClass = "rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await logChecklistOccurrence(itemId, { date, link, notes });
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save the log.");
      }
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <label className="block">
        <span className="mb-0.5 block text-[11px] text-slate-500">Date it happened</span>
        <input type="date" required value={date} disabled={pending} onChange={(e) => setDate(e.target.value)} className={inputClass} />
      </label>
      <label className="block min-w-[260px] flex-1">
        <span className="mb-0.5 block text-[11px] text-slate-500">Evidence link</span>
        <input required value={link} disabled={pending} placeholder="https://…" onChange={(e) => setLink(e.target.value)} className={clsx(inputClass, "w-full")} />
      </label>
      <label className="block min-w-[200px] flex-1">
        <span className="mb-0.5 block text-[11px] text-slate-500">Notes (optional)</span>
        <input value={notes} disabled={pending} onChange={(e) => setNotes(e.target.value)} className={clsx(inputClass, "w-full")} />
      </label>
      <button type="submit" disabled={pending} className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
        {pending ? "Saving..." : "Save log"}
      </button>
      {error && <p className="basis-full text-xs text-rose-600">{error}</p>}
    </form>
  );
}

function OccurrenceHistory({ occurrences, canWrite }: { occurrences: ChecklistOccurrenceRow[]; canWrite: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const remove = (o: ChecklistOccurrenceRow) => {
    if (!window.confirm(`Remove the log from ${formatDate(o.date)}? This can't be undone.`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteChecklistOccurrence(o.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't remove the log.");
      }
    });
  };

  return (
    <div className={clsx(pending && "opacity-60")}>
      <ul className="space-y-1.5">
        {occurrences.map((o) => {
          const href = safeHref(o.link);
          return (
            <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-600">
              <span className="font-medium text-slate-800">{formatDate(o.date)}</span>
              {o.sprintName && <span>{o.sprintName}</span>}
              {href && (
                <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline">
                  <IconExternalLink className="h-3 w-3" />
                  Open evidence
                </a>
              )}
              {o.recordedByName && <span className="text-slate-500">by {o.recordedByName}</span>}
              {o.notes && <span className="text-slate-500">{o.notes}</span>}
              {canWrite && (
                <button type="button" disabled={pending} onClick={() => remove(o)} className="font-medium text-rose-600 hover:text-rose-700">
                  Remove
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

/** One-line add for a project-specific step the fixed template doesn't cover. */
function AddItemForm({ projectId, checklistType, stage }: { projectId: string; checklistType: ChecklistType; stage: string }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await createChecklistItem(projectId, checklistType, stage, text);
        setText("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add.");
      }
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50/60">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`+ Add a project-specific item to ${stage}`}
        disabled={pending}
        className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
      />
      {text.trim() && (
        <button type="submit" disabled={pending} className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
          {pending ? "Adding..." : "Add"}
        </button>
      )}
      {error && <p className="basis-full text-xs text-rose-600">{error}</p>}
    </form>
  );
}

function StagePill({
  label,
  active,
  done,
  danger,
  onClick,
}: {
  label: string;
  active: boolean;
  done?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap",
        active
          ? danger
            ? "bg-rose-600 text-white border-rose-600"
            : "bg-indigo-600 text-white border-indigo-600"
          : danger
            ? "bg-rose-50 text-rose-700 border-rose-200 hover:border-rose-300"
            : done
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-300"
              : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
      )}
    >
      {label}
    </button>
  );
}
