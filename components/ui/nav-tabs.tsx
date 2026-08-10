"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export function NavTabs({
  projectId,
  tabs,
}: {
  projectId: string;
  // matchHrefs: extra paths that also count as "active" for a merged tab
  // (e.g. Checklist's href is /pm-checklist but /devops-checklist should
  // still highlight it).
  tabs: { href: string; label: string; matchHrefs?: string[] }[];
}) {
  const pathname = usePathname();

  // prefetch=false: every tab is a force-dynamic, DB-backed page — with up to
  // a dozen tabs, default Link prefetching fires that many full server
  // renders concurrently and exhausts the Prisma connection pool.
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 px-4 sm:px-6">
      {tabs.map((tab) => {
        const href = `/projects/${projectId}${tab.href}`;
        const active = pathname === href || (tab.matchHrefs ?? []).some((h) => pathname === `/projects/${projectId}${h}`);
        return (
          <Link
            key={tab.href}
            href={href}
            prefetch={false}
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
