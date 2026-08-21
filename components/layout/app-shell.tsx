import { Sidebar } from "./sidebar";
import { getReminderCount } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/rbac";

export async function AppShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  // getReminderCount already returns 0 for roles outside ADMIN/TPM/PM
  // without querying, so no extra role check needed here. The Person lookup
  // just decides whether "My Engagement" is worth showing in the sidebar for
  // this user — the page itself has no role restriction at all.
  const [reminderCount, person] = await Promise.all([
    getReminderCount(user),
    prisma.person.findUnique({ where: { userId: user.id }, select: { id: true } }),
  ]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar user={user} reminderCount={reminderCount} hasLinkedPerson={!!person} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
