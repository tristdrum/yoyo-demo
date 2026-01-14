import type { CampaignConfig, RewardRuleConfig, RewardTemplate } from "@/lib/types";
import { computeRewardRates, selectRewardRule } from "@/lib/ruleEngine";

export type PreviewResult = {
  counterValue: number;
  matchedRule: RewardRuleConfig | null;
  rewardTemplate: RewardTemplate | null;
  rewardRates: ReturnType<typeof computeRewardRates>;
};

export type BatchSimulationResult = {
  counterStart: number;
  count: number;
  rewardCounts: Array<{ id: string; name: string; nth: number; count: number }>;
  totalRewards: number;
  nonRewardCount: number;
  expectedCompetitionEntries: number;
  rewardRates: ReturnType<typeof computeRewardRates>;
};

export function previewDecision(
  counterValue: number,
  config: CampaignConfig,
  rewardTemplates: RewardTemplate[]
): PreviewResult {
  const matchedRule = selectRewardRule(counterValue, config.rewardRules);
  const rewardTemplate =
    matchedRule ?
      rewardTemplates.find((template) => template.id === matchedRule.rewardTemplateId) ?? null :
      null;
  return {
    counterValue,
    matchedRule,
    rewardTemplate,
    rewardRates: computeRewardRates(config.rewardRules)
  };
}

export function simulateBatch(
  counterStart: number,
  count: number,
  config: CampaignConfig,
  nonRewardCounterStart = 0
): BatchSimulationResult {
  const rewardCounts: Record<string, number> = {};
  let totalRewards = 0;
  let nonRewardCount = 0;
  let nonRewardCounter = nonRewardCounterStart;
  for (let i = 1; i <= count; i += 1) {
    const counterValue = counterStart + i;
    const rule = selectRewardRule(counterValue, config.rewardRules);
    if (rule) {
      rewardCounts[rule.id] = (rewardCounts[rule.id] ?? 0) + 1;
      totalRewards += 1;
    } else {
      nonRewardCount += 1;
      nonRewardCounter += 1;
    }
  }
  const competitionRule = config.competitionRule;
  let expectedCompetitionEntries = 0;
  if (competitionRule.type === "all_non_reward") {
    expectedCompetitionEntries = nonRewardCount;
  } else if (competitionRule.type === "probability") {
    expectedCompetitionEntries = nonRewardCount * Math.max(0, Math.min(competitionRule.probability ?? 0, 1));
  } else if (competitionRule.type === "nth_non_reward") {
    const nth = Math.max(1, Math.floor(competitionRule.nth ?? 0));
    if (nth > 0) {
      expectedCompetitionEntries = Math.floor(nonRewardCounter / nth) - Math.floor(nonRewardCounterStart / nth);
    }
  }

  const rewardCountList = config.rewardRules.map((rule) => ({
    id: rule.id,
    name: rule.name,
    nth: rule.nth,
    count: rewardCounts[rule.id] ?? 0
  }));

  return {
    counterStart,
    count,
    rewardCounts: rewardCountList,
    totalRewards,
    nonRewardCount,
    expectedCompetitionEntries,
    rewardRates: computeRewardRates(config.rewardRules)
  };
}
