import { describe, expect, it } from "vitest";
import { evaluateCampaign } from "@/lib/evaluator";
import type { Campaign, RewardIssue, RewardTemplate, TransactionEvent } from "@/lib/types";

const baseCampaign: Campaign = {
  id: "campaign-1",
  name: "Test",
  retailer: "Retailer",
  status: "live",
  startAt: new Date("2026-01-01T00:00:00Z").toISOString(),
  endAt: null,
  probability: 1,
  capWindow: "week",
  capMax: 1,
  rewardTemplateIds: ["reward-1"],
  messageTemplateId: null,
  createdAt: new Date("2026-01-01T00:00:00Z").toISOString()
};

const rewardTemplates: RewardTemplate[] = [
  {
    id: "reward-1",
    name: "Test Reward",
    type: "voucher",
    cvsCampaignId: "CVS",
    weight: 100,
    createdAt: new Date("2026-01-01T00:00:00Z").toISOString()
  }
];

const event: TransactionEvent = {
  id: "event-1",
  reference: "ref-1",
  amount: 2000,
  storeRef: "store-1",
  customerRef: "alias-1",
  createdAt: new Date("2026-01-02T00:00:00Z").toISOString()
};

describe("evaluateCampaign", () => {
  it("issues when probability is hit", () => {
    const decision = evaluateCampaign(event, baseCampaign, rewardTemplates, [], {
      now: new Date("2026-01-02T00:00:00Z"),
      rng: () => 0.1
    });
    expect(decision.shouldIssue).toBe(true);
    expect(decision.rewardTemplateId).toBe("reward-1");
  });

  it("blocks when probability misses", () => {
    const decision = evaluateCampaign(
      event,
      { ...baseCampaign, probability: 0.2 },
      rewardTemplates,
      [],
      { now: new Date("2026-01-02T00:00:00Z"), rng: () => 0.9 }
    );
    expect(decision.shouldIssue).toBe(false);
    expect(decision.reason).toBe("probability_miss");
  });

  it("blocks when cap is reached", () => {
    const issues: RewardIssue[] = [
      {
        id: "issue-1",
        eventId: "event-0",
        campaignId: "campaign-1",
        rewardTemplateId: "reward-1",
        customerRef: "alias-1",
        voucherCode: "CODE",
        status: "issued",
        createdAt: new Date("2026-01-02T01:00:00Z").toISOString()
      }
    ];

    const decision = evaluateCampaign(event, baseCampaign, rewardTemplates, issues, {
      now: new Date("2026-01-02T02:00:00Z"),
      rng: () => 0.1
    });
    expect(decision.shouldIssue).toBe(false);
    expect(decision.reason).toBe("cap_reached");
  });
});
