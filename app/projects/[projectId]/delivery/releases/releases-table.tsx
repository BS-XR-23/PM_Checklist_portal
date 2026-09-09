"use client";

import { useState, useTransition } from "react";
import { InlineDate, InlineSelect, InlineText, InlineTextarea } from "@/components/ui/inline-edit";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { PersonPicker } from "@/components/resourcing/person-picker";
import { IconChevronDown } from "@/components/layout/icons";
import {
  RELEASE_TYPES,
  RELEASE_TYPE_LABELS,
  RELEASE_DEPLOYMENT_STATUSES,
  RELEASE_APPROVAL_STATUSES,
  UAT_SIGNOFF_STATUSES,
} from "@/lib/constants";
import { RELEASE_DEPLOYMENT_STATUS_COLORS, RELEASE_APPROVAL_STATUS_COLORS } from "@/lib/colors";
import { formatDate } from "@/lib/format";
import { updateRelease, deleteRelease, toggleReleaseSprint, toggleReleaseWbsTask } from "./release-actions";
import type { ReleaseType } from "@prisma/client";

export type ReleaseTableRow = {
  id: string;
  version: string;
  name: string;
  type: ReleaseType;
  environment: string | null;
  releaseDate: Date | null;
  ownerPersonId: string | null;
  ownerPersonName: string | null;
  relatedMilestoneId: string | null;
  relatedMilestoneName: string | null;
  buildNumber: string | null;
  releaseNotes: string | null;
  deploymentStatus: string;
  rollbackVersion: string | null;
  approvalStatus: string;
  postReleaseValidation: string | null;
  knownIssues: string | null;
  uatSignoffStatus: string;
  uatSignoffDate: Date | null;
  uatFeedback: string | null;
  sprintIds: string[];
  wbsTaskIds: string[];
};

function toDateInput(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function pillClass() {
  return "rounded-full px-2.5 py-1 text-xs font-medium border-0 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer";
}

export function ReleasesTable({
  projectId,
  canWrite,
  milestones,
  sprints,
  wbsTasks,
  people,
  rows,
}: {
  projectId: string;
  canWrite: boolean;
  milestones: { id: string; name: string }[];
  sprints: { id: string; name: string }[];
  wbsTasks: { id: string; wbsNumber: string; title: string }[];
  people: { id: string; name: string }[];
  rows: ReleaseTableRow[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-400 rounded-xl border border-slate-200 bg-white p-4">
        No releases yet — add one once a build is ready to ship.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const isOpen = expanded === r.id;
        const deployColor = RELEASE_DEPLOYMENT_STATUS_COLORS[r.deploymentStatus] ?? RELEASE_DEPLOYMENT_STATUS_COLORS.Planned;
        const approvalColor = RELEASE_APPROVAL_STATUS_COLORS[r.approvalStatus] ?? RELEASE_APPROVAL_STATUS_COLORS.Pending;
        return (
          <div key={r.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : r.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50/60"
            >
              <IconChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              <div className="min-w-0 flex-1 grid grid-cols-2 sm:grid-cols-5 gap-2 items-center">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{r.version}</p>
                  <p className="text-xs text-slate-500 truncate">{r.name}</p>
                </div>
                <span className="text-xs text-slate-500">{RELEASE_TYPE_LABELS[r.type]}</span>
                <span className="text-xs text-slate-500">{r.environment ?? "—"}</span>
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap w-fit"
                  style={{ backgroundColor: deployColor.bg, color: deployColor.text }}
                >
                  {r.deploymentStatus}
                </span>
                <span className="text-xs text-slate-500">{formatDate(r.releaseDate)}</span>
              </div>
              {canWrite && (
                <div onClick={(e) => e.stopPropagation()}>
                  <RowActionsMenu actions={[{ label: "Delete Release", pendingLabel: "Deleting...", danger: true, onClick: () => deleteRelease(r.id, projectId) }]} />
                </div>
              )}
            </button>

            {isOpen && (
              <div className="border-t border-slate-100 p-4 space-y-4 bg-slate-50/40">
                <div className="grid sm:grid-cols-3 gap-4">
                  <Field label="Version">
                    {canWrite ? <InlineText value={r.version} onSave={(v) => updateRelease(r.id, projectId, { version: v })} /> : <p className="text-sm">{r.version}</p>}
                  </Field>
                  <Field label="Name">
                    {canWrite ? <InlineText value={r.name} onSave={(v) => updateRelease(r.id, projectId, { name: v })} /> : <p className="text-sm">{r.name}</p>}
                  </Field>
                  <Field label="Type">
                    {canWrite ? (
                      <InlineSelect value={r.type} options={RELEASE_TYPES} renderOption={(t) => RELEASE_TYPE_LABELS[t]} onSave={(v) => updateRelease(r.id, projectId, { type: v as ReleaseType })} />
                    ) : (
                      <p className="text-sm">{RELEASE_TYPE_LABELS[r.type]}</p>
                    )}
                  </Field>
                  <Field label="Environment">
                    {canWrite ? <InlineText value={r.environment ?? ""} onSave={(v) => updateRelease(r.id, projectId, { environment: v })} /> : <p className="text-sm">{r.environment ?? "—"}</p>}
                  </Field>
                  <Field label="Release Date">
                    {canWrite ? <InlineDate value={toDateInput(r.releaseDate)} onSave={(v) => updateRelease(r.id, projectId, { releaseDate: v })} /> : <p className="text-sm">{formatDate(r.releaseDate)}</p>}
                  </Field>
                  <Field label="Owner">
                    {canWrite ? (
                      <PersonPicker personId={r.ownerPersonId} legacyText={null} people={people} onSave={(personId) => updateRelease(r.id, projectId, { ownerPersonId: personId })} />
                    ) : (
                      <p className="text-sm">{r.ownerPersonName ?? "—"}</p>
                    )}
                  </Field>
                  <Field label="Build Number">
                    {canWrite ? <InlineText value={r.buildNumber ?? ""} onSave={(v) => updateRelease(r.id, projectId, { buildNumber: v })} /> : <p className="text-sm">{r.buildNumber ?? "—"}</p>}
                  </Field>
                  <Field label="Rollback Version">
                    {canWrite ? <InlineText value={r.rollbackVersion ?? ""} onSave={(v) => updateRelease(r.id, projectId, { rollbackVersion: v })} /> : <p className="text-sm">{r.rollbackVersion ?? "—"}</p>}
                  </Field>
                  <Field label="Related Milestone">
                    {canWrite ? (
                      <select
                        defaultValue={r.relatedMilestoneId ?? ""}
                        onChange={(e) => updateRelease(r.id, projectId, { relatedMilestoneId: e.target.value || null })}
                        className="w-full rounded border border-slate-200 px-1.5 py-1 text-sm"
                      >
                        <option value="">—</option>
                        {milestones.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-sm">{r.relatedMilestoneName ?? "—"}</p>
                    )}
                  </Field>
                  <Field label="Deployment Status">
                    {canWrite ? (
                      <InlineSelect
                        value={r.deploymentStatus}
                        options={RELEASE_DEPLOYMENT_STATUSES}
                        className={pillClass()}
                        style={{ backgroundColor: deployColor.bg, color: deployColor.text }}
                        onSave={(v) => updateRelease(r.id, projectId, { deploymentStatus: v })}
                      />
                    ) : (
                      <span className={pillClass()} style={{ backgroundColor: deployColor.bg, color: deployColor.text }}>
                        {r.deploymentStatus}
                      </span>
                    )}
                  </Field>
                  <Field label="Approval Status">
                    {canWrite ? (
                      <InlineSelect
                        value={r.approvalStatus}
                        options={RELEASE_APPROVAL_STATUSES}
                        className={pillClass()}
                        style={{ backgroundColor: approvalColor.bg, color: approvalColor.text }}
                        onSave={(v) => updateRelease(r.id, projectId, { approvalStatus: v })}
                      />
                    ) : (
                      <span className={pillClass()} style={{ backgroundColor: approvalColor.bg, color: approvalColor.text }}>
                        {r.approvalStatus}
                      </span>
                    )}
                  </Field>
                  <Field label="UAT Sign-off">
                    {canWrite ? (
                      <InlineSelect value={r.uatSignoffStatus} options={UAT_SIGNOFF_STATUSES} onSave={(v) => updateRelease(r.id, projectId, { uatSignoffStatus: v })} />
                    ) : (
                      <p className="text-sm">{r.uatSignoffStatus}</p>
                    )}
                  </Field>
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <Field label="Release Notes">
                    {canWrite ? <InlineTextarea value={r.releaseNotes ?? ""} onSave={(v) => updateRelease(r.id, projectId, { releaseNotes: v })} /> : <p className="text-sm whitespace-pre-wrap">{r.releaseNotes ?? "—"}</p>}
                  </Field>
                  <Field label="Known Issues">
                    {canWrite ? <InlineTextarea value={r.knownIssues ?? ""} onSave={(v) => updateRelease(r.id, projectId, { knownIssues: v })} /> : <p className="text-sm whitespace-pre-wrap">{r.knownIssues ?? "—"}</p>}
                  </Field>
                  <Field label="Post-Release Validation">
                    {canWrite ? (
                      <InlineTextarea value={r.postReleaseValidation ?? ""} onSave={(v) => updateRelease(r.id, projectId, { postReleaseValidation: v })} />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{r.postReleaseValidation ?? "—"}</p>
                    )}
                  </Field>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <LinkPicker
                    title="Related Sprint(s)"
                    options={sprints}
                    selectedIds={r.sprintIds}
                    canWrite={canWrite}
                    onToggle={(id, linked) => toggleReleaseSprint(r.id, id, linked, projectId)}
                  />
                  <LinkPicker
                    title="Included WBS"
                    options={wbsTasks.map((t) => ({ id: t.id, name: `${t.wbsNumber} — ${t.title}` }))}
                    selectedIds={r.wbsTaskIds}
                    canWrite={canWrite}
                    onToggle={(id, linked) => toggleReleaseWbsTask(r.id, id, linked, projectId)}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      {children}
    </div>
  );
}

function LinkPicker({
  title,
  options,
  selectedIds,
  canWrite,
  onToggle,
}: {
  title: string;
  options: { id: string; name: string }[];
  selectedIds: string[];
  canWrite: boolean;
  onToggle: (id: string, linked: boolean) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const selected = new Set(selectedIds);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-medium text-slate-500 mb-2">
        {title} ({selectedIds.length})
      </p>
      {options.length === 0 ? (
        <p className="text-xs text-slate-400">None available.</p>
      ) : (
        <div className="max-h-40 overflow-y-auto space-y-1">
          {options.map((o) => (
            <label key={o.id} className="flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                disabled={!canWrite || pending}
                checked={selected.has(o.id)}
                onChange={(e) => startTransition(() => onToggle(o.id, e.target.checked))}
              />
              <span className="truncate">{o.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
