"use client";

import { useState, useTransition } from "react";
import { InlineText, InlineSelect } from "@/components/ui/inline-edit";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { avatarColorFromString } from "@/lib/colors";
import { initials } from "@/lib/format";
import { updatePerson, deletePerson } from "./people-actions";

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
  engagements: { projectName: string; roleOnProject: string }[];
  /** Likely portal account for an unlinked person — Super Admin only. */
  suggestion: { userId: string; label: string; by: "email" | "name" } | null;
  deleteImpact: { sprintAllocations: number; engagements: number; ownedItems: number };
};

function PlainText({ value }: { value: string | null }) {
  return value ? <span className="text-slate-700">{value}</span> : <span className="text-slate-300">—</span>;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function deleteConfirmMessage(p: PersonRowData): string {
  const lines = [`Delete ${p.name} from the People registry? This can't be undone.`];
  if (p.deleteImpact.engagements) lines.push(`• Their ${plural(p.deleteImpact.engagements, "project engagement")} will be removed.`);
  if (p.deleteImpact.ownedItems) lines.push(`• ${plural(p.deleteImpact.ownedItems, "item")} they own (checklist, risk, action, task, milestone) will have no owner.`);
  return lines.join("\n");
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
  const [editing, setEditing] = useState(false);
  const [linkPending, startLink] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const linkedUser = person.linkedUserId ? person.linkableUsers.find((u) => u.id === person.linkedUserId) : undefined;
  const roleRateName = person.roleRateId ? roleRates.find((r) => r.id === person.roleRateId)?.roleName : undefined;
  const competencyLevel = person.competencyId ? competencies.find((c) => c.id === person.competencyId)?.level : undefined;
  // Sprint hours are cost history — the server refuses to delete a person who
  // has any, so don't offer it.
  const canDelete = person.deleteImpact.sprintAllocations === 0;

  return (
    <tr className="border-b border-slate-50 last:border-0 align-top">
      <td className="px-4 py-3.5">
        <div className="flex items-start gap-2.5">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: avatarColorFromString(person.name) }}
          >
            {initials(person.name)}
          </span>
          <div className="min-w-0 flex-1 space-y-0.5">
            {editing ? (
              <>
                <InlineText value={person.name} onSave={(v) => updatePerson(person.id, { name: v })} />
                <InlineText value={person.title ?? ""} onSave={(v) => updatePerson(person.id, { title: v })} placeholder="Title" />
              </>
            ) : (
              <>
                <p className="font-medium text-slate-800">{person.name}</p>
                {person.title && <p className="text-xs text-slate-500">{person.title}</p>}
              </>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5">
        {editing ? (
          <div className="space-y-1">
            <InlineText value={person.email ?? ""} onSave={(v) => updatePerson(person.id, { email: v })} placeholder="Email" />
            <InlineText value={person.phone ?? ""} onSave={(v) => updatePerson(person.id, { phone: v })} placeholder="Phone" />
          </div>
        ) : (
          <div className="space-y-0.5">
            <p className="break-all">
              <PlainText value={person.email} />
            </p>
            {person.phone && <p className="text-xs text-slate-500">{person.phone}</p>}
          </div>
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
          <div className="space-y-1">
            <span
              className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
              title="No linked portal account — this person can't see their own My Engagement page."
            >
              Not linked
            </span>
            {canEdit && person.suggestion && (
              <button
                type="button"
                disabled={linkPending}
                title={`Same ${person.suggestion.by} as the portal account ${person.suggestion.label}`}
                onClick={() =>
                  startLink(async () => {
                    setError(null);
                    try {
                      await updatePerson(person.id, { userId: person.suggestion!.userId });
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Couldn't link the account.");
                    }
                  })
                }
                className="block text-left text-[11px] font-medium text-blue-600 hover:underline disabled:opacity-50"
              >
                {linkPending ? "Linking…" : `Link to ${person.suggestion.label.split(" (")[0]}?`}
              </button>
            )}
          </div>
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
      <td className="px-4 py-3.5 max-w-[16rem]">
        {person.engagements.length > 0 ? (
          <div className="flex flex-col items-start gap-1">
            {person.engagements.map((e, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 max-w-full truncate"
                title={`${e.projectName} — ${e.roleOnProject}`}
              >
                {e.projectName} — {e.roleOnProject}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-slate-400">No current engagement</span>
        )}
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </td>
      {canEdit && (
        <td className="px-4 py-3.5">
          <RowActionsMenu
            actions={[
              { label: editing ? "Done editing" : "Edit", onClick: async () => setEditing((v) => !v) },
              ...(canDelete
                ? [
                    {
                      label: "Delete",
                      pendingLabel: "Deleting…",
                      danger: true,
                      confirmMessage: deleteConfirmMessage(person),
                      onClick: async () => {
                        setError(null);
                        try {
                          await deletePerson(person.id);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Couldn't delete.");
                        }
                      },
                    },
                  ]
                : []),
            ]}
          />
        </td>
      )}
    </tr>
  );
}
