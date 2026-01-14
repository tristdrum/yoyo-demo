import type {
  CampaignConfig,
  CompetitionRuleConfig,
  RewardRuleConfig,
  TransactionEvent
} from "@/lib/types";
import { isWithinTimeWindow, lcm } from "@/lib/utils";

export type RewardRateSummary = {
  ruleId: string;
  impliedRate: number;
  effectiveRate: number;
};

export type RewardRateTotals = {
  totalRate: number;
  perRule: RewardRateSummary[];
};

export function sortRewardRules(rules: RewardRuleConfig[]): RewardRuleConfig[] {
  return [...rules].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return b.nth - a.nth;
  });
}

export function selectRewardRule(counterValue: number, rules: RewardRuleConfig[]): RewardRuleConfig | null {
  if (!Number.isFinite(counterValue) || counterValue <= 0) {
    return null;
  }
  const sorted = sortRewardRules(rules).filter((rule) => rule.enabled && rule.nth > 0);
  for (const rule of sorted) {
    if (counterValue % rule.nth === 0) {
      return rule;
    }
  }
  return null;
}

export function computeRewardRates(
  rules: RewardRuleConfig[],
  sampleLimit = 10000
): RewardRateTotals {
  const active = rules.filter((rule) => rule.enabled && rule.nth > 0);
  if (active.length === 0) {
    return { totalRate: 0, perRule: [] };
  }
  const sorted = sortRewardRules(active);
  let cycle = sorted[0]?.nth ?? 1;
  for (const rule of sorted.slice(1)) {
    cycle = lcm(cycle, rule.nth);
    if (cycle > sampleLimit) {
      cycle = sampleLimit;
      break;
    }
  }
  const sampleSize = Math.max(cycle, 1);
  const counts = new Map<string, number>();
  for (const rule of sorted) {
    counts.set(rule.id, 0);
  }
  for (let i = 1; i <= sampleSize; i += 1) {
    for (const rule of sorted) {
      if (i % rule.nth === 0) {
        counts.set(rule.id, (counts.get(rule.id) ?? 0) + 1);
        break;
      }
    }
  }
  const perRule = sorted.map((rule) => {
    const count = counts.get(rule.id) ?? 0;
    const effectiveRate = count / sampleSize;
    const impliedRate = 1 / rule.nth;
    return { ruleId: rule.id, impliedRate, effectiveRate };
  });
  const totalRate = perRule.reduce((sum, item) => sum + item.effectiveRate, 0);
  return { totalRate, perRule };
}

export function isEligible(event: TransactionEvent, config: CampaignConfig, now: Date): {
  eligible: boolean;
  reason?: string;
} {
  const eligibility = config.eligibility ?? {};
  if (eligibility.minSpend && event.amount < eligibility.minSpend) {
    return { eligible: false, reason: "min_spend" };
  }
  if (eligibility.stores && eligibility.stores.length > 0) {
    if (!eligibility.stores.includes(event.storeId)) {
      return { eligible: false, reason: "store" };
    }
  }
  if (eligibility.channels && eligibility.channels.length > 0) {
    const channel = event.channel ?? "";
    if (!eligibility.channels.includes(channel)) {
      return { eligible: false, reason: "channel" };
    }
  }
  if (eligibility.mccs && eligibility.mccs.length > 0) {
    const mcc = event.mcc ?? "";
    if (!eligibility.mccs.includes(mcc)) {
      return { eligible: false, reason: "mcc" };
    }
  }
  if (eligibility.daysOfWeek && eligibility.daysOfWeek.length > 0) {
    const day = now.getDay();
    if (!eligibility.daysOfWeek.includes(day)) {
      return { eligible: false, reason: "day" };
    }
  }
  if (eligibility.timeWindows && eligibility.timeWindows.length > 0) {
    const within = eligibility.timeWindows.some((window) =>
      isWithinTimeWindow(now, window.start, window.end)
    );
    if (!within) {
      return { eligible: false, reason: "time_window" };
    }
  }
  return { eligible: true };
}

export function resolveCompetitionEntry(
  rule: CompetitionRuleConfig,
  nonRewardCounter: number | null,
  rng: () => number
): boolean {
  if (rule.type === "none") return false;
  if (rule.type === "all_non_reward") return true;
  if (rule.type === "probability") {
    const probability = Math.max(0, Math.min(rule.probability ?? 0, 1));
    return rng() <= probability;
  }
  if (rule.type === "nth_non_reward") {
    const nth = Math.max(1, Math.floor(rule.nth ?? 0));
    if (!nonRewardCounter || nth <= 0) return false;
    return nonRewardCounter % nth === 0;
  }
  return false;
}

export function buildDefaultConfig(): CampaignConfig {
  return {
    eligibility: {
      minSpend: 0,
      stores: [],
      channels: [],
      daysOfWeek: [],
      timeWindows: [],
      mccs: []
    },
    rewardRules: [],
    competitionRule: {
      type: "none"
    }
  };
}
