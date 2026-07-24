import Link from "next/link";
import { SignOutLink } from "@/components/ui/sign-out-link";

export function AdminHeader({ title, active }: { title: string; active: "users" | "audit-log" }) {
  return (
    <header className="border-b border-slate-200 bg-white px-4 sm:px-6 py-4 flex items-start justify-between">
      <div>
        <Link href="/projects" className="text-xs font-medium text-slate-400 hover:text-slate-600">
          ← All Projects
        </Link>
        <h1 className="text-lg font-semibold text-slate-900 leading-tight">{title}</h1>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <Link href="/admin/users" className={`text-sm font-medium ${active === "users" ? "text-slate-900" : "text-slate-500 hover:text-slate-800"}`}>
          Users
        </Link>
        <Link href="/admin/audit-log" className={`text-sm font-medium ${active === "audit-log" ? "text-slate-900" : "text-slate-500 hover:text-slate-800"}`}>
          Audit Log
        </Link>
        <SignOutLink />
      </div>
    </header>
  );
}
