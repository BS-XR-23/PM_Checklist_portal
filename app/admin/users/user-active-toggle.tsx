// Pure display — the actual activate/deactivate action lives in the "•••"
// UserActionsMenu now, so this is just a status readout.
export function UserActiveToggle({ isActive }: { isActive: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
      <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-slate-300"}`} />
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}
