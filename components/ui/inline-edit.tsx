"use client";

import { useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useAnchoredPosition } from "./use-anchored-position";

const EXPANDED_WIDTH = 360;

// A visible border at rest (not just on hover/focus) is deliberate — every
// field built on this primitive looked like static text until you happened
// to click it, which read as "not editable" rather than "editable but
// unstyled." One shared constant, so the fix applies everywhere this is
// used (checklist, risks, CRs, milestones, budget, people, users, PM plan).
// min-w-0 overrides the browser's default ~20ch intrinsic minimum on text/
// number inputs — without it, w-full can't shrink these below that content
// size, so a narrow container (e.g. the People page's 280px rate-table
// sidebar) overflows and gets clipped by its rounded-corner `overflow-hidden`
// wrapper instead of the input actually fitting the column.
const cellClass =
  "w-full min-w-0 truncate bg-transparent text-sm px-1.5 py-1 rounded border border-slate-200 hover:border-slate-300 hover:bg-slate-100 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:opacity-50";

// Hides the browser's default number-input spinner arrows — they ate
// visible width in narrow columns (e.g. Role Rates' compact sidebar table)
// without adding value over typing/arrow-key editing directly.
const numberCellClass = cellClass + " [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

/**
 * A single-line value at rest (truncated + a `title` tooltip so hovering
 * still reveals a value too long for the column), but text long enough to
 * need real editing — a checklist item's wording, a URL — is unreadable
 * and near-unwritable squeezed into that width. Clicking in opens a
 * floating multi-line textarea (via the same clipping-proof portal
 * positioning as RowActionsMenu's dropdown) sized wide enough to actually
 * work in, then collapses back to the compact cell on blur/Enter/Escape.
 * Enter commits rather than inserting a newline — this is still a
 * conceptually single-line field, just wrapped for readability while
 * expanded, not a free-text notes box (see NotesCell for that).
 */
export function InlineText({
  value,
  onSave,
  placeholder,
  className,
}: {
  value: string;
  onSave: (value: string) => Promise<void>;
  placeholder?: string;
  // Override for the compact (at-rest) input's classes — lets a call site
  // sit this inside its own styled chip (icon + colored background, e.g.
  // the Dependencies table's Category cell) instead of the default bordered
  // box, without changing that default for every other field built on this.
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const coords = useAnchoredPosition(expanded, inputRef, () => setExpanded(false), { width: EXPANDED_WIDTH, estHeight: 140 });

  const commit = () => {
    if (draft !== value) startTransition(() => onSave(draft));
  };

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        className={className ?? cellClass}
        value={draft}
        title={draft}
        placeholder={placeholder}
        disabled={pending}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setExpanded(true)}
      />
      {expanded &&
        coords &&
        createPortal(
          <>
            {/* Outside-click catcher only — the textarea's own onBlur (which
                fires first, since blur precedes click for the same
                interaction) already commits, so this doesn't call commit()
                again and risk a duplicate save. */}
            <div className="fixed inset-0 z-40" onClick={() => setExpanded(false)} />
            <textarea
              autoFocus
              className="fixed z-50 resize-none rounded-md border border-slate-300 bg-white p-2 text-sm shadow-lg focus:outline-none focus:ring-1 focus:ring-slate-400"
              style={{
                width: EXPANDED_WIDTH,
                minHeight: 72,
                left: coords.left,
                ...(coords.openUp ? { bottom: window.innerHeight - coords.top + 4 } : { top: coords.top + 4 }),
              }}
              value={draft}
              placeholder={placeholder}
              disabled={pending}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  commit();
                  setExpanded(false);
                } else if (e.key === "Escape") {
                  setDraft(value);
                  setExpanded(false);
                }
              }}
              onBlur={() => {
                commit();
                setExpanded(false);
              }}
            />
          </>,
          document.body
        )}
    </>
  );
}

// Deliberately not built on cellClass — that bakes in `truncate`
// (white-space: nowrap + ellipsis), which silently clips a risk
// description/CR note/decision rationale to one line with no way to read
// or write the rest. This wraps instead, and auto-grows to fit content via
// the ref callback below so the surrounding row just gets taller rather
// than the text disappearing off both ends.
const textareaClass =
  "w-full min-w-0 bg-transparent text-sm px-1.5 py-1 rounded border border-slate-200 hover:border-slate-300 hover:bg-slate-100 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:opacity-50 resize-none whitespace-pre-wrap";

function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

export function InlineTextarea({
  value,
  onSave,
  placeholder,
}: {
  value: string;
  onSave: (value: string) => Promise<void>;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [pending, startTransition] = useTransition();

  return (
    <textarea
      ref={autoGrow}
      className={textareaClass}
      rows={1}
      value={draft}
      placeholder={placeholder}
      disabled={pending}
      onChange={(e) => {
        setDraft(e.target.value);
        autoGrow(e.target);
      }}
      onBlur={() => {
        if (draft !== value) startTransition(() => onSave(draft));
      }}
    />
  );
}

export function InlineNumber({
  value,
  onSave,
  step = 1,
}: {
  value: number | null;
  onSave: (value: number | null) => Promise<void>;
  step?: number;
}) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const [pending, startTransition] = useTransition();

  return (
    <input
      type="number"
      step={step}
      className={numberCellClass}
      value={draft}
      disabled={pending}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const parsed = draft === "" ? null : Number(draft);
        if (parsed !== value) startTransition(() => onSave(parsed));
      }}
    />
  );
}

/** Stores/receives a 0-1 fraction, but edits as whole percentage points (10 -> 0.10). */
export function InlinePercent({
  value,
  onSave,
}: {
  value: number;
  onSave: (value: number) => Promise<void>;
}) {
  const [draft, setDraft] = useState(String(Math.round(value * 1000) / 10));
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        step={0.5}
        min={0}
        max={100}
        className={numberCellClass}
        value={draft}
        disabled={pending}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const parsedPct = draft === "" ? 0 : Number(draft);
          const parsed = parsedPct / 100;
          if (parsed !== value) startTransition(() => onSave(parsed));
        }}
      />
      <span className="text-xs text-slate-400">%</span>
    </div>
  );
}

export function InlineDate({
  value,
  onSave,
}: {
  value: string | null; // yyyy-mm-dd
  onSave: (value: string | null) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <input
      type="date"
      className={cellClass}
      defaultValue={value ?? ""}
      disabled={pending}
      onChange={(e) => startTransition(() => onSave(e.target.value || null))}
    />
  );
}

export function InlineSelect({
  value,
  options,
  onSave,
  renderOption,
  style,
  className,
}: {
  value: string;
  options: readonly string[];
  onSave: (value: string) => Promise<void>;
  renderOption?: (option: string) => string;
  style?: React.CSSProperties;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      className={className ?? cellClass}
      style={style}
      defaultValue={value}
      disabled={pending}
      onChange={(e) => startTransition(() => onSave(e.target.value))}
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {renderOption ? renderOption(opt) : opt}
        </option>
      ))}
    </select>
  );
}
