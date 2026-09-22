import type { PresalesStage, PresalesCurrency, PresalesSource, PresalesLeadType } from "@prisma/client";
import { formatMoney, formatBDT } from "@/lib/format";

export const STAGE_ORDER: PresalesStage[] = ["LEAD", "QUALIFYING", "PROPOSAL", "NEGOTIATION"];

// Presentational copy for the stage info tooltip — easy to revise once
// this is actually used and doesn't quite match how the team works.
export const STAGE_INFO: Record<PresalesStage, string> = {
  LEAD: "Initial contact — early conversations, not yet qualified as a real opportunity.",
  QUALIFYING: "Actively assessing fit, budget, and need — confirming this is worth pursuing.",
  PROPOSAL: "A formal proposal, SOW, or estimate has been sent to the client.",
  NEGOTIATION: "Terms, scope, or pricing are being actively negotiated before signing.",
};

// Days of no activity (no new/updated decision, action item, or checklist
// item) on an OPEN opportunity before it's flagged stale — shared between
// the board's "Stale" badge and the Reminders system (lib/notifications.ts).
export const PRESALES_STALE_DAYS = 10;

// Fixed, approximate — not a live FX feed. Revisit if it drifts enough to
// matter; until then this keeps pipeline totals comparable across deals
// entered in either currency.
export const USD_TO_BDT_RATE = 122;

export function usdEquivalent(value: number, currency: PresalesCurrency): number {
  return currency === "BDT" ? value / USD_TO_BDT_RATE : value;
}

// The card, detail page, and pipeline-value stat tile all need the same
// "format in whichever currency it was entered" rule — pulled out once
// since it's identical every time, not three similar-but-different sites.
export function formatByCurrency(value: number, currency: PresalesCurrency): string {
  return currency === "BDT" ? formatBDT(value) : formatMoney(value);
}

// Plain label map, not a color map like Stage/Forecast Category — Source
// isn't an urgency/status signal, just a category, so no pill styling.
// COMPETITIVE_TENDER absorbs what used to be the standalone Competitive
// Bid flag, since the two were answering the same underlying question.
export const SOURCE_ORDER: PresalesSource[] = ["INBOUND", "OUTBOUND", "REFERRAL", "COMPETITIVE_TENDER", "EXISTING_CLIENT"];

export const SOURCE_LABELS: Record<PresalesSource, string> = {
  INBOUND: "Inbound",
  OUTBOUND: "Outbound",
  REFERRAL: "Referral",
  COMPETITIVE_TENDER: "Competitive Tender",
  EXISTING_CLIENT: "Existing Client",
};

export const LEAD_TYPE_ORDER: PresalesLeadType[] = ["FIXED_BUDGET", "RESOURCE_AUGMENTATION", "TIME_AND_MATERIAL"];

export const LEAD_TYPE_LABELS: Record<PresalesLeadType, string> = {
  FIXED_BUDGET: "Fixed Budget",
  RESOURCE_AUGMENTATION: "Resource Augmentation",
  TIME_AND_MATERIAL: "Time & Material",
};
