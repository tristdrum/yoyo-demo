import { getRewardsProvider } from "@/lib/providers/rewards";
import { getStore } from "@/lib/store";
import { isEligible, resolveCompetitionEntry, selectRewardRule } from "@/lib/ruleEngine";
import type {
  Campaign,
  CampaignConfig,
  DecisionLog,
  DecisionTraceStep,
  RewardRuleConfig,
  RewardTemplate,
  TransactionEvent
} from "@/lib/types";
import { startOfDay, toIso } from "@/lib/utils";

export type RuleEngineResponse = {
  decision: DecisionLog;
  isDuplicate: boolean;
  reason: string;
  reward?: {
    templateId: string;
    templateName: string;
    voucherCode?: string | null;
    status: "issued" | "failed";
  } | null;
  competitionEntry?: {
    granted: boolean;
    messageTemplateId?: string | null;
  } | null;
  trace: DecisionTraceStep[];
};

type ProcessOptions = {
  now?: Date;
  rng?: () => number;
};

function getCampaignWindowState(campaign: Campaign, now: Date): { active: boolean; reason?: string } {
  const startAt = new Date(campaign.startAt);
  const endAt = campaign.endAt ? new Date(campaign.endAt) : null;
  if (now < startAt) return { active: false, reason: "before_start" };
  if (endAt && now > endAt) return { active: false, reason: "after_end" };
  return { active: true };
}

function resolveRewardTemplate(
  rewardTemplates: RewardTemplate[],
  rule: RewardRuleConfig
): RewardTemplate | null {
  return rewardTemplates.find((template) => template.id === rule.rewardTemplateId) ?? null;
}

async function shouldSkipForCaps(
  campaignVersionId: string,
  rule: RewardRuleConfig,
  now: Date
): Promise<{ blocked: boolean; detail?: string }> {
  if (!rule.dailyCap && !rule.totalCap) {
    return { blocked: false };
  }
  const store = getStore();
  if (rule.totalCap) {
    const total = await store.countRuleWins(campaignVersionId, rule.id);
    if (total >= rule.totalCap) {
      return { blocked: true, detail: `total_cap (${total}/${rule.totalCap})` };
    }
  }
  if (rule.dailyCap) {
    const start = toIso(startOfDay(now));
    const daily = await store.countRuleWins(campaignVersionId, rule.id, start);
    if (daily >= rule.dailyCap) {
      return { blocked: true, detail: `daily_cap (${daily}/${rule.dailyCap})` };
    }
  }
  return { blocked: false };
}

export async function processTransaction(
  event: TransactionEvent,
  options: ProcessOptions = {}
): Promise<RuleEngineResponse> {
  const store = getStore();
  const parsed = new Date(event.timestamp);
  const now = options.now ?? (Number.isNaN(parsed.getTime()) ? new Date() : parsed);
  const rng = options.rng ?? Math.random;
  const trace: DecisionTraceStep[] = [];

  const existing = await store.getDecisionByTransactionId(event.transactionId);
  if (existing && existing.status !== "issue_failed") {
    return {
      decision: existing,
      isDuplicate: true,
      reason: "duplicate",
      reward: existing.rewardTemplateId ?
        {
          templateId: existing.rewardTemplateId,
          templateName: existing.rewardTemplateName ?? "",
          voucherCode: existing.voucherCode,
          status: existing.status === "issued" ? "issued" : "failed"
        } :
        null,
      competitionEntry: {
        granted: existing.competitionEntry,
        messageTemplateId: existing.entryMessageTemplateId
      },
      trace: existing.decisionTrace ?? []
    };
  }

  await store.ensureProgram(event.programId);

  const campaign = await store.getActiveCampaignForProgram(event.programId);
  if (!campaign || !campaign.currentVersion) {
    trace.push({ step: "campaign", detail: "no_active_campaign" });
    const decision = await store.createDecision({
      transactionId: event.transactionId,
      programId: event.programId,
      storeId: event.storeId,
      amount: event.amount,
      channel: event.channel ?? null,
      mcc: event.mcc ?? null,
      occurredAt: event.timestamp,
      counterValue: 0,
      outcomeType: "no_reward",
      status: "no_reward",
      decisionTrace: trace,
      eventPayload: event as unknown as Record<string, unknown>
    });
    return {
      decision,
      isDuplicate: false,
      reason: "no_active_campaign",
      reward: null,
      competitionEntry: { granted: false },
      trace
    };
  }

  const windowState = getCampaignWindowState(campaign, now);
  if (!windowState.active) {
    trace.push({ step: "schedule", detail: windowState.reason ?? "inactive" });
    const decision = await store.createDecision({
      transactionId: event.transactionId,
      programId: event.programId,
      campaignId: campaign.id,
      campaignVersionId: campaign.currentVersion.id,
      campaignVersionNumber: campaign.currentVersion.version,
      storeId: event.storeId,
      amount: event.amount,
      channel: event.channel ?? null,
      mcc: event.mcc ?? null,
      occurredAt: event.timestamp,
      counterValue: 0,
      outcomeType: "no_reward",
      status: "no_reward",
      decisionTrace: trace,
      eventPayload: event as unknown as Record<string, unknown>
    });
    return {
      decision,
      isDuplicate: false,
      reason: "outside_window",
      reward: null,
      competitionEntry: { granted: false },
      trace
    };
  }
  trace.push({ step: "schedule", detail: "active" });

  const config = campaign.currentVersion.config;
  const eligibility = isEligible(event, config, now);
  if (!eligibility.eligible) {
    trace.push({ step: "eligibility", detail: `blocked:${eligibility.reason ?? "unknown"}` });
    const decision = await store.createDecision({
      transactionId: event.transactionId,
      programId: event.programId,
      campaignId: campaign.id,
      campaignVersionId: campaign.currentVersion.id,
      campaignVersionNumber: campaign.currentVersion.version,
      storeId: event.storeId,
      amount: event.amount,
      channel: event.channel ?? null,
      mcc: event.mcc ?? null,
      occurredAt: event.timestamp,
      counterValue: 0,
      outcomeType: "no_reward",
      status: "no_reward",
      decisionTrace: trace,
      eventPayload: event as unknown as Record<string, unknown>
    });
    return {
      decision,
      isDuplicate: false,
      reason: "ineligible",
      reward: null,
      competitionEntry: { granted: false },
      trace
    };
  }
  trace.push({ step: "eligibility", detail: "eligible" });

  const reservation = await store.reserveDecision({
    transactionId: event.transactionId,
    programId: event.programId,
    campaignId: campaign.id,
    campaignVersionId: campaign.currentVersion.id,
    campaignVersionNumber: campaign.currentVersion.version,
    storeId: event.storeId,
    amount: event.amount,
    channel: event.channel ?? null,
    mcc: event.mcc ?? null,
    occurredAt: event.timestamp,
    eventPayload: event as unknown as Record<string, unknown>
  });

  const decision = reservation.decision;
  if (reservation.isDuplicate && ["issued", "no_reward"].includes(decision.status)) {
    return {
      decision,
      isDuplicate: true,
      reason: "duplicate",
      reward: decision.rewardTemplateId ?
        {
          templateId: decision.rewardTemplateId,
          templateName: decision.rewardTemplateName ?? "",
          voucherCode: decision.voucherCode,
          status: decision.status === "issued" ? "issued" : "failed"
        } :
        null,
      competitionEntry: {
        granted: decision.competitionEntry,
        messageTemplateId: decision.entryMessageTemplateId
      },
      trace: decision.decisionTrace ?? []
    };
  }

  trace.push({ step: "counter", detail: String(decision.counterValue) });

  if (decision.status === "issue_failed" && decision.rewardTemplateId) {
    trace.push({ step: "retry", detail: "issue_failed" });
    const claim = await store.claimDecision(decision.id, ["issue_failed"]);
    if (!claim) {
      const latest = await store.getDecision(decision.id);
      if (!latest) {
        throw new Error("Decision retry failed: record missing.");
      }
      return {
        decision: latest,
        isDuplicate: true,
        reason: "claimed_elsewhere",
        reward: latest.rewardTemplateId ?
          {
            templateId: latest.rewardTemplateId,
            templateName: latest.rewardTemplateName ?? "",
            voucherCode: latest.voucherCode,
            status: latest.status === "issued" ? "issued" : "failed"
          } :
          null,
        competitionEntry: {
          granted: latest.competitionEntry,
          messageTemplateId: latest.entryMessageTemplateId
        },
        trace: latest.decisionTrace ?? []
      };
    }

    const rewardTemplates = await store.listRewardTemplates();
    const rewardTemplate = rewardTemplates.find((template) => template.id === decision.rewardTemplateId);
    if (!rewardTemplate) {
      trace.push({ step: "reward", detail: "template_missing" });
      const updated = await store.updateDecision(decision.id, {
        status: "issue_failed",
        decisionTrace: trace
      });
      if (!updated) {
        throw new Error("Failed to update decision for missing template.");
      }
      return {
        decision: updated,
        isDuplicate: true,
        reason: "template_missing",
        reward: {
          templateId: decision.rewardTemplateId,
          templateName: decision.rewardTemplateName ?? "",
          voucherCode: null,
          status: "failed"
        },
        competitionEntry: { granted: false },
        trace
      };
    }

    const rewardsProvider = getRewardsProvider();
    try {
      const result = await rewardsProvider.issueReward({
        userRef: event.transactionId,
        templateId: decision.rewardTemplateId,
        cvsCampaignId: rewardTemplate.cvsCampaignId ?? null,
        transactionRef: event.transactionId,
        programId: event.programId,
        metadata: {
          additionalInfo: `${event.programId}:${event.transactionId}`
        }
      });
      trace.push({ step: "cvs", detail: "issued" });
      const updated = await store.updateDecision(decision.id, {
        status: "issued",
        outcomeType: "reward",
        rewardTemplateName: rewardTemplate.name,
        voucherCode: result.voucherCode,
        competitionEntry: false,
        decisionTrace: trace
      });
      if (!updated) {
        throw new Error("Failed to update decision after retry issuance.");
      }
      return {
        decision: updated,
        isDuplicate: true,
        reason: "reward_issued",
        reward: {
          templateId: rewardTemplate.id,
          templateName: rewardTemplate.name,
          voucherCode: result.voucherCode,
          status: "issued"
        },
        competitionEntry: { granted: false },
        trace
      };
    } catch (error) {
      trace.push({ step: "cvs", detail: `failed:${(error as Error).message}` });
      const updated = await store.updateDecision(decision.id, {
        status: "issue_failed",
        decisionTrace: trace
      });
      if (!updated) {
        throw new Error("Failed to update decision after retry failure.");
      }
      return {
        decision: updated,
        isDuplicate: true,
        reason: "issue_failed",
        reward: {
          templateId: rewardTemplate.id,
          templateName: rewardTemplate.name,
          voucherCode: null,
          status: "failed"
        },
        competitionEntry: { granted: false },
        trace
      };
    }
  }

  const matchedRule = selectRewardRule(decision.counterValue, config.rewardRules);
  if (!matchedRule) {
    trace.push({ step: "rule", detail: "no_match" });
    return await finalizeNoReward({
      decisionId: decision.id,
      campaign,
      config,
      trace,
      rng
    });
  }

  trace.push({ step: "rule", detail: `${matchedRule.name} (${matchedRule.nth})` });
  const capCheck = await shouldSkipForCaps(campaign.currentVersion.id, matchedRule, now);
  if (capCheck.blocked) {
    trace.push({ step: "cap", detail: capCheck.detail ?? "blocked" });
    return await finalizeNoReward({
      decisionId: decision.id,
      campaign,
      config,
      trace,
      rng,
      matchedRule
    });
  }
  trace.push({ step: "cap", detail: "ok" });

  const claim = await store.claimDecision(decision.id);
  if (!claim) {
    const latest = await store.getDecision(decision.id);
    if (!latest) {
      throw new Error("Decision claim failed: record missing.");
    }
    return {
      decision: latest,
      isDuplicate: true,
      reason: "claimed_elsewhere",
      reward: latest.rewardTemplateId ?
        {
          templateId: latest.rewardTemplateId,
          templateName: latest.rewardTemplateName ?? "",
          voucherCode: latest.voucherCode,
          status: latest.status === "issued" ? "issued" : "failed"
        } :
        null,
      competitionEntry: {
        granted: latest.competitionEntry,
        messageTemplateId: latest.entryMessageTemplateId
      },
      trace: latest.decisionTrace ?? []
    };
  }

  const rewardTemplates = await store.listRewardTemplates();
  const rewardTemplate = resolveRewardTemplate(rewardTemplates, matchedRule);
  if (!rewardTemplate) {
    trace.push({ step: "reward", detail: "template_missing" });
    const updated = await store.updateDecision(decision.id, {
      status: "issue_failed",
      outcomeType: "reward",
      matchedRuleId: matchedRule.id,
      matchedRuleN: matchedRule.nth,
      matchedRulePriority: matchedRule.priority,
      decisionTrace: trace
    });
    if (!updated) {
      throw new Error("Failed to update decision for missing template.");
    }
    return {
      decision: updated,
      isDuplicate: reservation.isDuplicate,
      reason: "template_missing",
      reward: {
        templateId: matchedRule.rewardTemplateId,
        templateName: matchedRule.name,
        voucherCode: null,
        status: "failed"
      },
      competitionEntry: { granted: false },
      trace
    };
  }

  const rewardsProvider = getRewardsProvider();
  try {
    const result = await rewardsProvider.issueReward({
      userRef: event.transactionId,
      templateId: matchedRule.rewardTemplateId,
      cvsCampaignId: rewardTemplate.cvsCampaignId ?? null,
      transactionRef: event.transactionId,
      programId: event.programId,
      metadata: {
        additionalInfo: `${event.programId}:${event.transactionId}`
      }
    });
    trace.push({ step: "cvs", detail: "issued" });
    const updated = await store.updateDecision(decision.id, {
      status: "issued",
      outcomeType: "reward",
      matchedRuleId: matchedRule.id,
      matchedRuleN: matchedRule.nth,
      matchedRulePriority: matchedRule.priority,
      rewardTemplateId: rewardTemplate.id,
      rewardTemplateName: rewardTemplate.name,
      voucherCode: result.voucherCode,
      competitionEntry: false,
      messageTemplateId: matchedRule.messageTemplateId ?? null,
      decisionTrace: trace
    });
    if (!updated) {
      throw new Error("Failed to update decision after issuance.");
    }
    return {
      decision: updated,
      isDuplicate: reservation.isDuplicate,
      reason: "reward_issued",
      reward: {
        templateId: rewardTemplate.id,
        templateName: rewardTemplate.name,
        voucherCode: result.voucherCode,
        status: "issued"
      },
      competitionEntry: { granted: false },
      trace
    };
  } catch (error) {
    trace.push({ step: "cvs", detail: `failed:${(error as Error).message}` });
    const updated = await store.updateDecision(decision.id, {
      status: "issue_failed",
      outcomeType: "reward",
      matchedRuleId: matchedRule.id,
      matchedRuleN: matchedRule.nth,
      matchedRulePriority: matchedRule.priority,
      rewardTemplateId: rewardTemplate.id,
      rewardTemplateName: rewardTemplate.name,
      competitionEntry: false,
      decisionTrace: trace
    });
    if (!updated) {
      throw new Error("Failed to update decision after CVS failure.");
    }
    return {
      decision: updated,
      isDuplicate: reservation.isDuplicate,
      reason: "issue_failed",
      reward: {
        templateId: rewardTemplate.id,
        templateName: rewardTemplate.name,
        voucherCode: null,
        status: "failed"
      },
      competitionEntry: { granted: false },
      trace
    };
  }
}

async function finalizeNoReward(params: {
  decisionId: string;
  campaign: Campaign;
  config: CampaignConfig;
  trace: DecisionTraceStep[];
  rng: () => number;
  matchedRule?: RewardRuleConfig;
}): Promise<RuleEngineResponse> {
  const store = getStore();
  const competitionRule = params.config.competitionRule;
  let nonRewardCounter: number | null = null;
  if (competitionRule.type === "nth_non_reward") {
    const versionId = params.campaign.currentVersion?.id;
    if (versionId) {
      nonRewardCounter = await store.incrementNonRewardCounter(versionId);
      params.trace.push({ step: "entry_counter", detail: String(nonRewardCounter) });
    }
  }
  const entryGranted = resolveCompetitionEntry(competitionRule, nonRewardCounter, params.rng);
  params.trace.push({
    step: "competition_entry",
    detail: entryGranted ? "granted" : "not_granted"
  });
  const updated = await store.updateDecision(params.decisionId, {
    status: "no_reward",
    outcomeType: "no_reward",
    competitionEntry: entryGranted,
    matchedRuleId: params.matchedRule?.id ?? null,
    matchedRuleN: params.matchedRule?.nth ?? null,
    matchedRulePriority: params.matchedRule?.priority ?? null,
    entryMessageTemplateId: params.config.competitionRule.messageTemplateId ?? null,
    decisionTrace: params.trace
  });
  if (!updated) {
    throw new Error("Failed to update decision for non-reward outcome.");
  }
  return {
    decision: updated,
    isDuplicate: false,
    reason: params.matchedRule ? "rule_capped" : "no_reward_rule",
    reward: null,
    competitionEntry: {
      granted: entryGranted,
      messageTemplateId: params.config.competitionRule.messageTemplateId ?? null
    },
    trace: params.trace
  };
}
