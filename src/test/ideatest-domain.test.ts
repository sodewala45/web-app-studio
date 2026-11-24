import { describe, expect, it } from "vitest";

import {
  calculateEconomics,
  calculateVerdict,
  MAX_ACTIVE_RUNS,
  MAX_BUYERS,
  RUN_MODES,
  validateFinanceInputs,
  type Economics,
} from "@/lib/ideatest/domain";

const profitableEconomics: Economics = {
  revenueYear1: 12000,
  contributionYear1: 8400,
  contributionMarginPercent: 70,
  year1Profit: 2400,
  month12Profit: 200,
  breakEvenUnits: 20,
  breakEvenUnitLabel: "monthly units",
  cashNeeded: 0,
  paybackMonth: 0,
  monthly: [],
};

describe("IdeaTest business rules", () => {
  it("keeps Quick runs at 20 buyers for 1 credit", () => {
    expect(RUN_MODES.quick).toEqual({ buyers: 20, credits: 1 });
  });

  it("keeps Full runs at 100 buyers for 5 credits and never exceeds 100 buyers", () => {
    expect(RUN_MODES.full).toEqual({ buyers: 100, credits: 5 });
    expect(MAX_BUYERS).toBe(100);
  });

  it("limits each user to 3 active runs", () => {
    expect(MAX_ACTIVE_RUNS).toBe(3);
  });

  it("marks an idea Promising only when all three conditions pass", () => {
    expect(calculateVerdict(profitableEconomics, 0.21)).toEqual({
      verdict: "promising",
      conditions: {
        positiveContribution: true,
        profitableYearOne: true,
        buyRateAboveTwentyPercent: true,
      },
    });
  });

  it("requires a buy rate strictly above 20 percent for the panel condition", () => {
    expect(calculateVerdict(profitableEconomics, 0.2).conditions.buyRateAboveTwentyPercent).toBe(false);
    expect(calculateVerdict(profitableEconomics, 0.21).conditions.buyRateAboveTwentyPercent).toBe(true);
  });

  it("uses Needs work when some, but not all, verdict conditions pass", () => {
    expect(calculateVerdict(profitableEconomics, 0.2).verdict).toBe("needs_work");
  });

  it("uses Not viable yet when none of the verdict conditions pass", () => {
    const losses = { ...profitableEconomics, contributionYear1: -1, year1Profit: -1 };
    expect(calculateVerdict(losses, 0.2).verdict).toBe("not_viable_yet");
  });

  it("rejects missing financial inputs rather than filling in a guess", () => {
    expect(validateFinanceInputs("physical_product", { price: 10 })).toMatch(/cost to make or buy one/i);
    expect(() => calculateEconomics("physical_product", { price: 10 })).toThrow(/cost to make or buy one/i);
  });
});