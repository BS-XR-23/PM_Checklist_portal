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
export function SubNav({
  projectId,
  options,
}: {
  projectId: string;
  options: { href: string; label: string; count?: number }[];
}) {
  const pathname = usePathname();
  if (options.length < 2) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {options.map((opt) => {
        const href = `/projects/${projectId}${opt.href}`;
        const active = pathname === href;
        return (
          <Link
            key={opt.href}
            href={href}
            prefetch={false}
            className={clsx(
              "inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors",
              active ? "border-indigo-200 bg-indigo-50/60 text-indigo-700" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800"
            )}
          >
            {opt.label}
            {opt.count != null && (
              <span
                className={clsx(
                  "inline-flex items-center justify-center min-w-[1.375rem] h-5 rounded-full px-1.5 text-xs font-semibold",
                  active ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"
                )}
              >
                {opt.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
