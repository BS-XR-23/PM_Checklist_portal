export function StatTile({
  icon,
  iconWrapClass,
  label,
  value,
  subtitle,
  valueColor,
  nowrap,
  accentColor,
  bgClass,
}: {
  icon: React.ReactNode;
  iconWrapClass: string;
  label: React.ReactNode;
  value: string;
  subtitle?: React.ReactNode;
  valueColor?: string;
  // Keep the label on one line (ellipsis instead of wrapping) — for a row of
  // tiles with short, similar-length labels, one card wrapping to two lines
  // while its neighbors don't throws the whole row's icon/value alignment
  // off. Opt-in since a few existing longer labels (e.g. "Invoiced (Awaiting
  // Payment)") rely on wrapping instead of being truncated.
  nowrap?: boolean;
  // Optional colored left-edge stripe — a stronger, more scannable status
  // cue than tinting the value text alone (the RAG palette's text colors are
  // deliberately dark/muted for contrast on a *pale* pill background, so on
  // plain white they read as barely-there rather than "colored").
  accentColor?: string;
  // Optional card background override (e.g. "bg-blue-50/60") for pages that
  // want a bolder, tinted tile instead of the plain white default — opt-in
  // so every existing call site keeps its current look untouched.
  bgClass?: string;
}) {
  return (
    <div
      className={`h-full rounded-xl border border-slate-200 ${bgClass ?? "bg-white"} p-3.5 flex items-center gap-2.5`}
      style={accentColor ? { borderLeftColor: accentColor, borderLeftWidth: 3 } : undefined}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconWrapClass}`}>
        <span className="h-4 w-4 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-xs text-slate-500 ${nowrap ? "truncate" : ""}`}>{label}</p>
        <p className={`text-lg font-bold leading-tight ${nowrap ? "truncate" : ""}`} style={{ color: valueColor }}>
          {value}
        </p>
        {subtitle != null && <div className="text-xs text-slate-400 mt-0.5 leading-tight">{subtitle}</div>}
      </div>
    </div>
  );
}
