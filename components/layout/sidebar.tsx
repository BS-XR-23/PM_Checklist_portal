"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { SignOutLink } from "@/components/ui/sign-out-link";
import { ChangePasswordModal } from "@/components/ui/change-password-modal";
import { IconGrid, IconChart, IconUser, IconUsers, IconIdCard, IconClipboardList, IconLayers, IconBell, IconTarget } from "./icons";
import { initials } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/constants";
import type { Role } from "@prisma/client";

type NavItem = { href: string; label: string; icon: (props: React.SVGProps<SVGSVGElement>) => React.ReactElement; badge?: number };

export function Sidebar({
  user,
  reminderCount = 0,
  hasLinkedPerson = false,
}: {
  user: { name: string; role: Role };
  reminderCount?: number;
  hasLinkedPerson?: boolean;
}) {
  const pathname = usePathname();

  const primaryItems: NavItem[] = [{ href: "/projects", label: "Projects", icon: IconGrid }];
  // Internal pipeline data — the deal team (PM/Admin) plus leadership
  // (TPM/Program Manager) can see it, read-only for the latter. Same role
  // scope as app/presales/page.tsx's VIEW_ROLES.
  if (user.role === "ADMIN" || user.role === "PM" || user.role === "TPM" || user.role === "PROGRAM_MANAGER") {
    primaryItems.push({ href: "/presales", label: "Presales", icon: IconTarget });
  }
  if (user.role === "ADMIN" || user.role === "TPM" || user.role === "PROGRAM_MANAGER") {
    primaryItems.push({ href: "/portfolio", label: "Portfolio", icon: IconChart });
  }
  // Item-level reminders — same role scope as lib/notifications.ts
  // (PROGRAM_MANAGER stays aggregate-only, CLIENT/LIMITED never see it).
  if (user.role === "ADMIN" || user.role === "TPM" || user.role === "PM") {
    primaryItems.push({ href: "/notifications", label: "Reminders", icon: IconBell, badge: reminderCount });
  }
  // LIMITED always sees this (even unlinked, so the page can tell them to
  // ask an Admin) — every other role only once their account actually has
  // something to show, since the page itself has no role restriction.
  // PROGRAM_MANAGER is excluded even when linked — the page itself
  // redirects them away, so showing the link here would just bounce.
  if ((user.role === "LIMITED" || hasLinkedPerson) && user.role !== "PROGRAM_MANAGER") {
    primaryItems.push({ href: "/my-engagement", label: "My Engagement", icon: IconUser });
  }

  // ADMIN (Super Admin) sees the full toolset; TPM (Admin) and PM see Users
  // + People read-only; PROGRAM_MANAGER (Management) sees People read-only
  // only, never Users — matches the page-level guards on each route exactly.
  const adminItems: NavItem[] = [];
  if (user.role === "ADMIN" || user.role === "TPM" || user.role === "PM") {
    adminItems.push({ href: "/admin/users", label: "Users", icon: IconUsers });
  }
  if (user.role === "ADMIN" || user.role === "TPM" || user.role === "PROGRAM_MANAGER" || user.role === "PM") {
    adminItems.push({ href: "/admin/people", label: "People", icon: IconIdCard });
  }
  if (user.role === "ADMIN") {
    adminItems.push(
      { href: "/admin/checklist-template", label: "Checklist Template", icon: IconLayers },
      { href: "/admin/audit-log", label: "Audit Log", icon: IconClipboardList }
    );
  }

  return (
    <aside className="w-60 shrink-0 h-screen sticky top-0 flex flex-col border-r border-slate-200 bg-white">
      <div className="px-4 py-4 border-b border-slate-100 flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">
          XR
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 leading-tight truncate">XR PM Checklist</p>
          <p className="text-xs text-slate-400">Portal</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        <NavGroup items={primaryItems} pathname={pathname} />
        {adminItems.length > 0 && (
          <div>
            <p className="px-2 mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {user.role === "ADMIN" ? "Admin" : "Directory"}
            </p>
            <NavGroup items={adminItems} pathname={pathname} />
          </div>
        )}
      </nav>

      <div className="border-t border-slate-100 px-3 py-3">
        <div className="flex items-center gap-2.5 mb-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
            {initials(user.name)}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{user.name}</p>
            <p className="text-xs text-slate-400">{ROLE_LABELS[user.role]}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 pl-0.5">
          <ChangePasswordModal />
          <SignOutLink />
        </div>
      </div>
    </aside>
  );
}

function NavGroup({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              prefetch={false}
              className={clsx(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Icon className="w-4.5 h-4.5 shrink-0" width={18} height={18} />
              <span className="flex-1">{item.label}</span>
              {!!item.badge && (
                <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 rounded-full bg-red-500 text-white text-[11px] font-semibold px-1">
                  {item.badge}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
