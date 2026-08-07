"use client";

import { useTransition } from "react";
import { InlineText, InlineNumber } from "@/components/ui/inline-edit";
import { updateRoleRate, deleteRoleRate } from "./role-rate-actions";

export type RoleRateRowData = { id: string; roleName: string; manDayRate: number };

export function RoleRateRow({ roleRate }: { roleRate: RoleRateRowData }) {
  const [pending, startTransition] = useTransition();

  return (
    <tr className="border-b border-slate-50 last:border-0 align-top">
      <td className="px-4 py-3">
        <InlineText value={roleRate.roleName} onSave={(v) => updateRoleRate(roleRate.id, { roleName: v })} />
      </td>
      <td className="px-4 py-3">
        <InlineNumber value={roleRate.manDayRate} step={1} onSave={(v) => updateRoleRate(roleRate.id, { manDayRate: v ?? 0 })} />
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => startTransition(() => deleteRoleRate(roleRate.id))}
          disabled={pending}
          title="Delete role rate"
          className="text-slate-300 hover:text-red-600 disabled:opacity-50"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}
