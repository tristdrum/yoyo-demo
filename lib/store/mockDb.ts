import crypto from "crypto";
import {
  Campaign,
  LogsSnapshot,
  MessageAttempt,
  MessageTemplate,
  RewardIssue,
  RewardTemplate,
  TransactionEvent
} from "@/lib/types";
import { toIso } from "@/lib/utils";

export type MockDb = {
  campaigns: Campaign[];
  rewardTemplates: RewardTemplate[];
  messageTemplates: MessageTemplate[];
  events: TransactionEvent[];
  rewardIssues: RewardIssue[];
  messageAttempts: MessageAttempt[];
};

const globalForDb = globalThis as unknown as { __yoyoMockDb?: MockDb };

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function seedDb(): MockDb {
  const now = new Date();
  const rewardA: RewardTemplate = {
    id: createId("reward"),
    name: "Free pastry",
    type: "free_item",
    cvsCampaignId: "CVS-DEMO-PASTRY",
    weight: 70,
    createdAt: toIso(now)
  };
  const rewardB: RewardTemplate = {
    id: createId("reward"),
    name: "10% off next visit",
    type: "percent_off",
    cvsCampaignId: "CVS-DEMO-10OFF",
    weight: 30,
    createdAt: toIso(now)
  };
  const messageTemplate: MessageTemplate = {
    id: createId("message"),
    name: "Default WhatsApp",
    channel: "whatsapp",
    body: "You just unlocked {{reward}}. Show this code: {{voucher}}",
    fallbackBody: "You unlocked {{reward}}. Code: {{voucher}}",
    createdAt: toIso(now)
  };
  const campaign: Campaign = {
    id: createId("campaign"),
    name: "Surprise & Delight - Morning Rush",
    retailer: "Yoyo Demo Retailer",
    status: "live",
    startAt: toIso(now),
    endAt: null,
    probability: 0.02,
    capWindow: "week",
    capMax: 1,
    rewardTemplateIds: [rewardA.id, rewardB.id],
    messageTemplateId: messageTemplate.id,
    createdAt: toIso(now)
  };

  return {
    campaigns: [campaign],
    rewardTemplates: [rewardA, rewardB],
    messageTemplates: [messageTemplate],
    events: [],
    rewardIssues: [],
    messageAttempts: []
  };
}

function getDb(): MockDb {
  if (!globalForDb.__yoyoMockDb) {
    globalForDb.__yoyoMockDb = seedDb();
  }
  return globalForDb.__yoyoMockDb;
}

export const mockStore = {
  async listCampaigns(): Promise<Campaign[]> {
    return [...getDb().campaigns];
  },
  async getCampaign(id: string): Promise<Campaign | null> {
    return getDb().campaigns.find((campaign) => campaign.id === id) ?? null;
  },
  async createCampaign(payload: Partial<Campaign>): Promise<Campaign> {
    const now = new Date();
    const messageTemplate = getDb().messageTemplates[0];
    const rewardTemplates = getDb().rewardTemplates;
    const campaign: Campaign = {
      id: createId("campaign"),
      name: payload.name ?? "New Loyalty Rule",
      retailer: payload.retailer ?? "YoYo Demo Retailer",
      status: payload.status ?? "draft",
      startAt: payload.startAt ?? toIso(now),
      endAt: payload.endAt ?? null,
      probability: payload.probability ?? 0.02,
      capWindow: payload.capWindow ?? "week",
      capMax: payload.capMax ?? 1,
      rewardTemplateIds: payload.rewardTemplateIds ?? rewardTemplates.map((reward) => reward.id),
      messageTemplateId: payload.messageTemplateId ?? messageTemplate?.id ?? null,
      createdAt: toIso(now)
    };
    getDb().campaigns.unshift(campaign);
    return campaign;
  },
  async updateCampaign(id: string, payload: Partial<Campaign>): Promise<Campaign | null> {
    const db = getDb();
    const index = db.campaigns.findIndex((campaign) => campaign.id === id);
    if (index === -1) {
      return null;
    }
    const existing = db.campaigns[index];
    const updated: Campaign = {
      ...existing,
      ...payload,
      id: existing.id
    };
    db.campaigns[index] = updated;
    return updated;
  },
  async listRewardTemplates(): Promise<RewardTemplate[]> {
    return [...getDb().rewardTemplates];
  },
  async createRewardTemplate(payload: Partial<RewardTemplate>): Promise<RewardTemplate> {
    const now = new Date();
    const reward: RewardTemplate = {
      id: createId("reward"),
      name: payload.name ?? "New Reward",
      type: payload.type ?? "voucher",
      cvsCampaignId: payload.cvsCampaignId ?? null,
      weight: payload.weight ?? 50,
      createdAt: toIso(now)
    };
    getDb().rewardTemplates.unshift(reward);
    return reward;
  },
  async listMessageTemplates(): Promise<MessageTemplate[]> {
    return [...getDb().messageTemplates];
  },
  async createMessageTemplate(payload: Partial<MessageTemplate>): Promise<MessageTemplate> {
    const now = new Date();
    const message: MessageTemplate = {
      id: createId("message"),
      name: payload.name ?? "New Message",
      channel: payload.channel ?? "whatsapp",
      body: payload.body ?? "You earned {{reward}}. Code: {{voucher}}",
      fallbackBody: payload.fallbackBody ?? "You earned {{reward}}. Code: {{voucher}}",
      createdAt: toIso(now)
    };
    getDb().messageTemplates.unshift(message);
    return message;
  },
  async addEvent(event: TransactionEvent): Promise<void> {
    getDb().events.unshift(event);
  },
  async addRewardIssue(issue: RewardIssue): Promise<void> {
    getDb().rewardIssues.unshift(issue);
  },
  async addMessageAttempt(attempt: MessageAttempt): Promise<void> {
    getDb().messageAttempts.unshift(attempt);
  },
  async listLogs(): Promise<LogsSnapshot> {
    const db = getDb();
    return {
      events: [...db.events],
      rewardIssues: [...db.rewardIssues],
      messageAttempts: [...db.messageAttempts]
    };
  }
};
