import { Campaign, Decision, RewardIssue, RewardTemplate, TransactionEvent } from "@/lib/types";
import { startOfDay, startOfWeek, weightedPick } from "@/lib/utils";

export type EvaluateOptions = {
  now?: Date;
  rng?: () => number;
};

export function evaluateCampaign(
  event: TransactionEvent,
  campaign: Campaign,
  rewardTemplates: RewardTemplate[],
  rewardIssues: RewardIssue[],
  options: EvaluateOptions = {}
): Decision {
  const now = options.now ?? new Date();
  const rng = options.rng ?? Math.random;
  const trace: Decision["trace"] = [];

  if (campaign.status !== "live") {
    trace.push({ step: "status", detail: `blocked: ${campaign.status}` });
    return { shouldIssue: false, reason: "campaign_not_live", trace };
  }

  const startAt = new Date(campaign.startAt);
  const endAt = campaign.endAt ? new Date(campaign.endAt) : null;
  if (now < startAt || (endAt && now > endAt)) {
    trace.push({ step: "schedule", detail: "outside_window" });
    return { shouldIssue: false, reason: "outside_window", trace };
  }
  trace.push({ step: "schedule", detail: "active" });

  const roll = rng();
  if (roll > campaign.probability) {
    trace.push({ step: "probability", detail: `miss (${roll.toFixed(3)})` });
    return { shouldIssue: false, reason: "probability_miss", trace };
  }
  trace.push({ step: "probability", detail: `hit (${roll.toFixed(3)})` });

  const windowStart = campaign.capWindow === "day" ? startOfDay(now) : startOfWeek(now);
  const issueCount = rewardIssues.filter((issue) => {
    return (
      issue.customerRef === event.customerRef &&
      new Date(issue.createdAt).getTime() >= windowStart.getTime()
    );
  }).length;

  if (issueCount >= campaign.capMax) {
    trace.push({ step: "cap", detail: `blocked (${issueCount}/${campaign.capMax})` });
    return { shouldIssue: false, reason: "cap_reached", trace };
  }
  trace.push({ step: "cap", detail: `ok (${issueCount}/${campaign.capMax})` });

  const eligibleRewards = rewardTemplates.filter((reward) =>
    campaign.rewardTemplateIds.includes(reward.id)
  );
  if (eligibleRewards.length === 0) {
    trace.push({ step: "reward", detail: "none_available" });
    return { shouldIssue: false, reason: "no_rewards", trace };
  }

  const picked = weightedPick(eligibleRewards, rng);
  if (!picked) {
    trace.push({ step: "reward", detail: "weights_invalid" });
    return { shouldIssue: false, reason: "invalid_weights", trace };
  }

  trace.push({ step: "reward", detail: `picked:${picked.name}` });
  return { shouldIssue: true, reason: "issued", rewardTemplateId: picked.id, trace };
}
