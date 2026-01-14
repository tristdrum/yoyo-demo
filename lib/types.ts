export type CampaignStatus = "draft" | "live" | "paused";
export type CapWindow = "day" | "week";

export type Campaign = {
  id: string;
  name: string;
  retailer: string;
  status: CampaignStatus;
  startAt: string;
  endAt?: string | null;
  probability: number;
  capWindow: CapWindow;
  capMax: number;
  rewardTemplateIds: string[];
  messageTemplateId?: string | null;
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

export type TransactionEvent = {
  id: string;
  reference: string;
  amount: number;
  storeRef: string;
  customerRef: string;
  msisdn?: string | null;
  createdAt: string;
};

export type RewardIssue = {
  id: string;
  eventId: string;
  campaignId: string;
  rewardTemplateId: string;
  customerRef: string;
  voucherCode: string;
  status: "issued" | "failed";
  createdAt: string;
};

export type MessageAttempt = {
  id: string;
  eventId: string;
  rewardIssueId?: string | null;
  channel: "whatsapp" | "sms";
  status: "sent" | "failed";
  error?: string | null;
  createdAt: string;
};

export type DecisionTraceStep = {
  step: string;
  detail: string;
};

export type Decision = {
  shouldIssue: boolean;
  reason: string;
  rewardTemplateId?: string;
  trace: DecisionTraceStep[];
};

export type LogsSnapshot = {
  events: TransactionEvent[];
  rewardIssues: RewardIssue[];
  messageAttempts: MessageAttempt[];
};
