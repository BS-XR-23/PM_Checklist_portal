"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { SignOutLink } from "@/components/ui/sign-out-link";
import { ChangePasswordModal } from "@/components/ui/change-password-modal";
import { IconGrid, IconChart, IconUser, IconUsers, IconIdCard, IconClipboardList, IconLayers, IconBell } from "./icons";
import type { Role } from "@prisma/client";

type NavItem = { href: string; label: string; icon: (props: React.SVGProps<SVGSVGElement>) => React.ReactElement; badge?: number };

export function Sidebar({ user, reminderCount = 0 }: { user: { name: string; role: Role }; reminderCount?: number }) {
  const pathname = usePathname();

  const primaryItems: NavItem[] = [{ href: "/projects", label: "Projects", icon: IconGrid }];
  if (user.role === "ADMIN" || user.role === "TPM" || user.role === "PROGRAM_MANAGER") {
    primaryItems.push({ href: "/portfolio", label: "Portfolio", icon: IconChart });
  }
  // Item-level reminders — same role scope as lib/notifications.ts
  // (PROGRAM_MANAGER stays aggregate-only, CLIENT/LIMITED never see it).
  if (user.role === "ADMIN" || user.role === "TPM" || user.role === "PM") {
    primaryItems.push({ href: "/notifications", label: "Reminders", icon: IconBell, badge: reminderCount });
  }
  if (user.role === "LIMITED") {
    primaryItems.push({ href: "/my-engagement", label: "My Engagement", icon: IconUser });
  }

  const adminItems: NavItem[] =
    user.role === "ADMIN"
      ? [
          { href: "/admin/users", label: "Users", icon: IconUsers },
          { href: "/admin/people", label: "People", icon: IconIdCard },
          { href: "/admin/checklist-template", label: "Checklist Template", icon: IconLayers },
          { href: "/admin/audit-log", label: "Audit Log", icon: IconClipboardList },
        ]
      : [];

  return (
    <aside className="w-60 shrink-0 h-screen sticky top-0 flex flex-col border-r border-slate-200 bg-white">
      <div className="px-4 py-4 border-b border-slate-100">
        <p className="text-sm font-semibold text-slate-900 leading-tight">XR PM Checklist</p>
        <p className="text-xs text-slate-400">Portal</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        <NavGroup items={primaryItems} pathname={pathname} />
        {adminItems.length > 0 && (
          <div>
            <p className="px-2 mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Admin</p>
            <NavGroup items={adminItems} pathname={pathname} />
          </div>
        )}
      </nav>

      <div className="border-t border-slate-100 px-3 py-3">
        <p className="text-sm font-medium text-slate-800 truncate">{user.name}</p>
        <p className="text-xs text-slate-400 mb-2">{user.role.replace("_", " ")}</p>
        <div className="flex items-center gap-3">
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
