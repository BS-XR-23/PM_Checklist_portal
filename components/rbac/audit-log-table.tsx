import { formatDate } from "@/lib/format";

export type AuditLogRow = {
  id: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  summary: string;
  isOverride: boolean;
  createdAt: Date;
  projectName?: string;
};

export function AuditLogTable({ rows, showProject = false }: { rows: AuditLogRow[]; showProject?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
            <th className="px-3 py-2 font-medium w-40">When</th>
            <th className="px-3 py-2 font-medium w-48">Actor</th>
            {showProject && <th className="px-3 py-2 font-medium w-40">Project</th>}
            <th className="px-3 py-2 font-medium w-28">Action</th>
            <th className="px-3 py-2 font-medium">Summary</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-50 last:border-0 align-top">
              <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{formatDate(r.createdAt)}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                <span className="text-slate-800">{r.actorName}</span>{" "}
                <span className="text-xs text-slate-400">({r.actorRole.replace("_", " ")})</span>
              </td>
              {showProject && <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.projectName ?? "—"}</td>}
              <td className="px-3 py-2 text-slate-600">{r.action}</td>
              <td className="px-3 py-2 text-slate-700">
                {r.isOverride && (
                  <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-medium mr-2">
                    TPM Override
                  </span>
                )}
                {r.summary}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="text-sm text-slate-400 p-4">No activity recorded yet.</p>}
    </div>
  );
}
