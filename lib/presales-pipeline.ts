import type { PresalesCurrency, PresalesOutcome, PresalesStage } from "@prisma/client";
import { PRESALES_STALE_DAYS, STAGE_ORDER, usdEquivalent } from "@/lib/presales-stage";

const DAY_MS = 86_400_000;

// Win probability is derived from stage, never stored (schema comment on
// PresalesStage) — one fixed lookup so the board, table, detail page, and
// weighted-forecast tile can't disagree. Conventional B2B pipeline defaults;
// revise here if the team's real conversion rates differ.
export const STAGE_WIN_PROBABILITY: Record<PresalesStage, number> = {
  LEAD: 0.1,
  QUALIFYING: 0.25,
  PROPOSAL: 0.5,
  NEGOTIATION: 0.75,
};

// "Closing soon" window for the pipeline tile and the detail-page countdown.
export const CLOSING_SOON_DAYS = 30;

export type PipelineDeal = {
  outcome: PresalesOutcome;
  stage: PresalesStage;
  estimatedValue: number | null;
  estimatedValueCurrency: PresalesCurrency;
  expectedCloseDate: Date | null;
  updatedAt: Date;
  onHold: boolean;
  deletedAt: Date | null;
  /** Open (not Done) action items on the deal. */
  openActionCount: number;
};

export type DealFlags = {
  /** Whole days until the expected close date (negative = past it); null if no date. */
  closeInDays: number | null;
  closeOverdue: boolean;
  /** Whole days since the last activity (updatedAt — child edits bump it). */
  idleDays: number;
  stale: boolean;
  noNextStep: boolean;
  needsAttention: boolean;
};

function startOfDayUTC(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Per-deal warning signals — only meaningful for an OPEN deal; a closed
 * (Won/Lost) or deleted one never needs attention. Stale uses the same rule
 * as the Reminders page (lib/notifications.ts): more than PRESALES_STALE_DAYS
 * since the last activity, and a deal deliberately put On Hold is exempt.
 */
export function dealFlags(deal: PipelineDeal, today: Date = new Date()): DealFlags {
  const live = deal.outcome === "OPEN" && deal.deletedAt === null;
  const closeInDays =
    deal.expectedCloseDate === null ? null : Math.round((startOfDayUTC(deal.expectedCloseDate) - startOfDayUTC(today)) / DAY_MS);
  const elapsedMs = today.getTime() - deal.updatedAt.getTime();
  const idleDays = Math.max(0, Math.floor(elapsedMs / DAY_MS));

  const closeOverdue = live && closeInDays !== null && closeInDays < 0;
  const stale = live && !deal.onHold && elapsedMs > PRESALES_STALE_DAYS * DAY_MS;
  const noNextStep = live && !deal.onHold && deal.openActionCount === 0;
  return { closeInDays, closeOverdue, idleDays, stale, noNextStep, needsAttention: closeOverdue || stale || noNextStep };
}

export function dealValueUsd(deal: Pick<PipelineDeal, "estimatedValue" | "estimatedValueCurrency">): number {
  return usdEquivalent(deal.estimatedValue ?? 0, deal.estimatedValueCurrency);
}

export type PipelineSummary = {
  openCount: number;
  openValueUsd: number;
  /** Σ value × stage win probability over open deals. */
  weightedValueUsd: number;
  closingSoonCount: number;
  closingSoonValueUsd: number;
  attentionCount: number;
  overdueCount: number;
  staleCount: number;
  noNextStepCount: number;
  wonCount: number;
  lostCount: number;
  wonValueUsd: number;
  /** won ÷ (won + lost); null until at least one deal has closed. */
  winRate: number | null;
  byStage: Record<PresalesStage, { count: number; valueUsd: number }>;
};

export function summarizePipeline(deals: PipelineDeal[], today: Date = new Date()): PipelineSummary {
  const byStage = Object.fromEntries(STAGE_ORDER.map((s) => [s, { count: 0, valueUsd: 0 }])) as PipelineSummary["byStage"];
  const s: PipelineSummary = {
    openCount: 0,
    openValueUsd: 0,
    weightedValueUsd: 0,
    closingSoonCount: 0,
    closingSoonValueUsd: 0,
    attentionCount: 0,
    overdueCount: 0,
    staleCount: 0,
    noNextStepCount: 0,
    wonCount: 0,
    lostCount: 0,
    wonValueUsd: 0,
    winRate: null,
    byStage,
  };

  for (const d of deals) {
    if (d.deletedAt !== null) continue;
    const value = dealValueUsd(d);
    if (d.outcome === "WON") {
      s.wonCount++;
      s.wonValueUsd += value;
      continue;
    }
    if (d.outcome === "LOST") {
      s.lostCount++;
      continue;
    }
    const f = dealFlags(d, today);
    s.openCount++;
    s.openValueUsd += value;
    s.weightedValueUsd += value * STAGE_WIN_PROBABILITY[d.stage];
    byStage[d.stage].count++;
    byStage[d.stage].valueUsd += value;
    if (f.closeInDays !== null && f.closeInDays >= 0 && f.closeInDays <= CLOSING_SOON_DAYS) {
      s.closingSoonCount++;
      s.closingSoonValueUsd += value;
    }
    if (f.needsAttention) s.attentionCount++;
    if (f.closeOverdue) s.overdueCount++;
    if (f.stale) s.staleCount++;
    if (f.noNextStep) s.noNextStepCount++;
  }

  const closed = s.wonCount + s.lostCount;
  s.winRate = closed > 0 ? s.wonCount / closed : null;
  return s;
}

/** "in 3 days" / "today" / "5 days overdue" — for close-date countdowns. */
export function closeCountdownLabel(closeInDays: number | null): string | null {
  if (closeInDays === null) return null;
  if (closeInDays === 0) return "closes today";
  if (closeInDays === 1) return "closes tomorrow";
  if (closeInDays > 0) return `in ${closeInDays} days`;
  return closeInDays === -1 ? "1 day overdue" : `${-closeInDays} days overdue`;
}
