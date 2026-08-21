"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { IconUsers, IconFilter, IconSearch } from "@/components/layout/icons";
import { SectionHeader } from "@/components/ui/section-header";
import { PersonRow, type PersonRowData } from "./person-row";

const PAGE_SIZES = [10, 25, 50] as const;
type EngagementFilter = "all" | "on-project" | "bench";
type AccountFilter = "all" | "linked" | "unlinked";

function matchesSearch(p: PersonRowData, q: string): boolean {
  if (!q) return true;
  const s = q.toLowerCase();
  return p.name.toLowerCase().includes(s) || (p.title ?? "").toLowerCase().includes(s) || (p.email ?? "").toLowerCase().includes(s);
}

function matchesFilter(p: PersonRowData, filter: EngagementFilter): boolean {
  if (filter === "on-project") return p.engagements.length > 0;
  if (filter === "bench") return p.engagements.length === 0;
  return true;
}

function matchesAccountFilter(p: PersonRowData, filter: AccountFilter): boolean {
  if (filter === "linked") return p.linkedUserId !== null;
  if (filter === "unlinked") return p.linkedUserId === null;
  return true;
}

// Owns the search/filter/sort/pagination state that the "Quick Filters" card
// (right column) and the "People List" table (main column) both need — the
// two live in different halves of the page grid, so the state has to sit
// above both rather than inside either one.
export function PeopleDirectory({
  statCards,
  addPersonForm,
  rows,
  roleRates,
  competencies,
  sidebarBottom,
}: {
  statCards: ReactNode;
  addPersonForm: ReactNode;
  rows: PersonRowData[];
  roleRates: { id: string; roleName: string }[];
  competencies: { id: string; level: string }[];
  sidebarBottom: ReactNode;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<EngagementFilter>("all");
  const [accountFilter, setAccountFilter] = useState<AccountFilter>("all");
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(10);

  const filtered = useMemo(() => {
    const matched = rows.filter(
      (p) => matchesSearch(p, search) && matchesFilter(p, filter) && matchesAccountFilter(p, accountFilter)
    );
    return [...matched].sort((a, b) => (sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)));
  }, [rows, search, filter, accountFilter, sortAsc]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const clampedPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6 items-start">
      <div className="space-y-4 min-w-0">
        {statCards}
        {addPersonForm}

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 border-b border-slate-100">
            <SectionHeader icon={<IconUsers />} iconWrapClass="bg-blue-50 text-blue-600" title="People List" className="" />
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search people…"
                className="w-64 rounded-md border border-slate-300 pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1300px]">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 w-40">
                    <button type="button" onClick={() => setSortAsc((v) => !v)} className="inline-flex items-center gap-1 hover:text-slate-700">
                      Name <span className="text-[10px]">{sortAsc ? "▲" : "▼"}</span>
                    </button>
                  </th>
                  <th className="px-4 py-3 w-36">Title</th>
                  <th className="px-4 py-3 w-52">Email</th>
                  <th className="px-4 py-3 w-24">Phone</th>
                  <th className="px-4 py-3 w-40">Portal Account</th>
                  <th className="px-4 py-3 w-36">Rate Role</th>
                  <th className="px-4 py-3 w-36">Competency</th>
                  <th className="px-4 py-3 min-w-[200px]">Engagement</th>
                  <th className="px-4 py-3 w-12" />
                </tr>
              </thead>
              <tbody>
                {pageRows.map((p) => (
                  <PersonRow key={p.id} person={p} roleRates={roleRates} competencies={competencies} />
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="text-sm text-slate-400 p-4">{rows.length === 0 ? "No people in the registry yet." : `No people match "${search}".`}</p>
            )}
          </div>

          {filtered.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
              <span>
                Showing {(clampedPage - 1) * pageSize + 1} to {Math.min(clampedPage * pageSize, filtered.length)} of {filtered.length} people
              </span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((v) => Math.max(1, v - 1))}
                    disabled={clampedPage <= 1}
                    className="rounded-md border border-slate-200 px-2 py-1 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                  >
                    ‹
                  </button>
                  {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPage(n)}
                      className={`min-w-[1.75rem] rounded-md px-2 py-1 ${n === clampedPage ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPage((v) => Math.min(pageCount, v + 1))}
                    disabled={clampedPage >= pageCount}
                    className="rounded-md border border-slate-200 px-2 py-1 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                  >
                    ›
                  </button>
                </div>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value) as (typeof PAGE_SIZES)[number]);
                    setPage(1);
                  }}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n} / page
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400">
          Assigning a Person to a specific project (role, intensity, dates) happens on that project&apos;s Resourcing
          tab — Admin or that project&apos;s PM. A person&apos;s Rate Role is what the (testing-only) Budget Tracker
          resolves live to price their actual man-days from the Delivery tab. Their Competency is what converts real
          days worked into effort units for the Delivery tab&apos;s Sprint Summary.
        </p>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5">
          <SectionHeader icon={<IconFilter />} iconWrapClass="bg-slate-100 text-slate-500" title="Quick Filters" className="" />
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as EngagementFilter);
              setPage(1);
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">All Engagement</option>
            <option value="on-project">On Project</option>
            <option value="bench">Bench (no current project)</option>
          </select>
          <select
            value={accountFilter}
            onChange={(e) => {
              setAccountFilter(e.target.value as AccountFilter);
              setPage(1);
            }}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">All Portal Accounts</option>
            <option value="linked">Linked to a User</option>
            <option value="unlinked">Not linked</option>
          </select>
        </div>

        {sidebarBottom}
      </div>
    </div>
  );
}
