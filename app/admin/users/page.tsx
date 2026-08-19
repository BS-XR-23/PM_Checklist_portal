import { redirect } from "next/navigation";
import type { Role, User, Person } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { AppShell } from "@/components/layout/app-shell";
import { CreateUserForm } from "./create-user-form";
import { UserRoleSelect } from "./user-role-select";
import { ResetPasswordButton } from "./reset-password-button";
import { UserActiveToggle } from "./user-active-toggle";
import { UserProfileField } from "./user-profile-field";

export const dynamic = "force-dynamic";

// Groups roles into the same broad tiers as XR Team Management's Users page
// (Admins / Management / Team Members) — a flat 6-role table gets hard to
// scan once there are more than a handful of accounts.
const ROLE_GROUPS: { label: string; roles: Role[] }[] = [
  { label: "Admin", roles: ["ADMIN"] },
  { label: "Program Management", roles: ["TPM", "PROGRAM_MANAGER"] },
  { label: "Project Managers", roles: ["PM"] },
  { label: "Clients", roles: ["CLIENT"] },
  { label: "Limited Access", roles: ["LIMITED"] },
];

type UserWithPerson = User & { person: Person | null };

function UsersTable({ users, currentUserId }: { users: UserWithPerson[]; currentUserId: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200 bg-slate-50">
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3 w-44">Role</th>
            <th className="px-4 py-3 w-40">Resource</th>
            <th className="px-4 py-3 w-32">Password</th>
            <th className="px-4 py-3 w-44">Status</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className={`border-b border-slate-100 last:border-0 ${u.isActive ? "" : "opacity-50"}`}>
              <td className="px-4 py-3">
                <div className="text-slate-800 font-medium">
                  <UserProfileField userId={u.id} field="name" value={u.name} />
                </div>
                <div className="text-slate-500 text-xs mt-0.5">
                  <UserProfileField userId={u.id} field="email" value={u.email} />
                </div>
              </td>
              <td className="px-4 py-3">
                <UserRoleSelect userId={u.id} currentRole={u.role} disabled={u.id === currentUserId} />
              </td>
              <td className="px-4 py-3">
                {u.person ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    {u.person.name}
                  </span>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                <ResetPasswordButton userId={u.id} />
              </td>
              <td className="px-4 py-3">
                <UserActiveToggle userId={u.id} isActive={u.isActive} disabled={u.id === currentUserId} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function AdminUsersPage() {
  const currentUser = await requireUser();
  if (currentUser.role !== "ADMIN") redirect("/projects");

  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" }, include: { person: true } });

  return (
    <AppShell user={currentUser}>
      <header className="border-b border-slate-200 bg-white px-4 sm:px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Users</h1>
      </header>
      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        <CreateUserForm />

        {ROLE_GROUPS.map((group) => {
          const groupUsers = users.filter((u) => group.roles.includes(u.role));
          if (groupUsers.length === 0) return null;
          return (
            <div key={group.label}>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{group.label}</h2>
              <UsersTable users={groupUsers} currentUserId={currentUser.id} />
            </div>
          );
        })}

        <p className="text-xs text-slate-400">
          Assigning a user to a specific project (PM / CLIENT / LIMITED) happens on that project&apos;s Team tab, not
          here — role here is the global role only.
        </p>
      </main>
    </AppShell>
  );
}
