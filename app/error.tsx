"use client";

import { useEffect } from "react";
import Link from "next/link";

// Last-resort boundary for unexpected server/render errors — without it, a
// production user gets Next's bare default error screen with no way back.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-xl font-semibold text-slate-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-500">
          The page couldn&apos;t be loaded. Try again — if it keeps happening, send your Super Admin this reference:
          {error.digest && <code className="block mt-2 text-xs text-slate-400">{error.digest}</code>}
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800"
          >
            Try again
          </button>
          <Link href="/projects" className="rounded-md border border-slate-300 text-slate-700 text-sm font-medium px-4 py-2 hover:bg-slate-50">
            Back to Projects
          </Link>
        </div>
      </div>
    </div>
  );
}
