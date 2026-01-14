import { describe, expect, it } from "vitest";
import { computeRewardRates, isEligible, selectRewardRule } from "@/lib/ruleEngine";
import type { CampaignConfig, RewardRuleConfig, TransactionEvent } from "@/lib/types";

const rules: RewardRuleConfig[] = [
  { id: "rule-5", name: "Every 5th", nth: 5, rewardTemplateId: "a", priority: 5, enabled: true },
  { id: "rule-20", name: "Every 20th", nth: 20, rewardTemplateId: "b", priority: 20, enabled: true },
  { id: "rule-100", name: "Every 100th", nth: 100, rewardTemplateId: "c", priority: 100, enabled: true }
];

describe("selectRewardRule", () => {
  it("selects the highest priority matching rule", () => {
    expect(selectRewardRule(100, rules)?.id).toBe("rule-100");
    expect(selectRewardRule(20, rules)?.id).toBe("rule-20");
    expect(selectRewardRule(5, rules)?.id).toBe("rule-5");
    expect(selectRewardRule(40, rules)?.id).toBe("rule-20");
  });
});

describe("computeRewardRates", () => {
  it("computes effective rates with overlap", () => {
    const summary = computeRewardRates(rules, 100);
    const rates = new Map(summary.perRule.map((item) => [item.ruleId, item.effectiveRate]));
    expect(summary.totalRate).toBeCloseTo(0.2, 3);
    expect(rates.get("rule-100")).toBeCloseTo(0.01, 3);
    expect(rates.get("rule-20")).toBeCloseTo(0.04, 3);
    expect(rates.get("rule-5")).toBeCloseTo(0.15, 3);
  });
});

describe("isEligible", () => {
  it("respects min spend and store filters", () => {
    const config: CampaignConfig = {
      eligibility: { minSpend: 500, stores: ["store-1"] },
      rewardRules: [],
      competitionRule: { type: "none" }
    };
    const event: TransactionEvent = {
      transactionId: "tx-1",
      programId: "kfc",
      timestamp: new Date().toISOString(),
      amount: 400,
      storeId: "store-1"
    };
    const now = new Date();
    expect(isEligible(event, config, now).eligible).toBe(false);
    event.amount = 600;
    event.storeId = "store-2";
    expect(isEligible(event, config, now).eligible).toBe(false);
    event.storeId = "store-1";
    expect(isEligible(event, config, now).eligible).toBe(true);
  });
});
