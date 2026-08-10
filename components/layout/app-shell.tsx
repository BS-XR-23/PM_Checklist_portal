import { Sidebar } from "./sidebar";
import { getReminderCount } from "@/lib/notifications";
import type { CurrentUser } from "@/lib/rbac";

export async function AppShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  // getReminderCount already returns 0 for roles outside ADMIN/TPM/PM
  // without querying, so no extra role check needed here.
  const reminderCount = await getReminderCount(user);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar user={user} reminderCount={reminderCount} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
