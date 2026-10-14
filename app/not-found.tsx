import Link from "next/link";

// Every RBAC denial 404s rather than revealing that a project/page exists
// (see lib/rbac.ts), so this page has to read as "not found or no access"
// — never imply which one it was.
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm text-center">
        <p className="text-sm font-semibold text-slate-400">404</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Page not found</h1>
        <p className="mt-2 text-sm text-slate-500">
          This page doesn&apos;t exist, or your account doesn&apos;t have access to it. If you think you should, ask
          your Super Admin.
        </p>
        <Link
          href="/projects"
          className="mt-6 inline-block rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800"
        >
          Back to Projects
        </Link>
      </div>
    </div>
  );
}
