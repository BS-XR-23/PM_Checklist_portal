import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { AccessLevel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { computeModuleAccess, ALL_MODULES } from "@/lib/rbac-core";
import { AppShell } from "@/components/layout/app-shell";
import { avatarColorFromString, tagPillStyle } from "@/lib/colors";
import { initials } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/constants";
import { OversightEditor } from "./oversight-editor";

export const dynamic = "force-dynamic";

// BUDGET_TRACKER is Admin-only regardless of membership (lib/rbac-core.ts),
// so showing it per-project would always read NONE — same exclusion the
// Team tab's module grid already makes.
const REPORT_MODULES = ALL_MODULES.filter((m) => m !== "BUDGET_TRACKER");

const ACCESS_LEVEL_STYLE: Record<AccessLevel, { bg: string; text: string }> = {
  NONE: { bg: "#F1F5F9", text: "#94A3B8" },
  READ_LIMITED: { bg: "#FEF3C7", text: "#92400E" },
  READ_FULL: { bg: "#DBEAFE", text: "#1D4ED8" },
  WRITE: { bg: "#D1FAE5", text: "#047857" },
};

function AccessPill({ level }: { level: AccessLevel }) {
  const style = ACCESS_LEVEL_STYLE[level];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {level.replace("_", " ")}
    </span>
  );
}

export default async function UserAccessPage({ params }: { params: { userId: string } }) {
  const currentUser = await requireUser();
  // Super Admin edits; Admin (TPM) and PM can view read-only — Management
  // (PROGRAM_MANAGER) gets no access to this admin screen at all.
  if (currentUser.role !== "ADMIN" && currentUser.role !== "TPM" && currentUser.role !== "PM") redirect("/projects");
  const canEdit = currentUser.role === "ADMIN";

  const targetUser = await prisma.user.findUnique({
    where: { id: params.userId },
    include: { memberships: { include: { project: true, permissions: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!targetUser) notFound();

  const isProgramManager = targetUser.role === "PROGRAM_MANAGER";
  const [oversightRows, allProjects] = isProgramManager
    ? await Promise.all([
        prisma.programOversight.findMany({
          where: { programManagerId: targetUser.id },
          include: { project: true },
          orderBy: { createdAt: "asc" },
        }),
        prisma.project.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
      ])
    : [[], []];
  const overseenProjectIds = new Set(oversightRows.map((r) => r.projectId));
  const assignableProjects = allProjects.filter((p) => !overseenProjectIds.has(p.id));

  const rolePill = tagPillStyle(targetUser.role);

  // ADMIN/TPM/PROGRAM_MANAGER get their access from the global role alone —
  // computeProjectAccess/computeModuleAccess never consult membership rows
  // for them, so there's nothing per-project to enumerate.
  const blanketNote: string | null =
    targetUser.role === "ADMIN"
      ? "Full write access on every project and every module — the only role that can manage Users, People, Checklist Templates, and the global Audit Log."
      : targetUser.role === "TPM"
        ? "Read-only on every project's delivery modules (Budget Tracker excluded), for every project — no membership row needed. Also read-only on Users and People (rates hidden). Write access is limited to their own Escalations tab, plus the audited Override control on checklist items."
        : targetUser.role === "PROGRAM_MANAGER"
          ? "Read-only drill-down into every project's delivery modules, except Decision Log and Action Items (off limits, same as Escalations/Activity/Budget Tracker) — no membership row needed. Also read-only on People (rates hidden), but no access to Users at all."
          : null;

  return (
    <AppShell user={currentUser}>
      <header className="border-b border-slate-200 bg-white px-4 sm:px-6 py-4">
        <Link href="/admin/users" className="text-xs text-slate-400 hover:text-slate-600">
          ← Back to Users
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
            style={{ backgroundColor: avatarColorFromString(targetUser.name) }}
          >
            {initials(targetUser.name)}
          </span>
          <div>
            <h1 className="text-lg font-bold text-slate-900">{targetUser.name}</h1>
            <p className="text-sm text-slate-500">{targetUser.email}</p>
          </div>
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{ backgroundColor: rolePill.bg, color: rolePill.text }}
          >
            {ROLE_LABELS[targetUser.role]}
          </span>
          {!targetUser.isActive && (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
              Inactive
            </span>
          )}
        </div>
      </header>

      <main className="p-4 sm:p-6 space-y-4 max-w-4xl">
        {blanketNote ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-1">Effective access</h2>
            <p className="text-sm text-slate-600">{blanketNote}</p>
            {isProgramManager && (
              <OversightEditor
                programManagerId={targetUser.id}
                overseen={oversightRows.map((r) => ({ id: r.id, projectId: r.projectId, projectName: r.project.name }))}
                assignableProjects={assignableProjects.map((p) => ({ id: p.id, name: p.name }))}
                canEdit={canEdit}
              />
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900">Per-project access</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {targetUser.role === "PM"
                  ? "Full read/write on every module of every project they're a member of."
                  : "Exactly what's configured on each project's Team tab — nothing until an Admin adds a row."}
              </p>
            </div>
            {targetUser.memberships.length === 0 ? (
              <p className="text-sm text-slate-400 p-4">Not a member of any project — this user can&apos;t open anything yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {targetUser.memberships.map((m) => (
                  <div key={m.id} className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Link href={`/projects/${m.projectId}/dashboard`} className="font-medium text-slate-800 hover:underline">
                        {m.project.name}
                      </Link>
                      <span className="text-xs text-slate-400">({ROLE_LABELS[m.role]} on this project)</span>
                    </div>
                    {m.role === "PM" ? (
                      <p className="text-xs text-slate-500">Full write on all modules.</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-1.5">
                        {REPORT_MODULES.map((mod) => (
                          <div key={mod} className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-slate-500">{mod.replace(/_/g, " ")}</span>
                            <AccessPill level={computeModuleAccess(targetUser.role, { role: m.role, permissions: m.permissions }, mod)} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </AppShell>
  );
}
