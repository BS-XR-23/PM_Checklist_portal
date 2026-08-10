// Shared card primitives replacing the old dense `<table>` rows across the
// data-entry modules (Checklist, Risk Register, CR Log, Milestones). Every
// editable field inside still goes through components/ui/inline-edit.tsx —
// this is layout only, no behavior change.
export function DataCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`group rounded-xl border border-slate-200 bg-white p-4 space-y-3 hover:border-slate-300 transition-colors ${className}`}>
      {children}
    </div>
  );
}

export function CardFieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{children}</div>;
}

export function CardField({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{label}</p>
      <div className="text-sm text-slate-700">{children}</div>
    </div>
  );
}

export function CardIconButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-slate-300 hover:text-red-600 disabled:opacity-50 shrink-0"
    >
      {children}
    </button>
  );
}
