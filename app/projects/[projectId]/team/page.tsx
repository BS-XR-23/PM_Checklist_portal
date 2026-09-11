import { prisma } from "@/lib/prisma";
import { requireUser, requireProjectAccess } from "@/lib/rbac";
import { canViewResourcing } from "@/lib/resourcing-rbac";
import { SubNav } from "@/components/ui/sub-nav";
import { PageGuide } from "@/components/ui/page-guide";
import { StatTile } from "@/components/ui/stat-tile";
import { IconUsers, IconBadge, IconUserCheck, IconIdCard } from "@/components/layout/icons";
import { AddMemberForm } from "./add-member-form";
import { MemberCard } from "./member-card";

export default async function TeamPage({ params }: { params: { projectId: string } }) {
  const user = await requireUser();
  await requireProjectAccess(params.projectId);

  // Admin edits; TPM, Program Manager, and the project's own PM can see who has access.
  if (user.role !== "ADMIN" && user.role !== "TPM" && user.role !== "PROGRAM_MANAGER" && user.role !== "PM") {
    throw new Error("Not authorized to view the project team.");
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

  const pmCount = memberships.filter((m) => m.role === "PM").length;
  const clientCount = memberships.filter((m) => m.role === "CLIENT").length;
  const limitedCount = memberships.filter((m) => m.role === "LIMITED").length;

  return (
    <div className="space-y-6">
      <SubNav projectId={params.projectId} options={subNavOptions} />
      <div>
        <h2 className="text-base font-semibold text-slate-900">Team Access</h2>
        <p className="text-sm text-slate-500">
          Everyone explicitly assigned to this project, and what they can see. Admin and TPM always have full
          portfolio-wide access and don&apos;t need a row here.
        </p>
      </div>

      <PageGuide
        id="team-access"
        title="What the four access levels actually mean"
        points={[
          <>A member with the <strong>PM</strong> role always gets full read/write on every module — it&apos;s granted by role, not adjustable per module, so their card won&apos;t show a grid.</>,
          <><strong>NONE</strong> hides that module&apos;s tab entirely. <strong>READ_LIMITED</strong> shows the tab but strips sensitive detail (rates and costs on Budget, notes on Checklist and Milestones, and similar per module). <strong>READ_FULL</strong> shows everything, read-only. <strong>WRITE</strong> allows editing.</>,
          <>&quot;Quick preset&quot; sets every module at once to a sensible bundle for that access tier — you can still fine-tune individual modules afterward.</>,
        ]}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatTile
          icon={<IconUsers />}
          iconWrapClass="bg-violet-50 text-violet-600"
          label="Total Members"
          value={String(memberships.length)}
          accentColor="#6D28D9"
        />
        <StatTile icon={<IconBadge />} iconWrapClass="bg-emerald-50 text-emerald-600" label="PM" value={String(pmCount)} accentColor="#065F46" />
        <StatTile
          icon={<IconUserCheck />}
          iconWrapClass="bg-amber-50 text-amber-600"
          label="Client"
          value={String(clientCount)}
          accentColor="#92400E"
        />
        <StatTile
          icon={<IconIdCard />}
          iconWrapClass="bg-indigo-50 text-indigo-600"
          label="Limited"
          value={String(limitedCount)}
          accentColor="#4338CA"
        />
      </div>

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
