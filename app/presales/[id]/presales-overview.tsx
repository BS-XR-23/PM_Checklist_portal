"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import clsx from "clsx";
import { InlineText, InlineTextarea, InlineNumber, InlineDate, InlineSelect } from "@/components/ui/inline-edit";
import { PersonPicker } from "@/components/resourcing/person-picker";
import { IconExternalLink } from "@/components/layout/icons";
import { formatDate, formatPct, initials, toDateInputValue } from "@/lib/format";
import { PRESALES_STAGE_COLORS, FORECAST_CATEGORY_COLORS, avatarColorFromString } from "@/lib/colors";
import {
  STAGE_ORDER,
  STAGE_INFO,
  SOURCE_ORDER,
  SOURCE_LABELS,
  LEAD_TYPE_ORDER,
  LEAD_TYPE_LABELS,
  usdEquivalent,
  formatByCurrency,
  USD_TO_BDT_RATE,
  PRESALES_STALE_DAYS,
} from "@/lib/presales-stage";
import { STAGE_WIN_PROBABILITY, closeCountdownLabel, type DealFlags } from "@/lib/presales-pipeline";
import { updatePresalesProject, winPresalesProject, markPresalesLost, reopenPresalesProject } from "../actions";
import type { PresalesOutcome, PresalesStage, PresalesForecastCategory, PresalesCurrency, PresalesSource, PresalesLeadType } from "@prisma/client";

export type PresalesOverviewData = {
  id: string;
  name: string;
  client: string | null;
  description: string | null;
  estimatedValue: number | null;
  estimatedValueCurrency: PresalesCurrency;
  expectedCloseDate: Date | null;
  outcome: PresalesOutcome;
  stage: PresalesStage;
  dealOwnerPersonId: string | null;
  dealOwnerPerson: { id: string; name: string } | null;
  pocDone: boolean;
  forecastCategory: PresalesForecastCategory | null;
  practiceArea: string | null;
  industry: string | null;
  technology: string | null;
  presaleFolderLink: string | null;
  source: PresalesSource | null;
  startDate: Date | null;
  salesContact: string | null;
  estimatedBy: string | null;
  leadType: PresalesLeadType | null;
  onHold: boolean;
  holdReason: string | null;
  lostReason: string | null;
  wonProject: { id: string; name: string } | null;
};

const OUTCOME_ACCENT: Record<PresalesOutcome, string> = { OPEN: "", WON: "#10B981", LOST: "#EF4444" };

// ---------------------------------------------------------------------------
// Hero — the at-a-glance summary: what it's worth, how likely, when, who,
// where it sits in the pipeline, and what's wrong with it right now.
// ---------------------------------------------------------------------------

export function PresalesHero({ data, flags, canWrite }: { data: PresalesOverviewData; flags: DealFlags; canWrite: boolean }) {
  const isOpen = data.outcome === "OPEN";
  const accent = isOpen ? PRESALES_STAGE_COLORS[data.stage].text : OUTCOME_ACCENT[data.outcome];
  const subtitle = [data.client && data.client.trim().toLowerCase() !== data.name.trim().toLowerCase() ? data.client : null, data.industry, data.technology]
    .filter(Boolean)
    .join(" · ");

  const alerts: { tone: "red" | "amber"; text: string }[] = [];
  if (flags.closeOverdue) {
    alerts.push({ tone: "red", text: `Expected close date passed ${-(flags.closeInDays ?? 0)} day${flags.closeInDays === -1 ? "" : "s"} ago — move the date, or mark the deal Won or Lost.` });
  }
  if (flags.stale) alerts.push({ tone: "amber", text: `No activity for ${flags.idleDays} days (stale after ${PRESALES_STALE_DAYS}). Log a decision or a next step to keep it warm.` });
  if (flags.noNextStep) alerts.push({ tone: "amber", text: "No next step planned — add one below so this deal doesn't drift." });

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="h-1.5" style={{ backgroundColor: accent }} />
      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <OutcomePill outcome={data.outcome} />
              {data.onHold && isOpen && <Pill className="bg-slate-200 text-slate-700">On hold</Pill>}
              {data.forecastCategory && isOpen && (
                <Pill style={{ backgroundColor: FORECAST_CATEGORY_COLORS[data.forecastCategory].bg, color: FORECAST_CATEGORY_COLORS[data.forecastCategory].text }}>
                  {FORECAST_CATEGORY_COLORS[data.forecastCategory].label}
                </Pill>
              )}
              {data.pocDone && <Pill className="bg-emerald-50 text-emerald-700">POC done</Pill>}
            </div>
            <h1 className="text-2xl font-bold leading-tight text-slate-900">{data.name}</h1>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {canWrite && <OutcomeActions data={data} />}
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric label="Estimated value">
            <p className="text-2xl font-bold text-slate-900">{data.estimatedValue ? formatByCurrency(data.estimatedValue, data.estimatedValueCurrency) : "—"}</p>
            {data.estimatedValue != null && (
              <p className="text-xs text-slate-400">
                ≈{" "}
                {data.estimatedValueCurrency === "USD"
                  ? formatByCurrency(data.estimatedValue * USD_TO_BDT_RATE, "BDT")
                  : formatByCurrency(usdEquivalent(data.estimatedValue, data.estimatedValueCurrency), "USD")}
              </p>
            )}
          </Metric>
          <Metric label={isOpen ? "Win probability" : "Outcome"}>
            {isOpen ? (
              <>
                <p className="text-2xl font-bold" style={{ color: PRESALES_STAGE_COLORS[data.stage].text }}>
                  {formatPct(STAGE_WIN_PROBABILITY[data.stage])}
                </p>
                <p className="text-xs text-slate-400">from {PRESALES_STAGE_COLORS[data.stage].label} stage</p>
              </>
            ) : (
              <>
                <p className={clsx("text-2xl font-bold", data.outcome === "WON" ? "text-emerald-600" : "text-red-600")}>{data.outcome === "WON" ? "Won" : "Lost"}</p>
                {data.outcome === "WON" && data.wonProject && (
                  <Link href={`/projects/${data.wonProject.id}/dashboard`} className="text-xs font-medium text-emerald-700 hover:underline">
                    → {data.wonProject.name}
                  </Link>
                )}
                {data.outcome === "LOST" && data.lostReason && <p className="text-xs text-slate-500 line-clamp-2">{data.lostReason}</p>}
              </>
            )}
          </Metric>
          <Metric label="Expected close">
            <p className={clsx("text-lg font-semibold", flags.closeOverdue ? "text-red-600" : "text-slate-900")}>{formatDate(data.expectedCloseDate)}</p>
            {isOpen && flags.closeInDays !== null && (
              <p className={clsx("text-xs", flags.closeOverdue ? "font-medium text-red-600" : "text-slate-400")}>{closeCountdownLabel(flags.closeInDays)}</p>
            )}
          </Metric>
          <Metric label="Deal owner">
            {data.dealOwnerPerson ? (
              <div className="flex items-center gap-2">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: avatarColorFromString(data.dealOwnerPerson.name) }}
                >
                  {initials(data.dealOwnerPerson.name)}
                </span>
                <span className="text-sm font-semibold text-slate-900">{data.dealOwnerPerson.name}</span>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Unassigned</p>
            )}
          </Metric>
        </div>

        <StageStepper data={data} canWrite={canWrite} />

        {isOpen && alerts.length > 0 && (
          <ul className="space-y-1.5">
            {alerts.map((a) => (
              <li
                key={a.text}
                className={clsx(
                  "flex items-start gap-2 rounded-lg px-3 py-2 text-sm",
                  a.tone === "red" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"
                )}
              >
                <span aria-hidden>⚠</span>
                {a.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 px-3.5 py-3">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      {children}
    </div>
  );
}

function Pill({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", className)} style={style}>
      {children}
    </span>
  );
}

function OutcomePill({ outcome }: { outcome: PresalesOutcome }) {
  if (outcome === "WON") return <Pill className="bg-emerald-100 text-emerald-800">Won</Pill>;
  if (outcome === "LOST") return <Pill className="bg-red-100 text-red-800">Lost</Pill>;
  return <Pill className="bg-blue-50 text-blue-700">In progress</Pill>;
}

/**
 * The pipeline as a clickable progress bar — the stage is the thing that
 * changes most often in presales, so it gets one click instead of a
 * dropdown buried among 18 fields.
 */
function StageStepper({ data, canWrite }: { data: PresalesOverviewData; canWrite: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isOpen = data.outcome === "OPEN";
  const currentIdx = STAGE_ORDER.indexOf(data.stage);

  const move = (stage: PresalesStage) => {
    if (!canWrite || !isOpen || stage === data.stage) return;
    setError(null);
    startTransition(async () => {
      try {
        await updatePresalesProject(data.id, { stage });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to change stage.");
      }
    });
  };

  return (
    <div>
      <ol className={clsx("grid grid-cols-2 gap-1.5 sm:grid-cols-5", pending && "opacity-60")}>
        {STAGE_ORDER.map((stage, i) => {
          const color = PRESALES_STAGE_COLORS[stage];
          const reached = isOpen ? i <= currentIdx : data.outcome === "WON" || i <= currentIdx;
          const current = isOpen && i === currentIdx;
          return (
            <li key={stage}>
              <button
                type="button"
                disabled={!canWrite || !isOpen || pending}
                onClick={() => move(stage)}
                title={STAGE_INFO[stage]}
                className={clsx(
                  "flex w-full flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors",
                  current ? "border-transparent shadow-sm" : reached ? "border-transparent" : "border-slate-200 bg-white",
                  canWrite && isOpen && !current && "hover:border-slate-400",
                  (!canWrite || !isOpen) && "cursor-default"
                )}
                style={current ? { backgroundColor: color.text, color: "#fff" } : reached ? { backgroundColor: color.bg, color: color.text } : undefined}
              >
                <span className={clsx("text-[10px] font-semibold uppercase tracking-wide", !reached && "text-slate-400")}>
                  {i + 1} · {formatPct(STAGE_WIN_PROBABILITY[stage])}
                </span>
                <span className={clsx("text-sm font-semibold", !reached && "text-slate-500")}>{color.label}</span>
              </button>
            </li>
          );
        })}
        <li className="col-span-2 sm:col-span-1">
          <div
            className={clsx(
              "flex w-full flex-col items-start rounded-lg border px-3 py-2",
              data.outcome === "WON"
                ? "border-transparent bg-emerald-600 text-white"
                : data.outcome === "LOST"
                  ? "border-transparent bg-red-600 text-white"
                  : "border-dashed border-slate-300 text-slate-400"
            )}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide">Outcome</span>
            <span className="text-sm font-semibold">{data.outcome === "WON" ? "Won ✓" : data.outcome === "LOST" ? "Lost" : "Won / Lost"}</span>
          </div>
        </li>
      </ol>
      {isOpen && <p className="mt-1.5 text-xs text-slate-500">{STAGE_INFO[data.stage]}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function OutcomeActions({ data }: { data: PresalesOverviewData }) {
  const [pending, startTransition] = useTransition();
  const [showLostForm, setShowLostForm] = useState(false);
  const [lostReason, setLostReason] = useState("");

  if (data.outcome === "WON") return null;

  if (data.outcome === "LOST") {
    return (
      <button
        onClick={() => startTransition(() => reopenPresalesProject(data.id))}
        disabled={pending}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? "Reopening..." : "Reopen deal"}
      </button>
    );
  }

  if (showLostForm) {
    return (
      <div className="w-full max-w-sm space-y-2 rounded-lg border border-red-200 bg-red-50/50 p-3">
        <label className="block text-xs font-medium text-slate-700">Why was this lost?</label>
        <textarea
          value={lostReason}
          onChange={(e) => setLostReason(e.target.value)}
          rows={2}
          autoFocus
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          placeholder="Budget cut, went with a competitor, timing..."
        />
        <div className="flex gap-2">
          <button
            onClick={() => startTransition(() => markPresalesLost(data.id, lostReason))}
            disabled={pending}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {pending ? "..." : "Confirm lost"}
          </button>
          <button onClick={() => setShowLostForm(false)} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        onClick={() => setShowLostForm(true)}
        disabled={pending}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
      >
        Mark as lost
      </button>
      <button
        onClick={() => {
          if (!window.confirm(`Mark "${data.name}" as Won? This creates a new active project with the standard checklist, seeded from this opportunity.`)) return;
          startTransition(() => winPresalesProject(data.id));
        }}
        disabled={pending}
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? "..." : "🏆 Mark as won"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Details — every field, grouped by what it's for instead of one flat wall.
// ---------------------------------------------------------------------------

export function PresalesDetails({
  data,
  canWrite,
  people,
}: {
  data: PresalesOverviewData;
  canWrite: boolean;
  people: { id: string; name: string }[];
}) {
  const save = (changes: Parameters<typeof updatePresalesProject>[1]) => updatePresalesProject(data.id, changes);
  const text = (value: string | null, field: "name" | "client" | "salesContact" | "estimatedBy" | "practiceArea" | "industry" | "technology", placeholder?: string) =>
    canWrite ? <InlineText value={value ?? ""} onSave={(v) => save({ [field]: v })} placeholder={placeholder} /> : <ReadValue>{value}</ReadValue>;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-100 px-5 py-3.5">
        <h2 className="text-base font-semibold text-slate-900">Deal details</h2>
      </header>
      <div className="divide-y divide-slate-100">
        <Group title="Basics">
          <Field label="Opportunity name">{text(data.name, "name")}</Field>
          <Field label="Client">{text(data.client, "client", "Client company")}</Field>
          <Field label="Deal owner">
            {canWrite ? (
              <PersonPicker personId={data.dealOwnerPersonId} legacyText={null} people={people} onSave={(id) => save({ dealOwnerPersonId: id })} />
            ) : (
              <ReadValue>{data.dealOwnerPerson?.name}</ReadValue>
            )}
          </Field>
          <Field label="Description" wide>
            {canWrite ? (
              <InlineTextarea value={data.description ?? ""} onSave={(v) => save({ description: v })} placeholder="What is this opportunity, and why might it happen?" />
            ) : (
              <p className="whitespace-pre-wrap text-sm text-slate-800">{data.description || "—"}</p>
            )}
          </Field>
        </Group>

        <Group title="Commercial">
          <Field label="Estimated value">
            {canWrite ? (
              <div className="flex items-center gap-1.5">
                <InlineNumber value={data.estimatedValue} onSave={(v) => save({ estimatedValue: v })} step={0.01} />
                <InlineSelect
                  value={data.estimatedValueCurrency}
                  options={["USD", "BDT"]}
                  className="rounded-md border border-slate-200 px-1.5 py-1 text-xs"
                  onSave={(v) => save({ estimatedValueCurrency: v as PresalesCurrency })}
                />
              </div>
            ) : (
              <ReadValue>{data.estimatedValue ? formatByCurrency(data.estimatedValue, data.estimatedValueCurrency) : null}</ReadValue>
            )}
            <p className="mt-0.5 text-[11px] text-slate-400">1 USD = {USD_TO_BDT_RATE} BDT</p>
          </Field>
          <Field label="Lead type">
            {canWrite ? (
              <InlineSelect
                value={data.leadType ?? ""}
                options={["", ...LEAD_TYPE_ORDER]}
                renderOption={(v) => (v ? LEAD_TYPE_LABELS[v as PresalesLeadType] : "—")}
                onSave={(v) => save({ leadType: v ? (v as PresalesLeadType) : null })}
              />
            ) : (
              <ReadValue>{data.leadType ? LEAD_TYPE_LABELS[data.leadType] : null}</ReadValue>
            )}
          </Field>
          <Field label="Source">
            {canWrite ? (
              <InlineSelect
                value={data.source ?? ""}
                options={["", ...SOURCE_ORDER]}
                renderOption={(v) => (v ? SOURCE_LABELS[v as PresalesSource] : "—")}
                onSave={(v) => save({ source: v ? (v as PresalesSource) : null })}
              />
            ) : (
              <ReadValue>{data.source ? SOURCE_LABELS[data.source] : null}</ReadValue>
            )}
          </Field>
          <Field label="Owner's forecast" hint="The deal owner's honest read, on top of the stage-based win %.">
            {canWrite ? (
              <InlineSelect
                value={data.forecastCategory ?? ""}
                options={["", "COMMIT", "BEST_CASE", "PIPELINE"]}
                renderOption={(v) => (v ? FORECAST_CATEGORY_COLORS[v as PresalesForecastCategory].label : "—")}
                onSave={(v) => save({ forecastCategory: v ? (v as PresalesForecastCategory) : null })}
              />
            ) : (
              <ReadValue>{data.forecastCategory ? FORECAST_CATEGORY_COLORS[data.forecastCategory].label : null}</ReadValue>
            )}
          </Field>
          <Field label="Proof of concept">
            {canWrite ? (
              <BooleanToggle value={data.pocDone} trueLabel="✓ POC done" falseLabel="Not done" onSave={(v) => save({ pocDone: v })} />
            ) : (
              <ReadValue>{data.pocDone ? "Done" : "Not done"}</ReadValue>
            )}
          </Field>
        </Group>

        <Group title="Timeline">
          <Field label="Start date">
            {canWrite ? (
              <InlineDate value={toDateInputValue(data.startDate)} onSave={(v) => save({ startDate: v })} />
            ) : (
              <ReadValue>{data.startDate ? formatDate(data.startDate) : null}</ReadValue>
            )}
          </Field>
          <Field label="Expected close">
            {canWrite ? (
              <InlineDate value={toDateInputValue(data.expectedCloseDate)} onSave={(v) => save({ expectedCloseDate: v })} />
            ) : (
              <ReadValue>{data.expectedCloseDate ? formatDate(data.expectedCloseDate) : null}</ReadValue>
            )}
          </Field>
          <Field label="Status" wide>
            {canWrite ? (
              <BooleanToggle value={data.onHold} trueLabel="⏸ On hold" falseLabel="Active" onSave={(v) => save({ onHold: v })} />
            ) : (
              <ReadValue>{data.onHold ? "On hold" : "Active"}</ReadValue>
            )}
            {data.onHold &&
              (canWrite ? (
                <div className="mt-1.5">
                  <InlineText value={data.holdReason ?? ""} onSave={(v) => save({ holdReason: v })} placeholder="Why is this on hold?" />
                </div>
              ) : (
                data.holdReason && <p className="mt-1 text-xs text-slate-500">{data.holdReason}</p>
              ))}
          </Field>
        </Group>

        <Group title="People">
          <Field label="Sales contact">{text(data.salesContact, "salesContact", "Who brought in this lead")}</Field>
          <Field label="Estimated by">{text(data.estimatedBy, "estimatedBy", "Who scoped the estimate")}</Field>
        </Group>

        <Group title="Classification">
          <Field label="Practice area">{text(data.practiceArea, "practiceArea", "e.g. XR, InsurTech")}</Field>
          <Field label="Industry">{text(data.industry, "industry", "e.g. Education")}</Field>
          <Field label="Technology">{text(data.technology, "technology", "e.g. AI/RAG, Mobile")}</Field>
        </Group>

        <Group title="Files">
          <Field label="Presale folder" wide>
            <PresaleFolderLink value={data.presaleFolderLink} canWrite={canWrite} onSave={(v) => save({ presaleFolderLink: v })} />
          </Field>
        </Group>
      </div>
    </section>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({ label, hint, wide, children }: { label: string; hint?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={clsx("min-w-0", wide && "sm:col-span-2")}>
      <p className="mb-1 text-xs font-medium text-slate-500" title={hint}>
        {label}
      </p>
      {children}
    </div>
  );
}

function ReadValue({ children }: { children: React.ReactNode }) {
  return children ? <p className="text-sm text-slate-800">{children}</p> : <p className="text-sm text-slate-400">—</p>;
}

function BooleanToggle({
  value,
  trueLabel,
  falseLabel,
  onSave,
}: {
  value: boolean;
  trueLabel: string;
  falseLabel: string;
  onSave: (next: boolean) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => onSave(!value))}
      disabled={pending}
      className={
        value
          ? "inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
          : "inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 disabled:opacity-50"
      }
    >
      {pending ? "..." : value ? trueLabel : falseLabel}
    </button>
  );
}

// Same "inline edit + a separate open-in-new-tab icon" idea as
// ChecklistLinkCell (components/checklist/checklist-table.tsx).
function PresaleFolderLink({ value, canWrite, onSave }: { value: string | null; canWrite: boolean; onSave: (v: string) => Promise<void> }) {
  if (!canWrite) {
    return value ? (
      <a href={value} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all text-sm text-blue-600 hover:underline">
        <IconExternalLink className="h-3.5 w-3.5 shrink-0" />
        Open folder
      </a>
    ) : (
      <p className="text-sm text-slate-400">—</p>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="min-w-0 flex-1">
        <InlineText value={value ?? ""} onSave={onSave} placeholder="Paste a SharePoint/Drive folder link" />
      </div>
      {value && (
        <a href={value} target="_blank" rel="noopener noreferrer" title="Open folder" className="shrink-0 text-slate-400 hover:text-slate-700">
          <IconExternalLink className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}
