import { createClient } from "@supabase/supabase-js";
import { buildDefaultConfig } from "@/lib/ruleEngine";
import type {
  Campaign,
  CampaignConfig,
  CampaignVersion,
  DecisionLog,
  DecisionResult,
  MessageTemplate,
  RewardTemplate,
  RetailerProgram
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

type ProgramRow = {
  id: string;
  name: string;
  created_at: string;
};

type CampaignRow = {
  id: string;
  program_id: string;
  name: string;
  status: string;
  start_at: string;
  end_at: string | null;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
};

type CampaignVersionRow = {
  id: string;
  campaign_id: string;
  version: number;
  status: string;
  config: CampaignConfig;
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

type DecisionRow = {
  id: string;
  transaction_id: string;
  program_id: string;
  campaign_id: string | null;
  campaign_version_id: string | null;
  campaign_version_number: number | null;
  store_id: string | null;
  amount: number | null;
  channel: string | null;
  mcc: string | null;
  occurred_at: string | null;
  counter_value: number;
  matched_rule_id: string | null;
  matched_rule_n: number | null;
  matched_rule_priority: number | null;
  reward_template_id: string | null;
  reward_template_name: string | null;
  outcome_type: string;
  status: string;
  voucher_code: string | null;
  cvs_reference: string | null;
  competition_entry: boolean;
  message_template_id: string | null;
  entry_message_template_id: string | null;
  decision_trace: DecisionLog["decisionTrace"] | null;
  event_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type ReserveDecisionRow = {
  id: string;
  transaction_id: string;
  program_id: string;
  campaign_id: string | null;
  campaign_version_id: string | null;
  campaign_version_number: number | null;
  counter_value: number;
  status: string;
  outcome_type: string;
  reward_template_id: string | null;
  matched_rule_id: string | null;
  competition_entry: boolean;
  voucher_code: string | null;
  is_duplicate: boolean;
};

function mapProgram(row: ProgramRow): RetailerProgram {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at
  };
}

function mapCampaign(row: CampaignRow, version?: CampaignVersion | null): Campaign {
  return {
    id: row.id,
    programId: row.program_id,
    name: row.name,
    status: row.status as Campaign["status"],
    startAt: row.start_at,
    endAt: row.end_at,
    currentVersionId: row.current_version_id,
    currentVersion: version ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapCampaignVersion(row: CampaignVersionRow): CampaignVersion {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    version: row.version,
    status: row.status as CampaignVersion["status"],
    config: row.config,
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

function mapDecision(row: DecisionRow): DecisionLog {
  return {
    id: row.id,
    transactionId: row.transaction_id,
    programId: row.program_id,
    campaignId: row.campaign_id,
    campaignVersionId: row.campaign_version_id,
    campaignVersionNumber: row.campaign_version_number,
    storeId: row.store_id,
    amount: row.amount,
    channel: row.channel,
    mcc: row.mcc,
    occurredAt: row.occurred_at,
    counterValue: row.counter_value,
    matchedRuleId: row.matched_rule_id,
    matchedRuleN: row.matched_rule_n,
    matchedRulePriority: row.matched_rule_priority,
    rewardTemplateId: row.reward_template_id,
    rewardTemplateName: row.reward_template_name,
    outcomeType: row.outcome_type as DecisionLog["outcomeType"],
    status: row.status as DecisionLog["status"],
    voucherCode: row.voucher_code,
    cvsReference: row.cvs_reference,
    competitionEntry: row.competition_entry,
    messageTemplateId: row.message_template_id,
    entryMessageTemplateId: row.entry_message_template_id,
    decisionTrace: row.decision_trace,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const LOG_LIMIT = 200;

export const supabaseStore = {
  async listPrograms(): Promise<RetailerProgram[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("sd_programs").select("*").order("name");
    if (error) {
      throw new Error(`Failed to load programs: ${error.message}`);
    }
    return (data ?? []).map((row) => mapProgram(row as ProgramRow));
  },
  async createProgram(payload: Partial<RetailerProgram>): Promise<RetailerProgram> {
    const supabase = getSupabaseAdmin();
    const insert = {
      id: payload.id ?? `program-${Date.now()}`,
      name: payload.name ?? "New Program"
    };
    const { data, error } = await supabase.from("sd_programs").insert(insert).select("*").single();
    if (error) {
      throw new Error(`Failed to create program: ${error.message}`);
    }
    return mapProgram(data as ProgramRow);
  },
  async ensureProgram(programId: string, name?: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    const insert = { id: programId, name: name ?? programId };
    const { error } = await supabase
      .from("sd_programs")
      .upsert(insert, { onConflict: "id", ignoreDuplicates: true });
    if (error) {
      throw new Error(`Failed to ensure program: ${error.message}`);
    }
  },
  async listCampaigns(): Promise<Campaign[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("sd_campaigns")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) {
      throw new Error(`Failed to load campaigns: ${error.message}`);
    }
    const rows = (data ?? []) as CampaignRow[];
    const versionIds = rows.map((row) => row.current_version_id).filter(Boolean) as string[];
    const versionsById = await this.listCampaignVersionsById(versionIds);
    return rows.map((row) => mapCampaign(row, versionsById.get(row.current_version_id ?? "") ?? null));
  },
  async getCampaign(id: string): Promise<Campaign | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("sd_campaigns").select("*").eq("id", id).maybeSingle();
    if (error) {
      throw new Error(`Failed to load campaign: ${error.message}`);
    }
    if (!data) return null;
    const row = data as CampaignRow;
    const version = row.current_version_id ? await this.getCampaignVersion(row.current_version_id) : null;
    return mapCampaign(row, version);
  },
  async getActiveCampaignForProgram(programId: string): Promise<Campaign | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("sd_campaigns")
      .select("*")
      .eq("program_id", programId)
      .eq("status", "live")
      .order("updated_at", { ascending: false })
      .limit(1);
    if (error) {
      throw new Error(`Failed to load active campaign: ${error.message}`);
    }
    const row = (data ?? [])[0] as CampaignRow | undefined;
    if (!row) return null;
    const version = row.current_version_id ? await this.getCampaignVersion(row.current_version_id) : null;
    return mapCampaign(row, version);
  },
  async createCampaign(payload: Partial<Campaign>): Promise<Campaign> {
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();
    const programId = payload.programId ?? "kfc";
    await this.ensureProgram(programId, payload.programId ?? "Program");
    const insert = {
      program_id: programId,
      name: payload.name ?? "New Surprise & Delight Campaign",
      status: payload.status ?? "draft",
      start_at: payload.startAt ?? now,
      end_at: payload.endAt ?? null
    };
    const { data, error } = await supabase.from("sd_campaigns").insert(insert).select("*").single();
    if (error) {
      throw new Error(`Failed to create campaign: ${error.message}`);
    }
    const campaignRow = data as CampaignRow;
    const version = await this.createCampaignVersion(campaignRow.id, buildDefaultConfig(), "draft");
    await this.updateCampaign(campaignRow.id, { currentVersionId: version.id });
    return mapCampaign({ ...campaignRow, current_version_id: version.id }, version);
  },
  async updateCampaign(id: string, payload: Partial<Campaign>): Promise<Campaign | null> {
    const supabase = getSupabaseAdmin();
    const updates: Record<string, unknown> = {};
    if (payload.name !== undefined) updates.name = payload.name;
    if (payload.programId !== undefined) updates.program_id = payload.programId;
    if (payload.status !== undefined) updates.status = payload.status;
    if (payload.startAt !== undefined) updates.start_at = payload.startAt;
    if (payload.endAt !== undefined) updates.end_at = payload.endAt;
    if (payload.currentVersionId !== undefined) updates.current_version_id = payload.currentVersionId;
    updates.updated_at = new Date().toISOString();
    const { data, error } = await supabase
      .from("sd_campaigns")
      .update(updates)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to update campaign: ${error.message}`);
    }
    if (!data) return null;
    const row = data as CampaignRow;
    const version = row.current_version_id ? await this.getCampaignVersion(row.current_version_id) : null;
    return mapCampaign(row, version);
  },
  async listCampaignVersions(campaignId: string): Promise<CampaignVersion[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("sd_campaign_versions")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("version", { ascending: false });
    if (error) {
      throw new Error(`Failed to load campaign versions: ${error.message}`);
    }
    return (data ?? []).map((row) => mapCampaignVersion(row as CampaignVersionRow));
  },
  async listCampaignVersionsById(versionIds: string[]): Promise<Map<string, CampaignVersion>> {
    if (versionIds.length === 0) return new Map();
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("sd_campaign_versions")
      .select("*")
      .in("id", versionIds);
    if (error) {
      throw new Error(`Failed to load campaign versions: ${error.message}`);
    }
    const map = new Map<string, CampaignVersion>();
    for (const row of data ?? []) {
      const version = mapCampaignVersion(row as CampaignVersionRow);
      map.set(version.id, version);
    }
    return map;
  },
  async getCampaignVersion(id: string): Promise<CampaignVersion | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("sd_campaign_versions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to load campaign version: ${error.message}`);
    }
    return data ? mapCampaignVersion(data as CampaignVersionRow) : null;
  },
  async createCampaignVersion(
    campaignId: string,
    config: CampaignConfig,
    status: CampaignVersion["status"] = "draft"
  ): Promise<CampaignVersion> {
    const supabase = getSupabaseAdmin();
    const { data: versionData, error: versionError } = await supabase
      .from("sd_campaign_versions")
      .select("version")
      .eq("campaign_id", campaignId)
      .order("version", { ascending: false })
      .limit(1);
    if (versionError) {
      throw new Error(`Failed to resolve campaign version: ${versionError.message}`);
    }
    const versionRow = (versionData?.[0] as { version: number } | undefined) ?? undefined;
    const currentVersion = versionRow?.version ?? 0;
    const insert = {
      campaign_id: campaignId,
      version: currentVersion + 1,
      status,
      config
    };
    const { data, error } = await supabase
      .from("sd_campaign_versions")
      .insert(insert)
      .select("*")
      .single();
    if (error) {
      throw new Error(`Failed to create campaign version: ${error.message}`);
    }
    return mapCampaignVersion(data as CampaignVersionRow);
  },
  async updateCampaignVersion(id: string, config: CampaignConfig): Promise<CampaignVersion | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("sd_campaign_versions")
      .update({ config })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to update campaign version: ${error.message}`);
    }
    return data ? mapCampaignVersion(data as CampaignVersionRow) : null;
  },
  async publishCampaignVersion(id: string): Promise<CampaignVersion | null> {
    const supabase = getSupabaseAdmin();
    const version = await this.getCampaignVersion(id);
    if (!version) return null;
    const { error: archiveError } = await supabase
      .from("sd_campaign_versions")
      .update({ status: "archived" })
      .eq("campaign_id", version.campaignId)
      .eq("status", "published");
    if (archiveError) {
      throw new Error(`Failed to archive campaign versions: ${archiveError.message}`);
    }
    const { data, error } = await supabase
      .from("sd_campaign_versions")
      .update({ status: "published" })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to publish campaign version: ${error.message}`);
    }
    if (!data) return null;
    await this.updateCampaign(version.campaignId, {
      currentVersionId: id,
      status: "live"
    });
    return mapCampaignVersion(data as CampaignVersionRow);
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
      weight: payload.weight ?? 0
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
  async reserveDecision(params: {
    transactionId: string;
    programId: string;
    campaignId: string | null;
    campaignVersionId: string | null;
    campaignVersionNumber: number | null;
    storeId: string;
    amount: number;
    channel?: string | null;
    mcc?: string | null;
    occurredAt: string;
    eventPayload: Record<string, unknown>;
  }): Promise<DecisionResult> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("sd_reserve_decision", {
      p_transaction_id: params.transactionId,
      p_program_id: params.programId,
      p_campaign_id: params.campaignId,
      p_campaign_version_id: params.campaignVersionId,
      p_campaign_version_number: params.campaignVersionNumber,
      p_store_id: params.storeId,
      p_amount: params.amount,
      p_channel: params.channel ?? null,
      p_mcc: params.mcc ?? null,
      p_occurred_at: params.occurredAt,
      p_event: params.eventPayload
    });
    if (error) {
      throw new Error(`Failed to reserve decision: ${error.message}`);
    }
    const row = (Array.isArray(data) ? data[0] : data) as ReserveDecisionRow | undefined;
    if (!row) {
      throw new Error("Failed to reserve decision: empty response");
    }
    const decision = await this.getDecision(row.id);
    if (!decision) {
      throw new Error("Failed to load reserved decision.");
    }
    return { decision, isDuplicate: row.is_duplicate };
  },
  async createDecision(payload: {
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
    outcomeType: DecisionLog["outcomeType"];
    status: DecisionLog["status"];
    matchedRuleId?: string | null;
    matchedRuleN?: number | null;
    matchedRulePriority?: number | null;
    rewardTemplateId?: string | null;
    rewardTemplateName?: string | null;
    voucherCode?: string | null;
    cvsReference?: string | null;
    competitionEntry?: boolean;
    messageTemplateId?: string | null;
    entryMessageTemplateId?: string | null;
    decisionTrace?: DecisionLog["decisionTrace"];
    eventPayload?: Record<string, unknown>;
  }): Promise<DecisionLog> {
    const supabase = getSupabaseAdmin();
    const insert = {
      transaction_id: payload.transactionId,
      program_id: payload.programId,
      campaign_id: payload.campaignId ?? null,
      campaign_version_id: payload.campaignVersionId ?? null,
      campaign_version_number: payload.campaignVersionNumber ?? null,
      store_id: payload.storeId ?? null,
      amount: payload.amount ?? null,
      channel: payload.channel ?? null,
      mcc: payload.mcc ?? null,
      occurred_at: payload.occurredAt ?? null,
      counter_value: payload.counterValue,
      matched_rule_id: payload.matchedRuleId ?? null,
      matched_rule_n: payload.matchedRuleN ?? null,
      matched_rule_priority: payload.matchedRulePriority ?? null,
      reward_template_id: payload.rewardTemplateId ?? null,
      reward_template_name: payload.rewardTemplateName ?? null,
      outcome_type: payload.outcomeType,
      status: payload.status,
      voucher_code: payload.voucherCode ?? null,
      cvs_reference: payload.cvsReference ?? null,
      competition_entry: payload.competitionEntry ?? false,
      message_template_id: payload.messageTemplateId ?? null,
      entry_message_template_id: payload.entryMessageTemplateId ?? null,
      decision_trace: payload.decisionTrace ?? null,
      event_payload: payload.eventPayload ?? {}
    };
    const { data, error } = await supabase
      .from("sd_decisions")
      .upsert(insert, { onConflict: "transaction_id", ignoreDuplicates: true })
      .select("*")
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to log decision: ${error.message}`);
    }
    if (!data) {
      const existing = await this.getDecisionByTransactionId(payload.transactionId);
      if (!existing) {
        throw new Error("Failed to log decision: no record returned.");
      }
      return existing;
    }
    return mapDecision(data as DecisionRow);
  },
  async incrementNonRewardCounter(campaignVersionId: string): Promise<number> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("sd_increment_non_reward_counter", {
      p_campaign_version_id: campaignVersionId
    });
    if (error) {
      throw new Error(`Failed to increment non-reward counter: ${error.message}`);
    }
    const row = Array.isArray(data) ? data[0] : data;
    return Number(row?.counter_value ?? 0);
  },
  async getDecision(id: string): Promise<DecisionLog | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("sd_decisions").select("*").eq("id", id).maybeSingle();
    if (error) {
      throw new Error(`Failed to load decision: ${error.message}`);
    }
    return data ? mapDecision(data as DecisionRow) : null;
  },
  async getDecisionByTransactionId(transactionId: string): Promise<DecisionLog | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("sd_decisions")
      .select("*")
      .eq("transaction_id", transactionId)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to load decision: ${error.message}`);
    }
    return data ? mapDecision(data as DecisionRow) : null;
  },
  async claimDecision(id: string, statuses: DecisionLog["status"][] = ["pending", "issue_failed"]): Promise<DecisionLog | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("sd_decisions")
      .update({ status: "issuing", updated_at: new Date().toISOString() })
      .eq("id", id)
      .in("status", statuses)
      .select("*")
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to claim decision: ${error.message}`);
    }
    return data ? mapDecision(data as DecisionRow) : null;
  },
  async updateDecision(id: string, payload: Partial<DecisionLog>): Promise<DecisionLog | null> {
    const supabase = getSupabaseAdmin();
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };
    if (payload.status !== undefined) updates.status = payload.status;
    if (payload.outcomeType !== undefined) updates.outcome_type = payload.outcomeType;
    if (payload.rewardTemplateId !== undefined) updates.reward_template_id = payload.rewardTemplateId;
    if (payload.rewardTemplateName !== undefined) updates.reward_template_name = payload.rewardTemplateName;
    if (payload.voucherCode !== undefined) updates.voucher_code = payload.voucherCode;
    if (payload.cvsReference !== undefined) updates.cvs_reference = payload.cvsReference;
    if (payload.competitionEntry !== undefined) updates.competition_entry = payload.competitionEntry;
    if (payload.matchedRuleId !== undefined) updates.matched_rule_id = payload.matchedRuleId;
    if (payload.matchedRuleN !== undefined) updates.matched_rule_n = payload.matchedRuleN;
    if (payload.matchedRulePriority !== undefined) updates.matched_rule_priority = payload.matchedRulePriority;
    if (payload.messageTemplateId !== undefined) updates.message_template_id = payload.messageTemplateId;
    if (payload.entryMessageTemplateId !== undefined) updates.entry_message_template_id = payload.entryMessageTemplateId;
    if (payload.decisionTrace !== undefined) updates.decision_trace = payload.decisionTrace;
    const { data, error } = await supabase
      .from("sd_decisions")
      .update(updates)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to update decision: ${error.message}`);
    }
    return data ? mapDecision(data as DecisionRow) : null;
  },
  async countRuleWins(campaignVersionId: string, ruleId: string, since?: string): Promise<number> {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("sd_decisions")
      .select("id", { count: "exact", head: true })
      .eq("campaign_version_id", campaignVersionId)
      .eq("matched_rule_id", ruleId)
      .eq("status", "issued");
    if (since) {
      query = query.gte("created_at", since);
    }
    const { count, error } = await query;
    if (error) {
      throw new Error(`Failed to count rule wins: ${error.message}`);
    }
    return count ?? 0;
  },
  async listDecisions(): Promise<DecisionLog[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("sd_decisions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(LOG_LIMIT);
    if (error) {
      throw new Error(`Failed to load decisions: ${error.message}`);
    }
    return (data ?? []).map((row) => mapDecision(row as DecisionRow));
  }
};
