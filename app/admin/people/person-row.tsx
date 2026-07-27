"use client";

import { useTransition } from "react";
import { InlineText } from "@/components/ui/inline-edit";
import { updatePerson, deletePerson } from "./people-actions";

export type PersonRowData = {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedUserLabel: string | null;
  engagementSummary: string;
};

export function PersonRow({ person }: { person: PersonRowData }) {
  const [pending, startTransition] = useTransition();

  return (
    <tr className="border-b border-slate-50 last:border-0 align-top">
      <td className="px-3 py-2">
        <InlineText value={person.name} onSave={(v) => updatePerson(person.id, { name: v })} />
      </td>
      <td className="px-3 py-2">
        <InlineText value={person.title ?? ""} onSave={(v) => updatePerson(person.id, { title: v })} placeholder="Title" />
      </td>
      <td className="px-3 py-2">
        <InlineText value={person.email ?? ""} onSave={(v) => updatePerson(person.id, { email: v })} placeholder="Email" />
      </td>
      <td className="px-3 py-2">
        <InlineText value={person.phone ?? ""} onSave={(v) => updatePerson(person.id, { phone: v })} placeholder="Phone" />
      </td>
      <td className="px-3 py-2 text-slate-500">{person.linkedUserLabel ?? "—"}</td>
      <td className="px-3 py-2 text-slate-500">{person.engagementSummary || "No current engagements"}</td>
      <td className="px-3 py-2">
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
