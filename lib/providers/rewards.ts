import crypto from "crypto";

export type IssueRewardInput = {
  userRef: string;
  campaignId: string;
  templateId: string;
  metadata?: Record<string, string>;
};

export type IssueRewardResult = {
  voucherCode: string;
  expiresAt: string;
};

export type RewardsProvider = {
  issueReward: (input: IssueRewardInput) => Promise<IssueRewardResult>;
};

class MockRewardsProvider implements RewardsProvider {
  async issueReward(): Promise<IssueRewardResult> {
    const now = new Date();
    const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const voucherCode = crypto.randomUUID().split("-")[0].toUpperCase();
    return { voucherCode, expiresAt: expires.toISOString() };
  }
}

class LiveRewardsProvider implements RewardsProvider {
  async issueReward(): Promise<IssueRewardResult> {
    throw new Error("Live rewards provider not configured.");
  }
}

export function getRewardsProvider(): RewardsProvider {
  const mode = process.env.APP_MODE ?? "mock";
  if (mode === "live") {
    return new LiveRewardsProvider();
  }
  return new MockRewardsProvider();
}
