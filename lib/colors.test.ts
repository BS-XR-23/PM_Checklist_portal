import { describe, it, expect } from "vitest";
import { intensityBand } from "./colors";

describe("intensityBand", () => {
  it("bands below 40 as low", () => {
    expect(intensityBand(0)).toBe("low");
    expect(intensityBand(39)).toBe("low");
  });

  it("bands 40-59 as medium", () => {
    expect(intensityBand(40)).toBe("medium");
    expect(intensityBand(59)).toBe("medium");
  });

  it("bands 60+ as high, matching HIGH_INTENSITY_THRESHOLD_PCT", () => {
    expect(intensityBand(60)).toBe("high");
    expect(intensityBand(100)).toBe("high");
  });
});
