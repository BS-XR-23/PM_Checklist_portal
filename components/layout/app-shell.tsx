import { Sidebar } from "./sidebar";
import type { Role } from "@prisma/client";

export function AppShell({ user, children }: { user: { name: string; role: Role }; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar user={user} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
