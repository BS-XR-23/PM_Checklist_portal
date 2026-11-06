import { describe, it, expect } from "vitest";
import {
  PM_CHECKLIST_SEED,
  DELIVERY_QA_CHECKLIST_SEED,
  DEVOPS_CHECKLIST_SEED,
  CREATIVE_XR_CHECKLIST_SEED,
  DEV_CHECKLIST_SEED,
  PM_STAGES,
} from "./seed-data";

const ALL_SEEDS = [PM_CHECKLIST_SEED, DELIVERY_QA_CHECKLIST_SEED, DEVOPS_CHECKLIST_SEED, CREATIVE_XR_CHECKLIST_SEED, DEV_CHECKLIST_SEED];

describe("checklist template seed", () => {
  it("has the agreed size per checklist", () => {
    expect(ALL_SEEDS.map((s) => s.length)).toEqual([43, 12, 24, 10, 26]);
  });

  it("has 35 one-time and 8 recurring PM items", () => {
    expect(PM_CHECKLIST_SEED.filter((i) => i.isRecurring)).toHaveLength(8);
  });

  it("puts every PM item in a lifecycle stage, and no template item in Presales", () => {
    for (const item of PM_CHECKLIST_SEED) {
      expect(PM_STAGES).toContain(item.stage);
      expect(item.stage).not.toBe("Presales");
    }
  });

  it("gives Development a tracked item, so currentStage() doesn't skip it", () => {
    expect(PM_CHECKLIST_SEED.some((i) => i.stage === "Development" && !i.isRecurring)).toBe(true);
  });

  it("maps every QMS criterion except the two the CR log answers", () => {
    const mapped = new Set(ALL_SEEDS.flat().flatMap((i) => i.qmsRefs ?? []));
    const expected = Array.from({ length: 45 }, (_, i) => `Q${i + 1}`).filter((q) => q !== "Q33" && q !== "Q34");
    expect(Array.from(mapped).sort()).toEqual([...expected].sort());
  });

  it("links 34 checklist items to QMS", () => {
    expect(ALL_SEEDS.flat().filter((i) => i.qmsRefs?.length)).toHaveLength(34);
  });
});
