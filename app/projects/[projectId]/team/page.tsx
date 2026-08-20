import { prisma } from "@/lib/prisma";
import { requireUser, requireProjectAccess } from "@/lib/rbac";
import { canViewResourcing } from "@/lib/resourcing-rbac";
import { SubNav } from "@/components/ui/sub-nav";
import { StatTile } from "@/components/ui/stat-tile";
import { IconUsers, IconBadge, IconUserCheck, IconIdCard } from "@/components/layout/icons";
import { AddMemberForm } from "./add-member-form";
import { MemberRow } from "./member-row";

export default async function TeamPage({ params }: { params: { projectId: string } }) {
  const user = await requireUser();
  await requireProjectAccess(params.projectId);

  // Admin edits; TPM and the project's own PM can see who has access.
  if (user.role !== "ADMIN" && user.role !== "TPM" && user.role !== "PM") {
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatTile icon={<IconUsers />} iconWrapClass="bg-violet-50 text-violet-600" label="Total Members" value={String(memberships.length)} />
        <StatTile icon={<IconBadge />} iconWrapClass="bg-blue-50 text-blue-600" label="PM" value={String(pmCount)} />
        <StatTile icon={<IconUserCheck />} iconWrapClass="bg-emerald-50 text-emerald-600" label="Client" value={String(clientCount)} />
        <StatTile icon={<IconIdCard />} iconWrapClass="bg-amber-50 text-amber-600" label="Limited" value={String(limitedCount)} />
      </div>

      {canEdit && <AddMemberForm projectId={params.projectId} />}

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
              <th className="px-3 py-2 font-medium">User</th>
              <th className="px-3 py-2 font-medium w-28">Role</th>
              <th className="px-3 py-2 font-medium">Module Permissions</th>
              {canEdit && <th className="px-3 py-2 font-medium w-10">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {memberships.map((m) => (
              <MemberRow
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
          </tbody>
        </table>
        {memberships.length === 0 && <p className="text-sm text-slate-400 p-4">No one has been assigned to this project yet.</p>}
      </div>
    </div>
  );
}
