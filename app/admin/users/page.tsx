import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { AppShell } from "@/components/layout/app-shell";
import { CreateUserForm } from "./create-user-form";
import { UserRoleSelect } from "./user-role-select";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const currentUser = await requireUser();
  if (currentUser.role !== "ADMIN") redirect("/projects");

  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <AppShell user={currentUser}>
      <header className="border-b border-slate-200 bg-white px-4 sm:px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Users</h1>
      </header>
      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        <CreateUserForm />

        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium w-40">Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-3 py-2 text-slate-800">{u.name}</td>
                  <td className="px-3 py-2 text-slate-600">{u.email}</td>
                  <td className="px-3 py-2">
                    <UserRoleSelect userId={u.id} currentRole={u.role} disabled={u.id === currentUser.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400">
          Assigning a user to a specific project (PM / CLIENT / LIMITED) happens on that project&apos;s Team tab, not
          here — role here is the global role only.
        </p>
      </main>
    </AppShell>
  );
}
