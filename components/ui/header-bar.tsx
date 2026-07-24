"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export function HeaderBar({ title, subtitle }: { title: string; subtitle?: string }) {
  const { data: session } = useSession();

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 py-3">
      <div>
        <Link href="/projects" className="text-xs font-medium text-slate-400 hover:text-slate-600">
          ← All Projects
        </Link>
        <h1 className="text-lg font-semibold text-slate-900 leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {session?.user?.name && <span className="text-sm text-slate-500 hidden sm:inline">{session.user.name}</span>}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
