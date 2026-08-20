import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { AppShell } from "@/components/layout/app-shell";
import { IconShield, IconIdCard, IconUsers, IconUser, IconLayers, IconClock } from "@/components/layout/icons";
import { UsersPageClient } from "./users-page-client";
import type { RoleGroupData } from "./users-directory";

export const dynamic = "force-dynamic";

// Groups roles into the same broad tiers as XR Team Management's Users page
// (Admins / Management / Team Members) — a flat 6-role table gets hard to
// scan once there are more than a handful of accounts. Each group carries
// its own icon + accent color, reused for both its section header and its
// members' avatar circles.
const ROLE_GROUPS: Omit<RoleGroupData, "users">[] = [
  {
    key: "admin",
    label: "Admin",
    description: "Full system access and configuration.",
    icon: <IconShield />,
    iconWrapClass: "bg-blue-50 text-blue-600",
    avatarClass: "bg-blue-600",
  },
  {
    key: "program-management",
    label: "Program Management",
    description: "Manage programs and related projects.",
    icon: <IconIdCard />,
    iconWrapClass: "bg-violet-50 text-violet-600",
    avatarClass: "bg-violet-600",
  },
  {
    key: "project-managers",
    label: "Project Managers",
    description: "Can manage assigned projects and team.",
    icon: <IconUsers />,
    iconWrapClass: "bg-emerald-50 text-emerald-600",
    avatarClass: "bg-emerald-600",
  },
  {
    key: "clients",
    label: "Clients",
    description: "Limited access to assigned projects.",
    icon: <IconUser />,
    iconWrapClass: "bg-amber-50 text-amber-600",
    avatarClass: "bg-amber-600",
  },
  {
    key: "limited",
    label: "Limited Access",
    description: "No project access until assigned.",
    icon: <IconLayers />,
    iconWrapClass: "bg-indigo-50 text-indigo-600",
    avatarClass: "bg-indigo-600",
  },
];

const ROLES_BY_GROUP_KEY: Record<string, Role[]> = {
  admin: ["ADMIN"],
  "program-management": ["TPM", "PROGRAM_MANAGER"],
  "project-managers": ["PM"],
  clients: ["CLIENT"],
  limited: ["LIMITED"],
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
  if (currentUser.role !== "ADMIN") redirect("/projects");

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

  const sidebar = (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">User Overview</h3>
        <OverviewRow icon={<IconUsers />} iconWrapClass="bg-blue-50 text-blue-600" label="Total Users" value={totalUsers} />
        <OverviewRow icon={<IconUser />} iconWrapClass="bg-emerald-50 text-emerald-600" label="Active Users" value={activeUsers} />
        <OverviewRow icon={<IconClock />} iconWrapClass="bg-slate-100 text-slate-500" label="Inactive Users" value={inactiveUsers} />
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
      <UsersPageClient groups={groups} currentUserId={currentUser.id} sidebar={sidebar} />
    </AppShell>
  );
}
