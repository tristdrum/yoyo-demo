import crypto from "crypto";

export type IssueRewardInput = {
  userRef: string;
  templateId: string;
  cvsCampaignId?: string | null;
  transactionRef?: string;
  programId?: string;
  metadata?: {
    additionalInfo?: string;
    numExpiryDays?: number;
  };
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
  async issueReward(input: IssueRewardInput): Promise<IssueRewardResult> {
    const url =
      process.env.CVS_ISSUER_URL ??
      "https://za-vsp-int.wigroup.co/cvs-issuer/rest/coupons?issueWiCode=true";
    const apiId = process.env.CVS_ISSUER_API_ID;
    const apiPassword = process.env.CVS_ISSUER_API_PASSWORD;
    if (!apiId || !apiPassword) {
      throw new Error("CVS issuer credentials missing.");
    }
    const campaignId = Number(input.cvsCampaignId ?? "");
    if (!Number.isFinite(campaignId)) {
      throw new Error("CVS campaign ID missing or invalid.");
    }
    const fallbackExpiry = Number(process.env.CVS_ISSUER_NUM_EXPIRY_DAYS ?? "1");
    const rawExpiry =
      input.metadata?.numExpiryDays ??
      (Number.isFinite(fallbackExpiry) ? fallbackExpiry : 1);
    const numExpiryDays = Number.isFinite(rawExpiry) ? rawExpiry : 1;
    const body = {
      userRef: input.userRef,
      campaignId,
      additionalInfo:
        input.metadata?.additionalInfo ??
        [input.programId, input.transactionRef].filter(Boolean).join(":"),
      numExpiryDays
    };
    const response = await fetch(url, {
      method: "POST",
      headers: {
        apiId,
        apiPassword,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const raw = await response.text();
    const data = raw ? safeJsonParse(raw) : null;
    if (!response.ok) {
      throw new Error(`CVS issuer error ${response.status}: ${raw || response.statusText}`);
    }
    const voucherCode = extractVoucherCode(data);
    if (!voucherCode) {
      throw new Error("CVS issuer response missing voucher code.");
    }
    const expiresAt = extractExpiryDate(data) ?? addDaysIso(numExpiryDays);
    return { voucherCode, expiresAt };
  }
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function extractVoucherCode(data: unknown): string | null {
  if (!data || typeof data !== "object") {
    return null;
  }
  const record = data as Record<string, unknown>;
  const directKeys = [
    "wiCode",
    "voucherCode",
    "voucher_code",
    "code",
    "couponCode",
    "coupon_code",
    "couponNumber",
    "couponNo",
    "couponId",
    "coupon_id"
  ];
  for (const key of directKeys) {
    const value = record[key];
    if (value !== undefined && value !== null) {
      return String(value);
    }
  }
  const nested = [record.coupon, record.coupons, record.couponIssue].filter(Boolean);
  for (const value of nested) {
    if (Array.isArray(value) && value.length > 0) {
      const found = extractVoucherCode(value[0]);
      if (found) return found;
    } else if (typeof value === "object") {
      const found = extractVoucherCode(value);
      if (found) return found;
    }
  }
  return null;
}

function extractExpiryDate(data: unknown): string | null {
  if (!data || typeof data !== "object") {
    return null;
  }
  const record = data as Record<string, unknown>;
  const keys = ["expiryDate", "expiresAt", "expirationDate", "expiry", "expires_on"];
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
  }
  const nested = [record.coupon, record.coupons, record.couponIssue].filter(Boolean);
  for (const value of nested) {
    if (Array.isArray(value) && value.length > 0) {
      const found = extractExpiryDate(value[0]);
      if (found) return found;
    } else if (typeof value === "object") {
      const found = extractExpiryDate(value);
      if (found) return found;
    }
  }
  return null;
}

function addDaysIso(days: number): string {
  const safeDays = Number.isFinite(days) && days > 0 ? days : 1;
  const now = new Date();
  const expires = new Date(now.getTime() + safeDays * 24 * 60 * 60 * 1000);
  return expires.toISOString();
}

export function getRewardsProvider(): RewardsProvider {
  const mode = process.env.APP_MODE ?? "mock";
  if (mode === "live") {
    return new LiveRewardsProvider();
  }
  return new MockRewardsProvider();
}
