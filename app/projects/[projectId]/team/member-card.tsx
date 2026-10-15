"use client";

import { useState, useTransition } from "react";
import type { Role, ModuleName, AccessLevel } from "@prisma/client";
import clsx from "clsx";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { avatarColorFromString, ACCESS_LEVEL_COLORS, MEMBERSHIP_ROLE_COLORS } from "@/lib/colors";
import { initials } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/constants";
import { ACCESS_PRESETS, ALL_MODULES as RBAC_ALL_MODULES } from "@/lib/rbac-core";
import { removeProjectMember, setModulePermission, applyAccessPreset } from "./team-actions";

// The grid is laid out by the project tab each module lives under, with the
// names people see on screen — not the internal enum names. BUDGET_TRACKER
// is left out: it's Super-Admin-only (lib/rbac-core.ts computeModuleAccess),
// so a per-member setting for it would be ignored.
const MODULE_GROUPS: { tab: string; modules: { module: ModuleName; label: string }[] }[] = [
  { tab: "Dashboard", modules: [{ module: "DASHBOARD", label: "Dashboard" }] },
  {
    tab: "Checklist",
    modules: [
      { module: "PM_CHECKLIST", label: "PM" },
      { module: "DELIVERY_QA_CHECKLIST", label: "Delivery & QA" },
      { module: "DEVOPS_CHECKLIST", label: "DevOps" },
      { module: "CREATIVE_XR_CHECKLIST", label: "Creative & XR" },
    ],
  },
  { tab: "Milestones & Payments", modules: [{ module: "MILESTONES", label: "Milestones & Payments" }] },
  {
    tab: "Risk & CR",
    modules: [
      { module: "RISK_REGISTER", label: "Risks" },
      { module: "CR_LOG", label: "Change requests" },
    ],
  },
  { tab: "Dependencies", modules: [{ module: "DEPENDENCIES", label: "Dependencies" }] },
  {
    tab: "Delivery",
    modules: [
      { module: "DELIVERY", label: "Overview, tasks & sprints" },
      { module: "DEV_CHECKLIST", label: "Dev checklist" },
      { module: "RELEASE", label: "Releases" },
      { module: "UAT", label: "UAT" },
    ],
  },
  { tab: "PM Plan", modules: [{ module: "PM_PLAN", label: "PM Plan" }] },
  {
    tab: "Decisions",
    modules: [
      { module: "DECISION_LOG", label: "Decision log" },
      { module: "ACTION_ITEMS", label: "Action items" },
    ],
  },
];
// Anything added to lib/rbac-core.ts's ALL_MODULES but not placed above
// still shows up (under "Other") rather than silently missing from the grid.
const GROUPED = new Set(MODULE_GROUPS.flatMap((g) => g.modules.map((m) => m.module)));
const UNGROUPED = RBAC_ALL_MODULES.filter((m) => m !== "BUDGET_TRACKER" && !GROUPED.has(m));
const GROUPS = UNGROUPED.length
  ? [...MODULE_GROUPS, { tab: "Other", modules: UNGROUPED.map((m) => ({ module: m, label: m.replace(/_/g, " ").toLowerCase() })) }]
  : MODULE_GROUPS;
const ALL_MODULES = GROUPS.flatMap((g) => g.modules.map((m) => m.module));

const ACCESS_LEVELS: AccessLevel[] = ["NONE", "READ_LIMITED", "READ_FULL", "WRITE"];

export type MemberRowData = {
  id: string;
  role: Role;
  userName: string;
  userEmail: string;
  permissions: { module: ModuleName; access: AccessLevel }[];
};

export function MemberCard({ projectId, membership, canEdit }: { projectId: string; membership: MemberRowData; canEdit: boolean }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const accessFor = (module: ModuleName) => membership.permissions.find((p) => p.module === module)?.access ?? "NONE";
  const rolePill = MEMBERSHIP_ROLE_COLORS[membership.role] ?? { bg: "#E2E8F0", text: "#475569" };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/40">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
          style={{ backgroundColor: avatarColorFromString(membership.userName) }}
        >
          {initials(membership.userName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-slate-800 truncate">{membership.userName}</p>
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
              style={{ backgroundColor: rolePill.bg, color: rolePill.text }}
            >
              {ROLE_LABELS[membership.role]}
            </span>
          </div>
          <p className="text-xs text-slate-500 truncate">{membership.userEmail}</p>
        </div>
        {canEdit && (
          <RowActionsMenu
            actions={[
              {
                label: "Remove from project",
                pendingLabel: "Removing...",
                danger: true,
                onClick: () => removeProjectMember(membership.id, projectId),
              },
            ]}
          />
        )}
      </div>

      <div className="px-4 py-3">
        {membership.role === "PM" ? (
          <p className="text-xs text-slate-500">Sees and edits every area except the Budget Tracker (Super Admin only) — a PM isn&apos;t limited per area.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-600">{accessSummary(ALL_MODULES.map(accessFor))}</p>
              <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
                {open ? "Hide" : canEdit ? "Change access" : "Show details"}
              </button>
            </div>
            {open && (
              <div className="mt-3 space-y-3">
                {canEdit && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-500">Set everything at once:</span>
                    <select
                      defaultValue=""
                      disabled={pending}
                      onChange={(e) => {
                        const key = e.target.value;
                        if (!key) return;
                        startTransition(() => applyAccessPreset(membership.id, projectId, key));
                        e.target.value = "";
                      }}
                      className="text-xs rounded-md border border-slate-300 px-2 py-1 text-slate-600"
                    >
                      <option value="">Choose a preset…</option>
                      {ACCESS_PRESETS.map((p) => (
                        <option key={p.key} value={p.key} title={p.description}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {GROUPS.map((g) => (
                    <div key={g.tab} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
                      <p className="mb-1.5 text-[11px] font-semibold text-slate-700">{g.tab} tab</p>
                      <div className="space-y-1.5">
                        {g.modules.map(({ module: m, label }) => {
                          const level = accessFor(m);
                          const style = ACCESS_LEVEL_COLORS[level];
                          return (
                            <div key={m} className="flex items-center justify-between gap-2">
                              {g.modules.length > 1 && <span className="min-w-0 truncate text-[11px] text-slate-500">{label}</span>}
                              {canEdit ? (
                                <select
                                  // Keyed on the current value so a preset (which
                                  // changes several of these at once) remounts it —
                                  // an uncontrolled select only reads defaultValue
                                  // on first mount.
                                  key={level}
                                  defaultValue={level}
                                  disabled={pending}
                                  aria-label={`${g.tab}${g.modules.length > 1 ? ` — ${label}` : ""}`}
                                  onChange={(e) => startTransition(() => setModulePermission(membership.id, projectId, m, e.target.value as AccessLevel))}
                                  className={clsx(
                                    "rounded-md border-0 px-1.5 py-1 text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-slate-400",
                                    g.modules.length > 1 ? "w-28 shrink-0" : "w-full"
                                  )}
                                  style={{ backgroundColor: style.bg, color: style.text }}
                                >
                                  {ACCESS_LEVELS.map((a) => (
                                    <option key={a} value={a}>
                                      {ACCESS_LEVEL_COLORS[a].label}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium" style={{ backgroundColor: style.bg, color: style.text }}>
                                  {style.label}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** "Sees 12 of 16 areas (all read-only, some with details hidden)" — the grid in one line. */
function accessSummary(levels: AccessLevel[]): string {
  const visible = levels.filter((l) => l !== "NONE");
  if (!visible.length) return "Can't see anything on this project yet.";
  const writes = visible.filter((l) => l === "WRITE").length;
  const limited = visible.filter((l) => l === "READ_LIMITED").length;
  const parts = [
    writes ? `can edit ${writes === visible.length ? "all of them" : writes}` : "read-only",
    limited ? `${limited === visible.length ? "all" : limited} with details hidden` : null,
  ].filter(Boolean);
  return `Sees ${visible.length === levels.length ? "every area" : `${visible.length} of ${levels.length} areas`} · ${parts.join(" · ")}`;
}
