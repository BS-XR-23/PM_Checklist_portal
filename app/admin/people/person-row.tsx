"use client";

import { useTransition } from "react";
import { InlineText, InlineSelect } from "@/components/ui/inline-edit";
import { INTENSITY_BAND_COLORS, intensityBand } from "@/lib/colors";
import { updatePerson, deletePerson } from "./people-actions";

export type PersonRowData = {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedUserId: string | null;
  linkableUsers: { id: string; name: string; email: string }[];
  engagements: { projectName: string; roleOnProject: string; intensityPct: number }[];
};

export function PersonRow({ person }: { person: PersonRowData }) {
  const [pending, startTransition] = useTransition();

  return (
    <tr className="border-b border-slate-50 last:border-0 align-top">
      <td className="px-4 py-3">
        <InlineText value={person.name} onSave={(v) => updatePerson(person.id, { name: v })} />
      </td>
      <td className="px-4 py-3">
        <InlineText value={person.title ?? ""} onSave={(v) => updatePerson(person.id, { title: v })} placeholder="Title" />
      </td>
      <td className="px-4 py-3">
        <InlineText value={person.email ?? ""} onSave={(v) => updatePerson(person.id, { email: v })} placeholder="Email" />
      </td>
      <td className="px-4 py-3">
        <InlineText value={person.phone ?? ""} onSave={(v) => updatePerson(person.id, { phone: v })} placeholder="Phone" />
      </td>
      <td className="px-4 py-3">
        <InlineSelect
          value={person.linkedUserId ?? ""}
          options={["", ...person.linkableUsers.map((u) => u.id)]}
          renderOption={(id) => {
            if (id === "") return "— None —";
            const u = person.linkableUsers.find((u) => u.id === id);
            return u ? `${u.name} (${u.email})` : id;
          }}
          onSave={(v) => updatePerson(person.id, { userId: v || null })}
        />
      </td>
      <td className="px-4 py-3 max-w-[18rem]">
        {person.engagements.length > 0 ? (
          <div className="flex flex-col items-start gap-1">
            {person.engagements.map((e, i) => {
              const color = INTENSITY_BAND_COLORS[intensityBand(e.intensityPct)];
              return (
                <span
                  key={i}
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium max-w-full truncate"
                  style={{ backgroundColor: color.bg, color: color.text }}
                  title={`${e.projectName} — ${e.roleOnProject} (${e.intensityPct}%)`}
                >
                  {e.projectName} — {e.roleOnProject} ({e.intensityPct}%)
                </span>
              );
            })}
          </div>
        ) : (
          <span className="text-slate-400">No current engagements</span>
        )}
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => startTransition(() => deletePerson(person.id))}
          disabled={pending}
          title="Delete person"
          className="text-slate-300 hover:text-red-600 disabled:opacity-50"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}
