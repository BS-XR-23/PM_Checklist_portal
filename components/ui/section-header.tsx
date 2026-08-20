export function SectionHeader({
  icon,
  iconWrapClass,
  title,
  action,
  className = "mb-3",
}: {
  icon: React.ReactNode;
  iconWrapClass: string;
  title: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 ${className}`}>
      <div className="flex items-center gap-2.5">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconWrapClass}`}>
          <span className="h-4 w-4 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        </span>
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      </div>
      {action}
    </div>
  );
}
