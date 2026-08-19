"use client";

import { useState, useTransition } from "react";

// A visible border at rest (not just on hover/focus) is deliberate — every
// field built on this primitive looked like static text until you happened
// to click it, which read as "not editable" rather than "editable but
// unstyled." One shared constant, so the fix applies everywhere this is
// used (checklist, risks, CRs, milestones, budget, people, users, PM plan).
const cellClass =
  "w-full bg-transparent text-sm px-1.5 py-1 rounded border border-slate-200 hover:border-slate-300 hover:bg-slate-100 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:opacity-50";

// Hides the browser's default number-input spinner arrows — they ate
// visible width in narrow columns (e.g. Role Rates' compact sidebar table)
// without adding value over typing/arrow-key editing directly.
const numberCellClass = cellClass + " [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

export function InlineText({
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
    <input
      type="text"
      className={cellClass}
      value={draft}
      placeholder={placeholder}
      disabled={pending}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) startTransition(() => onSave(draft));
      }}
    />
  );
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
      className={cellClass + " resize-none"}
      rows={1}
      value={draft}
      placeholder={placeholder}
      disabled={pending}
      onChange={(e) => setDraft(e.target.value)}
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
