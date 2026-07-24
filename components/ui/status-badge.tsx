import { STATUS_COLORS } from "@/lib/colors";
import type { ItemStatus } from "@/lib/constants";

export function StatusBadge({ status }: { status: ItemStatus }) {
  const c = STATUS_COLORS[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {c.label}
    </span>
  );
}
