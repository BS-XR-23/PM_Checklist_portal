import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, requireProjectAccess } from "@/lib/rbac";
import { canViewResourcing } from "@/lib/resourcing-rbac";
import { SubNav } from "@/components/ui/sub-nav";
import { PageGuide } from "@/components/ui/page-guide";
import { IconUsers } from "@/components/layout/icons";
import { ROLE_LABELS } from "@/lib/constants";
import { AddMemberForm } from "./add-member-form";
import { MemberCard } from "./member-card";

export default async function TeamPage({ params }: { params: { projectId: string } }) {
  const user = await requireUser();
  await requireProjectAccess(params.projectId);

  // Admin edits; TPM, Program Manager, and the project's own PM can see who has access.
  if (user.role !== "ADMIN" && user.role !== "TPM" && user.role !== "PROGRAM_MANAGER" && user.role !== "PM") {
    // 404 like every other RBAC denial (existence isn't revealed) — a throw
    // here surfaced as a 500 for Guest/Management.
    notFound();
  }
  const canEdit = user.role === "ADMIN";

  const subNavOptions = [
    { href: "/team", label: "Access" },
    ...(canViewResourcing(user.role) ? [{ href: "/resourcing", label: "Engagement" }] : []),
  ];

  const memberships = await prisma.projectMembership.findMany({
    where: { projectId: params.projectId },
    include: { user: true, permissions: true },
    orderBy: { createdAt: "asc" },
  });

  const counts = (["PM", "CLIENT", "LIMITED"] as const)
    .map((r) => ({ r, n: memberships.filter((m) => m.role === r).length }))
    .filter((c) => c.n > 0)
    .map((c) => `${c.n} ${ROLE_LABELS[c.r]}${c.n > 1 ? "s" : ""}`);

  return (
    <div className="space-y-6">
      <SubNav projectId={params.projectId} options={subNavOptions} />
      <div>
        <h2 className="text-base font-semibold text-slate-900">Who can open this project</h2>
        <p className="text-sm text-slate-500">
          Portal accounts given access to this project, and which areas each one sees. Super Admin, Admin and Management already see every
          project and don&apos;t need to be added here.
          {memberships.length > 0 && <span className="text-slate-700"> {memberships.length} added: {counts.join(", ")}.</span>}
        </p>
      </div>

      {canEdit && (
        <PageGuide
          id="team-access"
          title="How access works"
          points={[
            <>A <strong>PM</strong> sees and edits every area except the Budget Tracker — there&apos;s nothing to set per area.</>,
            <>A <strong>Client</strong> or <strong>Guest</strong> is set per area: <strong>No Access</strong> hides it, <strong>Read Limited</strong> shows it without sensitive detail (rates and costs, internal notes), <strong>Read Full</strong> shows everything read-only, <strong>Write</strong> allows editing.</>,
            <>A new Client starts locked down; a new Guest starts at Read Limited everywhere. Use a preset to set every area at once, then adjust single areas.</>,
          ]}
        />
      )}

      {canEdit && <AddMemberForm projectId={params.projectId} />}

      {memberships.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <IconUsers className="mx-auto h-8 w-8 text-slate-300 mb-2" />
          <p className="text-sm text-slate-400">No one has been assigned to this project yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {memberships.map((m) => (
            <MemberCard
              key={m.id}
              projectId={params.projectId}
              canEdit={canEdit}
              membership={{
                id: m.id,
                role: m.role,
                userName: m.user.name,
                userEmail: m.user.email,
                permissions: m.permissions.map((p) => ({ module: p.module, access: p.access })),
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
