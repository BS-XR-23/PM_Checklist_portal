"use client";

import { useState, useTransition } from "react";
import { InlineText, InlineSelect } from "@/components/ui/inline-edit";
import { INTENSITY_BAND_COLORS, intensityBand, avatarColorFromString } from "@/lib/colors";
import { initials } from "@/lib/format";
import { updatePerson, deletePerson } from "./people-actions";
import { PersonActionsMenu } from "./person-actions-menu";

export type PersonRowData = {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedUserId: string | null;
  linkableUsers: { id: string; name: string; email: string }[];
  roleRateId: string | null;
  competencyId: string | null;
  engagements: { projectName: string; roleOnProject: string; intensityPct: number }[];
};

function PlainText({ value }: { value: string | null }) {
  return value ? <span className="text-slate-700">{value}</span> : <span className="text-slate-300">—</span>;
}

export function PersonRow({
  person,
  roleRates,
  competencies,
  canEdit,
}: {
  person: PersonRowData;
  roleRates: { id: string; roleName: string }[];
  competencies: { id: string; level: string }[];
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  const linkedUser = person.linkedUserId ? person.linkableUsers.find((u) => u.id === person.linkedUserId) : undefined;
  const roleRateName = person.roleRateId ? roleRates.find((r) => r.id === person.roleRateId)?.roleName : undefined;
  const competencyLevel = person.competencyId ? competencies.find((c) => c.id === person.competencyId)?.level : undefined;

  return (
    <tr className="border-b border-slate-50 last:border-0 align-top">
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: avatarColorFromString(person.name) }}
          >
            {initials(person.name)}
          </span>
          <div className="min-w-0 flex-1">
            {editing ? (
              <InlineText value={person.name} onSave={(v) => updatePerson(person.id, { name: v })} />
            ) : (
              <span className="font-medium text-slate-800">{person.name}</span>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5">
        {editing ? (
          <InlineText value={person.title ?? ""} onSave={(v) => updatePerson(person.id, { title: v })} placeholder="Title" />
        ) : (
          <PlainText value={person.title} />
        )}
      </td>
      <td className="px-4 py-3.5">
        {editing ? (
          <InlineText value={person.email ?? ""} onSave={(v) => updatePerson(person.id, { email: v })} placeholder="Email" />
        ) : (
          <PlainText value={person.email} />
        )}
      </td>
      <td className="px-4 py-3.5">
        {editing ? (
          <InlineText value={person.phone ?? ""} onSave={(v) => updatePerson(person.id, { phone: v })} placeholder="Phone" />
        ) : (
          <PlainText value={person.phone} />
        )}
      </td>
      <td className="px-4 py-3.5">
        {editing ? (
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
        ) : linkedUser ? (
          <span className="text-slate-700">{linkedUser.name}</span>
        ) : (
          <span
            className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
            title="No linked portal account — this person can't see their own My Engagement page."
          >
            Not linked
          </span>
        )}
      </td>
      <td className="px-4 py-3.5">
        {editing ? (
          <InlineSelect
            value={person.roleRateId ?? ""}
            options={["", ...roleRates.map((r) => r.id)]}
            renderOption={(id) => {
              if (id === "") return "— None —";
              return roleRates.find((r) => r.id === id)?.roleName ?? id;
            }}
            onSave={(v) => updatePerson(person.id, { roleRateId: v || null })}
          />
        ) : roleRateName ? (
          <span className="text-slate-700">{roleRateName}</span>
        ) : (
          <span className="text-slate-300">— None —</span>
        )}
      </td>
      <td className="px-4 py-3.5">
        {editing ? (
          <InlineSelect
            value={person.competencyId ?? ""}
            options={["", ...competencies.map((c) => c.id)]}
            renderOption={(id) => {
              if (id === "") return "— None —";
              return competencies.find((c) => c.id === id)?.level ?? id;
            }}
            onSave={(v) => updatePerson(person.id, { competencyId: v || null })}
          />
        ) : competencyLevel ? (
          <span className="text-slate-700">{competencyLevel}</span>
        ) : (
          <span className="text-slate-300">— None —</span>
        )}
      </td>
      <td className="px-4 py-3.5 max-w-[18rem]">
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
          <span className="text-slate-400">No current engagement</span>
        )}
      </td>
      {canEdit && (
        <td className="px-4 py-3.5">
          <PersonActionsMenu
            editing={editing}
            onToggleEdit={() => setEditing((v) => !v)}
            onDelete={() => startTransition(() => deletePerson(person.id))}
            deletePending={pending}
          />
        </td>
      )}
    </tr>
  );
}
