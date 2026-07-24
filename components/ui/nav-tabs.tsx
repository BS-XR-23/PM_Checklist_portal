"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export function NavTabs({ projectId, tabs }: { projectId: string; tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 px-4 sm:px-6">
      {tabs.map((tab) => {
        const href = `/projects/${projectId}${tab.href}`;
        const active = pathname === href;
        return (
          <Link
            key={tab.href}
            href={href}
            className={clsx(
              "whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors",
              active
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
