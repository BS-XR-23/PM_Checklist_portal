import { describe, expect, it } from "vitest";
import { closeCountdownLabel, dealFlags, summarizePipeline, STAGE_WIN_PROBABILITY, type PipelineDeal } from "./presales-pipeline";
import { USD_TO_BDT_RATE } from "./presales-stage";

const today = new Date("2026-10-14T09:00:00Z");
const daysAgo = (n: number) => new Date(today.getTime() - n * 86_400_000);

function deal(overrides: Partial<PipelineDeal> = {}): PipelineDeal {
  return {
    outcome: "OPEN",
    stage: "PROPOSAL",
    estimatedValue: 10_000,
    estimatedValueCurrency: "USD",
    expectedCloseDate: new Date("2026-11-01T00:00:00Z"),
    updatedAt: daysAgo(1),
    onHold: false,
    deletedAt: null,
    openActionCount: 1,
    ...overrides,
  };
}

describe("dealFlags", () => {
  it("a healthy open deal needs no attention", () => {
    const f = dealFlags(deal(), today);
    expect(f).toMatchObject({ closeOverdue: false, stale: false, noNextStep: false, needsAttention: false, closeInDays: 18, idleDays: 1 });
  });

  it("flags a close date in the past, by calendar day", () => {
    const f = dealFlags(deal({ expectedCloseDate: new Date("2026-10-09T00:00:00Z") }), today);
    expect(f.closeInDays).toBe(-5);
    expect(f.closeOverdue).toBe(true);
    expect(f.needsAttention).toBe(true);
    expect(dealFlags(deal({ expectedCloseDate: new Date("2026-10-14T00:00:00Z") }), today).closeOverdue).toBe(false);
  });

  it("stale only after more than PRESALES_STALE_DAYS idle, and never while on hold", () => {
    expect(dealFlags(deal({ updatedAt: daysAgo(10) }), today).stale).toBe(false);
    expect(dealFlags(deal({ updatedAt: daysAgo(12) }), today).stale).toBe(true);
    expect(dealFlags(deal({ updatedAt: daysAgo(12), onHold: true }), today).stale).toBe(false);
  });

  it("flags an open deal with no open action item as having no next step", () => {
    expect(dealFlags(deal({ openActionCount: 0 }), today).noNextStep).toBe(true);
    expect(dealFlags(deal({ openActionCount: 0, onHold: true }), today).noNextStep).toBe(false);
  });

  it("closed or deleted deals never need attention", () => {
    const old = { updatedAt: daysAgo(40), expectedCloseDate: daysAgo(30), openActionCount: 0 };
    expect(dealFlags(deal({ ...old, outcome: "WON" }), today).needsAttention).toBe(false);
    expect(dealFlags(deal({ ...old, outcome: "LOST" }), today).needsAttention).toBe(false);
    expect(dealFlags(deal({ ...old, deletedAt: daysAgo(1) }), today).needsAttention).toBe(false);
  });
});

describe("summarizePipeline", () => {
  it("weights open value by stage probability and normalizes BDT to USD", () => {
    const s = summarizePipeline(
      [
        deal({ stage: "LEAD", estimatedValue: 20_000 }),
        deal({ stage: "NEGOTIATION", estimatedValue: 10_000 * USD_TO_BDT_RATE, estimatedValueCurrency: "BDT" }),
      ],
      today
    );
    expect(s.openCount).toBe(2);
    expect(s.openValueUsd).toBeCloseTo(30_000);
    expect(s.weightedValueUsd).toBeCloseTo(20_000 * STAGE_WIN_PROBABILITY.LEAD + 10_000 * STAGE_WIN_PROBABILITY.NEGOTIATION);
    expect(s.byStage.LEAD).toEqual({ count: 1, valueUsd: 20_000 });
    expect(s.byStage.NEGOTIATION.count).toBe(1);
    expect(s.byStage.PROPOSAL.count).toBe(0);
  });

  it("counts closing-soon, attention, won/lost, and win rate; skips deleted", () => {
    const s = summarizePipeline(
      [
        deal({ expectedCloseDate: new Date("2026-10-20T00:00:00Z") }), // closing soon
        deal({ expectedCloseDate: new Date("2026-10-09T00:00:00Z"), updatedAt: daysAgo(12), openActionCount: 0 }), // overdue + stale + no next step
        deal({ outcome: "WON", estimatedValue: 5_000 }),
        deal({ outcome: "LOST" }),
        deal({ outcome: "LOST" }),
        deal({ deletedAt: daysAgo(1) }),
      ],
      today
    );
    expect(s.openCount).toBe(2);
    expect(s.closingSoonCount).toBe(1);
    expect(s.attentionCount).toBe(1);
    expect([s.overdueCount, s.staleCount, s.noNextStepCount]).toEqual([1, 1, 1]);
    expect(s.wonCount).toBe(1);
    expect(s.wonValueUsd).toBe(5_000);
    expect(s.lostCount).toBe(2);
    expect(s.winRate).toBeCloseTo(1 / 3);
  });

  it("win rate is null until something has closed", () => {
    expect(summarizePipeline([deal()], today).winRate).toBeNull();
  });
});

describe("closeCountdownLabel", () => {
  it("reads naturally on both sides of the date", () => {
    expect(closeCountdownLabel(null)).toBeNull();
    expect(closeCountdownLabel(0)).toBe("closes today");
    expect(closeCountdownLabel(1)).toBe("closes tomorrow");
    expect(closeCountdownLabel(9)).toBe("in 9 days");
    expect(closeCountdownLabel(-1)).toBe("1 day overdue");
    expect(closeCountdownLabel(-5)).toBe("5 days overdue");
  });
});
