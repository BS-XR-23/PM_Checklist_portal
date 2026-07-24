import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { computeProjectRag, RAG_COLORS } from "@/lib/rag";
import { formatMoney } from "@/lib/format";
import { SignOutLink } from "@/components/ui/sign-out-link";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const user = await requireUser();

  // Coarse, cross-project view: Admin/TPM/Program Manager only. This is
  // deliberately a dead-end summary — no links into any project's detail
  // pages, so a Program Manager never reaches item-level data through here.
  if (user.role !== "ADMIN" && user.role !== "TPM" && user.role !== "PROGRAM_MANAGER") {
    redirect("/projects");
  }

  const projects = await prisma.project.findMany({
    orderBy: { name: "asc" },
    include: { budgetEntries: { orderBy: { weekEnding: "asc" } }, risks: true },
  });

  const rows = projects.map((p) => ({
    id: p.id,
    name: p.name,
    client: p.client,
    contractValue: p.contractValue,
    ...computeProjectRag({ contractValue: p.contractValue, budgetEntries: p.budgetEntries, risks: p.risks }),
  }));

  const exceptions = rows.filter((r) => r.rag === "RED");
  const totalContractValue = rows.reduce((sum, r) => sum + r.contractValue, 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 sm:px-6 py-4 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Portfolio Summary</h1>
          <p className="text-sm text-slate-500">
            RAG status and rollup budget/schedule health across every project — no item-level detail. That lives in
            each project&apos;s own modules, which this view intentionally doesn&apos;t link into.
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {(user.role === "ADMIN" || user.role === "TPM") && (
            <a href="/projects" className="text-sm font-medium text-slate-500 hover:text-slate-800">
              Project List
            </a>
          )}
          <span className="text-xs font-medium text-slate-500 bg-slate-100 rounded-full px-2.5 py-1">{user.role.replace("_", " ")}</span>
          <SignOutLink />
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Total Projects</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{rows.length}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Total Contract Value</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{formatMoney(totalContractValue)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Exceptions (Red)</p>
            <p className="mt-1 text-2xl font-semibold" style={{ color: exceptions.length > 0 ? RAG_COLORS.RED.text : undefined }}>
              {exceptions.length}
            </p>
          </div>
        </div>

        {exceptions.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <h3 className="text-sm font-semibold text-red-800 mb-2">Exceptions — needs attention</h3>
            <ul className="text-sm text-red-800 space-y-1">
              {exceptions.map((r) => (
                <li key={r.id}>
                  <span className="font-medium">{r.name}</span>
                  {r.openHighRisks > 0 && ` — ${r.openHighRisks} open high risk${r.openHighRisks > 1 ? "s" : ""}`}
                  {(r.latestSpi != null && r.latestSpi < 0.9) && ` — SPI ${r.latestSpi.toFixed(2)}`}
                  {(r.latestCpi != null && r.latestCpi < 0.9) && ` — CPI ${r.latestCpi.toFixed(2)}`}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
                <th className="px-3 py-2 font-medium w-20">RAG</th>
                <th className="px-3 py-2 font-medium">Project</th>
                <th className="px-3 py-2 font-medium">Client</th>
                <th className="px-3 py-2 font-medium w-32">Contract Value</th>
                <th className="px-3 py-2 font-medium w-24">Latest SPI</th>
                <th className="px-3 py-2 font-medium w-24">Latest CPI</th>
                <th className="px-3 py-2 font-medium w-32">Open High Risks</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const ragColor = RAG_COLORS[r.rag];
                return (
                  <tr key={r.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-3 py-2">
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: ragColor.bg, color: ragColor.text }}
                      >
                        {ragColor.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-800 font-medium whitespace-nowrap">{r.name}</td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{r.client || "—"}</td>
                    <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{formatMoney(r.contractValue)}</td>
                    <td className="px-3 py-2 text-slate-700">{r.latestSpi != null ? r.latestSpi.toFixed(2) : "—"}</td>
                    <td className="px-3 py-2 text-slate-700">{r.latestCpi != null ? r.latestCpi.toFixed(2) : "—"}</td>
                    <td className="px-3 py-2 text-slate-700">{r.openHighRisks}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <p className="text-sm text-slate-400 p-4">No projects yet.</p>}
        </div>
      </main>
    </div>
  );
}
