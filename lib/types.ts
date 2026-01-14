export type CampaignStatus = "draft" | "live" | "paused";
export type CampaignVersionStatus = "draft" | "published" | "archived";

export type RetailerProgram = {
  id: string;
  name: string;
  createdAt: string;
};

export type RewardTemplate = {
  id: string;
  name: string;
  type: "voucher" | "free_item" | "percent_off";
  cvsCampaignId?: string | null;
  weight: number;
  createdAt: string;
};

export type MessageTemplate = {
  id: string;
  name: string;
  channel: "whatsapp" | "sms";
  body: string;
  fallbackBody?: string | null;
  createdAt: string;
};

export type EligibilityWindow = {
  start: string;
  end: string;
};

export type EligibilityConfig = {
  minSpend?: number;
  stores?: string[];
  channels?: string[];
  daysOfWeek?: number[];
  timeWindows?: EligibilityWindow[];
  mccs?: string[];
};

export type RewardRuleConfig = {
  id: string;
  name: string;
  nth: number;
  rewardTemplateId: string;
  priority: number;
  enabled: boolean;
  dailyCap?: number | null;
  totalCap?: number | null;
  messageTemplateId?: string | null;
};

export type CompetitionRuleConfig = {
  type: "none" | "all_non_reward" | "probability" | "nth_non_reward";
  probability?: number;
  nth?: number;
  messageTemplateId?: string | null;
};

export type CampaignConfig = {
  eligibility: EligibilityConfig;
  rewardRules: RewardRuleConfig[];
  competitionRule: CompetitionRuleConfig;
};

export type CampaignVersion = {
  id: string;
  campaignId: string;
  version: number;
  status: CampaignVersionStatus;
  config: CampaignConfig;
  createdAt: string;
};

export type Campaign = {
  id: string;
  programId: string;
  name: string;
  status: CampaignStatus;
  startAt: string;
  endAt?: string | null;
  currentVersionId?: string | null;
  currentVersion?: CampaignVersion | null;
  createdAt: string;
  updatedAt: string;
};

export type TransactionEvent = {
  transactionId: string;
  programId: string;
  timestamp: string;
  amount: number;
  storeId: string;
  channel?: string | null;
  mcc?: string | null;
  eligibility?: Record<string, string | number | boolean | null>;
};

export type DecisionOutcomeType = "reward" | "no_reward";
export type DecisionStatus = "pending" | "issuing" | "issued" | "no_reward" | "issue_failed";

export type DecisionTraceStep = {
  step: string;
  detail: string;
};

export type DecisionLog = {
  id: string;
  transactionId: string;
  programId: string;
  campaignId?: string | null;
  campaignVersionId?: string | null;
  campaignVersionNumber?: number | null;
  storeId?: string | null;
  amount?: number | null;
  channel?: string | null;
  mcc?: string | null;
  occurredAt?: string | null;
  counterValue: number;
  matchedRuleId?: string | null;
  matchedRuleN?: number | null;
  matchedRulePriority?: number | null;
  rewardTemplateId?: string | null;
  rewardTemplateName?: string | null;
  outcomeType: DecisionOutcomeType;
  status: DecisionStatus;
  voucherCode?: string | null;
  cvsReference?: string | null;
  competitionEntry: boolean;
  messageTemplateId?: string | null;
  entryMessageTemplateId?: string | null;
  decisionTrace?: DecisionTraceStep[] | null;
  createdAt: string;
  updatedAt: string;
};

export type DecisionResult = {
  decision: DecisionLog;
  isDuplicate: boolean;
};

export type SimulatorOutcome = {
  counterValue: number;
  matchedRule?: RewardRuleConfig | null;
  rewardTemplate?: RewardTemplate | null;
  competitionEntry: boolean;
  competitionRuleType: CompetitionRuleConfig["type"];
};

export type LogsSnapshot = {
  decisions: DecisionLog[];
};
