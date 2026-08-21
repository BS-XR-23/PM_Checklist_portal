import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { ROLE_LABELS } from "@/lib/constants";
import { AppShell } from "@/components/layout/app-shell";
import { IconShield, IconIdCard, IconChart, IconUsers, IconUser, IconLayers, IconClock, IconAlertCircle } from "@/components/layout/icons";
import { UsersPageClient } from "./users-page-client";
import type { RoleGroupData } from "./users-directory";

export const dynamic = "force-dynamic";

// One group per role now (TPM/Admin and PROGRAM_MANAGER/Management used to
// share a "Program Management" bucket, but they're meaningfully different
// roles now — TPM gets read-only Users/People access and full delivery
// read, Management gets project drill-down but no Users access at all —
// so a shared section would misrepresent both). Each group's label comes
// straight from ROLE_LABELS so it can never drift out of sync with how the
// role is named everywhere else.
const ROLE_GROUPS: Omit<RoleGroupData, "users">[] = [
  {
    key: "super-admin",
    label: ROLE_LABELS.ADMIN,
    description: "Full system access and configuration.",
    icon: <IconShield />,
    iconWrapClass: "bg-blue-50 text-blue-600",
    avatarClass: "bg-blue-600",
  },
  {
    key: "admin",
    label: ROLE_LABELS.TPM,
    description: "Read-only across every project's delivery modules; writes only Escalations and audited Overrides.",
    icon: <IconIdCard />,
    iconWrapClass: "bg-violet-50 text-violet-600",
    avatarClass: "bg-violet-600",
  },
  {
    key: "management",
    label: ROLE_LABELS.PROGRAM_MANAGER,
    description: "Read-only drill-down into every project (excluding Decisions/Action Items); no Users access.",
    icon: <IconChart />,
    iconWrapClass: "bg-cyan-50 text-cyan-600",
    avatarClass: "bg-cyan-600",
  },
  {
    key: "pm",
    label: ROLE_LABELS.PM,
    description: "Can manage assigned projects and team.",
    icon: <IconUsers />,
    iconWrapClass: "bg-emerald-50 text-emerald-600",
    avatarClass: "bg-emerald-600",
  },
  {
    key: "client",
    label: ROLE_LABELS.CLIENT,
    description: "Limited access to assigned projects.",
    icon: <IconUser />,
    iconWrapClass: "bg-amber-50 text-amber-600",
    avatarClass: "bg-amber-600",
  },
  {
    key: "guest",
    label: ROLE_LABELS.LIMITED,
    description: "Read-limited by default on assigned projects until narrowed further.",
    icon: <IconLayers />,
    iconWrapClass: "bg-indigo-50 text-indigo-600",
    avatarClass: "bg-indigo-600",
  },
];

const ROLES_BY_GROUP_KEY: Record<string, Role[]> = {
  "super-admin": ["ADMIN"],
  admin: ["TPM"],
  management: ["PROGRAM_MANAGER"],
  pm: ["PM"],
  client: ["CLIENT"],
  guest: ["LIMITED"],
};

function OverviewRow({ icon, iconWrapClass, label, value }: { icon: React.ReactNode; iconWrapClass: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconWrapClass}`}>
        <span className="h-4 w-4 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      </span>
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-lg font-bold text-slate-900 leading-tight">{value}</div>
      </div>
    </div>
  );
}

export default async function AdminUsersPage() {
  const currentUser = await requireUser();
  // Super Admin edits; Admin (TPM) and PM see the same directory read-only —
  // Management (PROGRAM_MANAGER) and everyone else still has no access here.
  if (currentUser.role !== "ADMIN" && currentUser.role !== "TPM" && currentUser.role !== "PM") redirect("/projects");
  const canEdit = currentUser.role === "ADMIN";

  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" }, include: { person: true } });

  const groups: RoleGroupData[] = ROLE_GROUPS.map((g) => ({
    ...g,
    users: users
      .filter((u) => ROLES_BY_GROUP_KEY[g.key].includes(u.role))
      .map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, isActive: u.isActive, personName: u.person?.name ?? null })),
  }));

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.isActive).length;
  const inactiveUsers = totalUsers - activeUsers;
  const unlinkedUsers = users.filter((u) => !u.person).length;

  const sidebar = (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">User Overview</h3>
        <OverviewRow icon={<IconUsers />} iconWrapClass="bg-blue-50 text-blue-600" label="Total Users" value={totalUsers} />
        <OverviewRow icon={<IconUser />} iconWrapClass="bg-emerald-50 text-emerald-600" label="Active Users" value={activeUsers} />
        <OverviewRow icon={<IconClock />} iconWrapClass="bg-slate-100 text-slate-500" label="Inactive Users" value={inactiveUsers} />
        <OverviewRow icon={<IconAlertCircle />} iconWrapClass="bg-amber-50 text-amber-600" label="Not Linked to a Person" value={unlinkedUsers} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Role Guide</h3>
        {ROLE_GROUPS.map((g) => (
          <div key={g.key} className="flex items-start gap-2.5">
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${g.iconWrapClass}`}>
              <span className="h-3.5 w-3.5 [&>svg]:h-3.5 [&>svg]:w-3.5">{g.icon}</span>
            </span>
            <div>
              <div className="text-xs font-semibold text-slate-800">{g.label}</div>
              <div className="text-xs text-slate-500">{g.description}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <AppShell user={currentUser}>
      <UsersPageClient groups={groups} currentUserId={currentUser.id} sidebar={sidebar} canEdit={canEdit} />
    </AppShell>
  );
}
