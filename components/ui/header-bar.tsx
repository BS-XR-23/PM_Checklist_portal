import Link from "next/link";

// Back-link/role-badge/sign-out now live in the persistent Sidebar
// (components/layout/sidebar.tsx) — this is just the project's page title.
export function HeaderBar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="border-b border-slate-200 bg-white px-4 sm:px-6 py-3">
      <Link href="/projects" prefetch={false} className="text-xs font-medium text-slate-400 hover:text-slate-600">
        ← All Projects
      </Link>
      <h1 className="text-lg font-semibold text-slate-900 leading-tight">{title}</h1>
      {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
    </header>
  );
}
