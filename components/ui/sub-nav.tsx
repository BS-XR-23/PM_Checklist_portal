"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

/**
 * Two-way segmented control for pages that used to be separate top-level
 * tabs (PM/DevOps Checklist, Team/Resourcing, Risk Register/CR Log). Renders
 * nothing if fewer than 2 options are passed — the caller only includes an
 * option the viewer actually has access to, so a single-option case means
 * there's nothing to toggle to.
 */
export function SubNav({ projectId, options }: { projectId: string; options: { href: string; label: string }[] }) {
  const pathname = usePathname();
  if (options.length < 2) return null;

  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-1 mb-4">
      {options.map((opt) => {
        const href = `/projects/${projectId}${opt.href}`;
        const active = pathname === href;
        return (
          <Link
            key={opt.href}
            href={href}
            prefetch={false}
            className={clsx(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
            )}
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}
