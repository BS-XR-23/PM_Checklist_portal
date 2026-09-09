"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { IconRefresh } from "@/components/layout/icons";

export function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [spun, setSpun] = useState(false);

  function onClick() {
    setSpun(true);
    startTransition(() => router.refresh());
    setTimeout(() => setSpun(false), 500);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
    >
      <IconRefresh className={`h-4 w-4 ${spun || isPending ? "animate-spin" : ""}`} />
      Refresh
    </button>
  );
}
