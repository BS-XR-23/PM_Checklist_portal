"use client";

import { useState, useTransition } from "react";
import { INTENSITY_PRESETS } from "@/lib/constants";
import { assignEngagement } from "./resourcing-actions";

export function AssignEngagementForm({
  projectId,
  people,
}: {
  projectId: string;
  people: { id: string; name: string; title: string | null }[];
}) {
  const [personId, setPersonId] = useState(people[0]?.id ?? "");
  const [roleOnProject, setRoleOnProject] = useState(people[0]?.title ?? "");
  const [intensityPct, setIntensityPct] = useState(50);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (people.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        No people in the registry yet — an Admin adds them at Admin &gt; People before you can assign them here.
      </p>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            await assignEngagement(projectId, {
              personId,
              roleOnProject,
              intensityPct,
              startDate: startDate || null,
              endDate: endDate || null,
            });
            setIntensityPct(50);
            setStartDate("");
            setEndDate("");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to assign engagement.");
          }
        });
      }}
      className="rounded-lg border border-slate-200 bg-white p-4 flex flex-wrap items-end gap-3"
    >
      <div className="min-w-[180px]">
        <label className="block text-xs font-medium text-slate-600 mb-1">Person</label>
        <select
          value={personId}
          onChange={(e) => {
            setPersonId(e.target.value);
            const person = people.find((p) => p.id === e.target.value);
            if (person?.title) setRoleOnProject(person.title);
          }}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1 min-w-[160px]">
        <label className="block text-xs font-medium text-slate-600 mb-1">Role on this project</label>
        <input
          required
          value={roleOnProject}
          onChange={(e) => setRoleOnProject(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Intensity</label>
        <div className="flex items-center gap-1">
          {Object.entries(INTENSITY_PRESETS).map(([label, pct]) => (
            <button
              key={label}
              type="button"
              onClick={() => setIntensityPct(pct)}
              className={`text-xs rounded px-2 py-1.5 border ${
                intensityPct === pct ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
          <input
            type="number"
            min={0}
            max={100}
            value={intensityPct}
            onChange={(e) => setIntensityPct(Number(e.target.value))}
            className="w-16 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
          <span className="text-xs text-slate-400">%</span>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Start (optional)</label>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">End (optional)</label>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>
      <button type="submit" disabled={pending} className="rounded-md bg-slate-900 text-white text-sm font-medium px-4 py-2 hover:bg-slate-800 disabled:opacity-50">
        {pending ? "Assigning..." : "Assign"}
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}
