import { createClient } from "@supabase/supabase-js";
import type {
  Campaign,
  LogsSnapshot,
  MessageAttempt,
  MessageTemplate,
  RewardIssue,
  RewardTemplate,
  TransactionEvent
} from "@/lib/types";

type SupabaseClient = ReturnType<typeof createClient>;

const globalForSupabase = globalThis as unknown as { supabaseAdmin?: SupabaseClient };

function getSupabaseAdmin(): SupabaseClient {
  if (globalForSupabase.supabaseAdmin) {
    return globalForSupabase.supabaseAdmin;
  }
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const apiKey = serviceKey ?? anonKey;
  if (!url || !apiKey) {
    throw new Error("Supabase env missing: set SUPABASE_URL and SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY.");
  }
  globalForSupabase.supabaseAdmin = createClient(url, apiKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return globalForSupabase.supabaseAdmin;
}

type CampaignRow = {
  id: string;
  name: string;
  retailer: string;
  status: string;
  start_at: string;
  end_at: string | null;
  probability: number;
  cap_window: string;
  cap_max: number;
  reward_template_ids: string[];
  message_template_id: string | null;
  created_at: string;
};

type RewardTemplateRow = {
  id: string;
  name: string;
  type: "voucher" | "free_item" | "percent_off";
  cvs_campaign_id: string | null;
  weight: number;
  created_at: string;
};

type MessageTemplateRow = {
  id: string;
  name: string;
  channel: "whatsapp" | "sms";
  body: string;
  fallback_body: string | null;
  created_at: string;
};

type EventRow = {
  id: string;
  reference: string;
  amount: number;
  store_ref: string;
  customer_ref: string;
  msisdn: string | null;
  created_at: string;
};

type RewardIssueRow = {
  id: string;
  event_id: string;
  campaign_id: string;
  reward_template_id: string;
  customer_ref: string;
  voucher_code: string;
  status: string;
  created_at: string;
};

type MessageAttemptRow = {
  id: string;
  event_id: string;
  reward_issue_id: string | null;
  channel: "whatsapp" | "sms";
  status: string;
  error: string | null;
  created_at: string;
};

function mapCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    name: row.name,
    retailer: row.retailer,
    status: row.status as Campaign["status"],
    startAt: row.start_at,
    endAt: row.end_at,
    probability: row.probability,
    capWindow: row.cap_window as Campaign["capWindow"],
    capMax: row.cap_max,
    rewardTemplateIds: row.reward_template_ids ?? [],
    messageTemplateId: row.message_template_id,
    createdAt: row.created_at
  };
}

function mapRewardTemplate(row: RewardTemplateRow): RewardTemplate {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    cvsCampaignId: row.cvs_campaign_id,
    weight: row.weight,
    createdAt: row.created_at
  };
}

function mapMessageTemplate(row: MessageTemplateRow): MessageTemplate {
  return {
    id: row.id,
    name: row.name,
    channel: row.channel,
    body: row.body,
    fallbackBody: row.fallback_body,
    createdAt: row.created_at
  };
}

function mapEvent(row: EventRow): TransactionEvent {
  return {
    id: row.id,
    reference: row.reference,
    amount: row.amount,
    storeRef: row.store_ref,
    customerRef: row.customer_ref,
    msisdn: row.msisdn,
    createdAt: row.created_at
  };
}

function mapRewardIssue(row: RewardIssueRow): RewardIssue {
  return {
    id: row.id,
    eventId: row.event_id,
    campaignId: row.campaign_id,
    rewardTemplateId: row.reward_template_id,
    customerRef: row.customer_ref,
    voucherCode: row.voucher_code,
    status: row.status as RewardIssue["status"],
    createdAt: row.created_at
  };
}

function mapMessageAttempt(row: MessageAttemptRow): MessageAttempt {
  return {
    id: row.id,
    eventId: row.event_id,
    rewardIssueId: row.reward_issue_id,
    channel: row.channel,
    status: row.status as MessageAttempt["status"],
    error: row.error,
    createdAt: row.created_at
  };
}

const LOG_LIMIT = 100;

export const supabaseStore = {
  async listCampaigns(): Promise<Campaign[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      throw new Error(`Failed to load campaigns: ${error.message}`);
    }
    return (data ?? []).map((row) => mapCampaign(row as CampaignRow));
  },
  async getCampaign(id: string): Promise<Campaign | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to load campaign: ${error.message}`);
    }
    return data ? mapCampaign(data as CampaignRow) : null;
  },
  async createCampaign(payload: Partial<Campaign>): Promise<Campaign> {
    const supabase = getSupabaseAdmin();
    const rewardTemplateIds =
      payload.rewardTemplateIds ?? (await this.listRewardTemplates()).map((reward) => reward.id);
    const messageTemplateId =
      payload.messageTemplateId ?? (await this.listMessageTemplates())[0]?.id ?? null;
    const now = new Date().toISOString();
    const insert = {
      name: payload.name ?? "New Loyalty Rule",
      retailer: payload.retailer ?? "YoYo Demo Retailer",
      status: payload.status ?? "draft",
      start_at: payload.startAt ?? now,
      end_at: payload.endAt ?? null,
      probability: payload.probability ?? 0.02,
      cap_window: payload.capWindow ?? "week",
      cap_max: payload.capMax ?? 1,
      reward_template_ids: rewardTemplateIds,
      message_template_id: messageTemplateId
    };
    const { data, error } = await supabase.from("campaigns").insert(insert).select("*").single();
    if (error) {
      throw new Error(`Failed to create campaign: ${error.message}`);
    }
    return mapCampaign(data as CampaignRow);
  },
  async updateCampaign(id: string, payload: Partial<Campaign>): Promise<Campaign | null> {
    const supabase = getSupabaseAdmin();
    const updates: Record<string, unknown> = {};
    if (payload.name !== undefined) updates.name = payload.name;
    if (payload.retailer !== undefined) updates.retailer = payload.retailer;
    if (payload.status !== undefined) updates.status = payload.status;
    if (payload.startAt !== undefined) updates.start_at = payload.startAt;
    if (payload.endAt !== undefined) updates.end_at = payload.endAt;
    if (payload.probability !== undefined) updates.probability = payload.probability;
    if (payload.capWindow !== undefined) updates.cap_window = payload.capWindow;
    if (payload.capMax !== undefined) updates.cap_max = payload.capMax;
    if (payload.rewardTemplateIds !== undefined) updates.reward_template_ids = payload.rewardTemplateIds;
    if (payload.messageTemplateId !== undefined) updates.message_template_id = payload.messageTemplateId;

    const { data, error } = await supabase
      .from("campaigns")
      .update(updates)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to update campaign: ${error.message}`);
    }
    return data ? mapCampaign(data as CampaignRow) : null;
  },
  async listRewardTemplates(): Promise<RewardTemplate[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("reward_templates")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      throw new Error(`Failed to load reward templates: ${error.message}`);
    }
    return (data ?? []).map((row) => mapRewardTemplate(row as RewardTemplateRow));
  },
  async createRewardTemplate(payload: Partial<RewardTemplate>): Promise<RewardTemplate> {
    const supabase = getSupabaseAdmin();
    const insert = {
      name: payload.name ?? "New Reward",
      type: payload.type ?? "voucher",
      cvs_campaign_id: payload.cvsCampaignId ?? null,
      weight: payload.weight ?? 50
    };
    const { data, error } = await supabase
      .from("reward_templates")
      .insert(insert)
      .select("*")
      .single();
    if (error) {
      throw new Error(`Failed to create reward template: ${error.message}`);
    }
    return mapRewardTemplate(data as RewardTemplateRow);
  },
  async listMessageTemplates(): Promise<MessageTemplate[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("message_templates")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      throw new Error(`Failed to load message templates: ${error.message}`);
    }
    return (data ?? []).map((row) => mapMessageTemplate(row as MessageTemplateRow));
  },
  async createMessageTemplate(payload: Partial<MessageTemplate>): Promise<MessageTemplate> {
    const supabase = getSupabaseAdmin();
    const insert = {
      name: payload.name ?? "New Message",
      channel: payload.channel ?? "whatsapp",
      body: payload.body ?? "You earned {{reward}}. Code: {{voucher}}",
      fallback_body: payload.fallbackBody ?? "You earned {{reward}}. Code: {{voucher}}"
    };
    const { data, error } = await supabase
      .from("message_templates")
      .insert(insert)
      .select("*")
      .single();
    if (error) {
      throw new Error(`Failed to create message template: ${error.message}`);
    }
    return mapMessageTemplate(data as MessageTemplateRow);
  },
  async addEvent(event: TransactionEvent): Promise<void> {
    const supabase = getSupabaseAdmin();
    const insert = {
      id: event.id,
      reference: event.reference,
      amount: event.amount,
      store_ref: event.storeRef,
      customer_ref: event.customerRef,
      msisdn: event.msisdn ?? null,
      created_at: event.createdAt
    };
    const { error } = await supabase.from("events").insert(insert);
    if (error) {
      throw new Error(`Failed to log event: ${error.message}`);
    }
  },
  async addRewardIssue(issue: RewardIssue): Promise<void> {
    const supabase = getSupabaseAdmin();
    const insert = {
      id: issue.id,
      event_id: issue.eventId,
      campaign_id: issue.campaignId,
      reward_template_id: issue.rewardTemplateId,
      customer_ref: issue.customerRef,
      voucher_code: issue.voucherCode,
      status: issue.status,
      created_at: issue.createdAt
    };
    const { error } = await supabase.from("reward_issues").insert(insert);
    if (error) {
      throw new Error(`Failed to log reward issue: ${error.message}`);
    }
  },
  async addMessageAttempt(attempt: MessageAttempt): Promise<void> {
    const supabase = getSupabaseAdmin();
    const insert = {
      id: attempt.id,
      event_id: attempt.eventId,
      reward_issue_id: attempt.rewardIssueId ?? null,
      channel: attempt.channel,
      status: attempt.status,
      error: attempt.error ?? null,
      created_at: attempt.createdAt
    };
    const { error } = await supabase.from("message_attempts").insert(insert);
    if (error) {
      throw new Error(`Failed to log message attempt: ${error.message}`);
    }
  },
  async listLogs(): Promise<LogsSnapshot> {
    const supabase = getSupabaseAdmin();
    const [eventsRes, rewardsRes, messagesRes] = await Promise.all([
      supabase.from("events").select("*").order("created_at", { ascending: false }).limit(LOG_LIMIT),
      supabase
        .from("reward_issues")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(LOG_LIMIT),
      supabase
        .from("message_attempts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(LOG_LIMIT)
    ]);
    if (eventsRes.error) {
      throw new Error(`Failed to load events: ${eventsRes.error.message}`);
    }
    if (rewardsRes.error) {
      throw new Error(`Failed to load reward issues: ${rewardsRes.error.message}`);
    }
    if (messagesRes.error) {
      throw new Error(`Failed to load message attempts: ${messagesRes.error.message}`);
    }
    return {
      events: (eventsRes.data ?? []).map((row) => mapEvent(row as EventRow)),
      rewardIssues: (rewardsRes.data ?? []).map((row) => mapRewardIssue(row as RewardIssueRow)),
      messageAttempts: (messagesRes.data ?? []).map((row) => mapMessageAttempt(row as MessageAttemptRow))
    };
  }
};
