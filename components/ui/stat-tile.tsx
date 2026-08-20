export function StatTile({
  icon,
  iconWrapClass,
  label,
  value,
  subtitle,
  valueColor,
}: {
  icon: React.ReactNode;
  iconWrapClass: string;
  label: string;
  value: string;
  subtitle?: string;
  valueColor?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 flex items-start gap-2.5">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconWrapClass}`}>
        <span className="h-4 w-4 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      </span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-lg font-bold leading-tight" style={{ color: valueColor }}>
          {value}
        </p>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5 leading-tight">{subtitle}</p>}
      </div>
    </div>
  );
}
