import Link from "next/link";
import { IconClipboardList } from "@/components/layout/icons";

// Back-link/role-badge/sign-out now live in the persistent Sidebar
// (components/layout/sidebar.tsx) — this is just the project's page title
// (plus, when the viewer can see it, a link to the Activity log — pulled out
// of the tab row since it's a log page, not a workspace someone edits in).
export function HeaderBar({ title, subtitle, activityHref }: { title: string; subtitle?: string; activityHref?: string }) {
  return (
    <header className="border-b border-slate-200 bg-white px-4 sm:px-6 py-3 flex items-start justify-between gap-3">
      <div>
        <Link href="/projects" prefetch={false} className="text-xs font-medium text-slate-400 hover:text-slate-600">
          ← All Projects
        </Link>
        <h1 className="text-lg font-semibold text-slate-900 leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {activityHref && (
        <Link
          href={activityHref}
          prefetch={false}
          title="Activity log"
          className="shrink-0 mt-0.5 inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 hover:border-slate-300"
        >
          <IconClipboardList className="w-4 h-4" width={16} height={16} />
          Activity
        </Link>
      )}
    </header>
  );
}
