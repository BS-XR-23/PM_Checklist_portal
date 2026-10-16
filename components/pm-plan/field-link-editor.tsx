"use client";

import { useState, useTransition } from "react";
import { IconExternalLink } from "@/components/layout/icons";
import { safeHref } from "@/lib/checklist";

/** Read-only reference-link chip for a field's view mode — renders nothing when there's no link, so an unused field stays uncluttered. */
export function FieldLinkView({ url }: { url: string | null | undefined }) {
  // Only http(s) — a stored javascript: link must never become a live href.
  const href = safeHref(url ?? null);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
    >
      <IconExternalLink className="h-3 w-3" /> Reference link
    </a>
  );
}

/** Editable reference-link affordance for a field's edit mode — a ghost "+ Add link" when empty, a chip with Edit/Remove once set. */
export function FieldLinkEditor({ url, onSave }: { url: string | null | undefined; onSave: (url: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(url ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed !== (url ?? ""))
      startTransition(async () => {
        setError(null);
        try {
          await onSave(trimmed);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Couldn't save the link.");
        }
      });
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        type="url"
        autoFocus
        value={draft}
        disabled={pending}
        placeholder="https://…"
        className="mt-1 w-full max-w-sm rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:opacity-50"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            setDraft(url ?? "");
            setEditing(false);
          }
        }}
        onBlur={commit}
      />
    );
  }

  const href = safeHref(url ?? null);
  if (url) {
    return (
      <div className="mt-1 flex items-center gap-2">
        <a href={href ?? undefined} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline">
          <IconExternalLink className="h-3 w-3" /> Reference link
        </a>
        <button type="button" onClick={() => setEditing(true)} className="text-xs text-slate-400 hover:text-slate-600">
          Edit
        </button>
        <button type="button" onClick={() => startTransition(() => onSave(""))} className="text-xs text-slate-400 hover:text-rose-600">
          Remove
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <p className="mt-1 text-xs text-rose-600">
        {error}{" "}
        <button type="button" onClick={() => setEditing(true)} className="font-medium underline">
          Edit link
        </button>
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="mt-1 inline-flex items-center gap-1 rounded border border-dashed border-slate-300 px-2 py-0.5 text-xs text-slate-400 hover:border-slate-400 hover:text-slate-600"
    >
      <IconExternalLink className="h-3 w-3" /> Add link
    </button>
  );
}
