"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Badge, Button, SectionHeader } from "@/components/ui";
import { buildDefaultConfig, computeRewardRates } from "@/lib/ruleEngine";
import type {
  Campaign,
  CampaignConfig,
  CampaignVersion,
  MessageTemplate,
  RewardRuleConfig,
  RewardTemplate
} from "@/lib/types";

const DAYS = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 }
];

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatList(value: string[] | undefined): string {
  return (value ?? []).join(", ");
}

function buildRuleTemplate(rewardTemplates: RewardTemplate[]): RewardRuleConfig {
  const fallbackId = `rule-${Math.random().toString(36).slice(2, 10)}`;
  const ruleId = typeof crypto !== "undefined" && "randomUUID" in crypto ? `rule-${crypto.randomUUID()}` : fallbackId;
  return {
    id: ruleId,
    name: "New rule",
    nth: 5,
    rewardTemplateId: rewardTemplates[0]?.id ?? "",
    priority: 5,
    enabled: true,
    dailyCap: null,
    totalCap: null
  };
}

export default function CampaignDetailPage() {
  const params = useParams();
  const id = String(params?.id ?? "");

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [versions, setVersions] = useState<CampaignVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [config, setConfig] = useState<CampaignConfig>(buildDefaultConfig());
  const [rewardTemplates, setRewardTemplates] = useState<RewardTemplate[]>([]);
  const [messageTemplates, setMessageTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [campaignRes, versionsRes, rewardsRes, messagesRes] = await Promise.all([
        fetch(`/api/campaigns/${id}`, { cache: "no-store" }),
        fetch(`/api/campaigns/${id}/versions`, { cache: "no-store" }),
        fetch("/api/templates/rewards", { cache: "no-store" }),
        fetch("/api/templates/messages", { cache: "no-store" })
      ]);
      if (!campaignRes.ok) {
        setCampaign(null);
        setLoading(false);
        return;
      }
      const [campaignData, versionsData, rewardsData, messagesData] = await Promise.all([
        campaignRes.json() as Promise<Campaign>,
        versionsRes.json() as Promise<CampaignVersion[]>,
        rewardsRes.json() as Promise<RewardTemplate[]>,
        messagesRes.json() as Promise<MessageTemplate[]>
      ]);
      setCampaign(campaignData);
      setVersions(versionsData);
      setRewardTemplates(rewardsData);
      setMessageTemplates(messagesData);
      const initialVersionId = campaignData.currentVersionId ?? versionsData[0]?.id ?? "";
      setSelectedVersionId(initialVersionId);
      const selectedVersion =
        versionsData.find((version) => version.id === initialVersionId) ??
        campaignData.currentVersion ??
        null;
      setConfig(selectedVersion?.config ?? buildDefaultConfig());
      setLoading(false);
    }
    if (id) {
      void load();
    }
  }, [id]);

  useEffect(() => {
    if (!selectedVersionId) return;
    const version = versions.find((item) => item.id === selectedVersionId);
    if (version) {
      setConfig(version.config);
    }
  }, [selectedVersionId, versions]);

  const rewardRates = useMemo(() => computeRewardRates(config.rewardRules), [config.rewardRules]);
  const rewardRateMap = useMemo(
    () => new Map(rewardRates.perRule.map((item) => [item.ruleId, item])),
    [rewardRates]
  );
  const nonRewardRate = Math.max(0, 1 - rewardRates.totalRate);
  const entryRateGivenNonReward =
    config.competitionRule.type === "all_non_reward" ?
      1 :
      config.competitionRule.type === "probability" ?
        Math.max(0, Math.min(config.competitionRule.probability ?? 0, 1)) :
        config.competitionRule.type === "nth_non_reward" ?
          (config.competitionRule.nth ? 1 / Math.max(1, Math.floor(config.competitionRule.nth)) : 0) :
          0;
  const entryRateOverall = nonRewardRate * entryRateGivenNonReward;
  const hasInvalidRates = rewardRates.totalRate > 1 || entryRateGivenNonReward > 1;
  const hasInvalidRules = config.rewardRules.some((rule) => rule.nth < 1 || !rule.rewardTemplateId);
  const canSaveVersion = !hasInvalidRates && !hasInvalidRules;

  async function handleSaveConfig() {
    if (!selectedVersionId) return;
    setSaving(true);
    await fetch(`/api/campaign-versions/${selectedVersionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config })
    });
    const versionsRes = await fetch(`/api/campaigns/${id}/versions`, { cache: "no-store" });
    const versionsData = (await versionsRes.json()) as CampaignVersion[];
    setVersions(versionsData);
    setSaving(false);
  }

  async function handleSaveCampaign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!campaign) return;
    setSavingCampaign(true);
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") || campaign.name),
      status: String(form.get("status") || campaign.status),
      startAt: String(form.get("startAt") || campaign.startAt),
      endAt: form.get("endAt") ? String(form.get("endAt")) : null
    };
    const res = await fetch(`/api/campaigns/${campaign.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const updated = (await res.json()) as Campaign;
    setCampaign(updated);
    setSavingCampaign(false);
  }

  async function handleCreateVersion() {
    setCreatingVersion(true);
    const res = await fetch(`/api/campaigns/${id}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromVersionId: selectedVersionId })
    });
    const newVersion = (await res.json()) as CampaignVersion;
    const versionsRes = await fetch(`/api/campaigns/${id}/versions`, { cache: "no-store" });
    const versionsData = (await versionsRes.json()) as CampaignVersion[];
    setVersions(versionsData);
    setSelectedVersionId(newVersion.id);
    setCreatingVersion(false);
  }

  async function handlePublishVersion() {
    if (!selectedVersionId) return;
    setPublishing(true);
    await fetch(`/api/campaign-versions/${selectedVersionId}/publish`, { method: "POST" });
    const [campaignRes, versionsRes] = await Promise.all([
      fetch(`/api/campaigns/${id}`, { cache: "no-store" }),
      fetch(`/api/campaigns/${id}/versions`, { cache: "no-store" })
    ]);
    setCampaign((await campaignRes.json()) as Campaign);
    setVersions((await versionsRes.json()) as CampaignVersion[]);
    setPublishing(false);
  }

  function updateConfig(next: Partial<CampaignConfig>) {
    setConfig((prev) => ({ ...prev, ...next }));
  }

  function updateEligibility(field: keyof CampaignConfig["eligibility"], value: unknown) {
    updateConfig({
      eligibility: {
        ...config.eligibility,
        [field]: value
      }
    });
  }

  function updateCompetitionRule(field: keyof CampaignConfig["competitionRule"], value: unknown) {
    updateConfig({
      competitionRule: {
        ...config.competitionRule,
        [field]: value
      }
    });
  }

  function updateRule(ruleId: string, updates: Partial<RewardRuleConfig>) {
    updateConfig({
      rewardRules: config.rewardRules.map((rule) =>
        rule.id === ruleId ?
          {
            ...rule,
            ...updates
          } :
          rule
      )
    });
  }

  function removeRule(ruleId: string) {
    updateConfig({
      rewardRules: config.rewardRules.filter((rule) => rule.id !== ruleId)
    });
  }

  function addRule() {
    updateConfig({
      rewardRules: [...config.rewardRules, buildRuleTemplate(rewardTemplates)]
    });
  }

  if (loading) {
    return <div className="card">Loading campaign...</div>;
  }

  if (!campaign) {
    return <div className="card">Campaign not found.</div>;
  }

  const selectedVersion = versions.find((version) => version.id === selectedVersionId) ?? null;
  const versionTone =
    selectedVersion?.status === "published" ?
      "live" :
      selectedVersion?.status === "archived" ?
        "paused" :
        "draft";

  return (
    <>
      <SectionHeader
        title={campaign.name}
        subtitle={`Program: ${campaign.programId} · Version ${selectedVersion?.version ?? "-"}`}
      />

      <div className="card">
        <h3>Campaign details</h3>
        <form className="form-grid" onSubmit={handleSaveCampaign}>
          <div className="field">
            <label>Name</label>
            <input name="name" defaultValue={campaign.name} />
          </div>
          <div className="field">
            <label>Status</label>
            <select name="status" defaultValue={campaign.status}>
              <option value="draft">Draft</option>
              <option value="live">Live</option>
              <option value="paused">Paused</option>
            </select>
          </div>
          <div className="field">
            <label>Start At</label>
            <input name="startAt" type="datetime-local" defaultValue={campaign.startAt.slice(0, 16)} />
          </div>
          <div className="field">
            <label>End At</label>
            <input name="endAt" type="datetime-local" defaultValue={campaign.endAt ? campaign.endAt.slice(0, 16) : ""} />
          </div>
          <div className="field">
            <label>&nbsp;</label>
            <Button type="submit" disabled={savingCampaign}>
              {savingCampaign ? "Saving..." : "Save campaign"}
            </Button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3>Version control</h3>
        <div className="form-grid">
          <div className="field">
            <label>Version</label>
            <select
              value={selectedVersionId}
              onChange={(event) => setSelectedVersionId(event.target.value)}
            >
              {versions.map((version) => (
                <option key={version.id} value={version.id}>
                  v{version.version} · {version.status}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Status</label>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <Badge tone={versionTone}>{selectedVersion?.status?.toUpperCase() ?? "DRAFT"}</Badge>
            </div>
          </div>
          <div className="field">
            <label>&nbsp;</label>
            <Button type="button" onClick={handleSaveConfig} disabled={saving || !canSaveVersion}>
              {saving ? "Saving..." : "Save version"}
            </Button>
          </div>
          <div className="field">
            <label>&nbsp;</label>
            <Button type="button" onClick={handleCreateVersion} disabled={creatingVersion}>
              {creatingVersion ? "Creating..." : "New draft version"}
            </Button>
          </div>
          <div className="field">
            <label>&nbsp;</label>
            <Button type="button" onClick={handlePublishVersion} disabled={publishing || !canSaveVersion}>
              {publishing ? "Publishing..." : "Publish version"}
            </Button>
          </div>
        </div>
        {hasInvalidRates || hasInvalidRules ? (
          <div className="pill pill-warn" style={{ marginTop: 12 }}>
            Fix invalid rules or probabilities before saving/publishing.
          </div>
        ) : null}
      </div>

      <div className="card">
        <h3>Eligibility</h3>
        <div className="form-grid">
          <div className="field">
            <label>Min spend (cents)</label>
            <input
              type="number"
              value={config.eligibility.minSpend ?? 0}
              onChange={(event) => updateEligibility("minSpend", Number(event.target.value))}
              min={0}
            />
          </div>
          <div className="field">
            <label>Stores (comma-separated)</label>
            <input
              value={formatList(config.eligibility.stores)}
              onChange={(event) => updateEligibility("stores", parseList(event.target.value))}
              placeholder="store-1, store-2"
            />
          </div>
          <div className="field">
            <label>Channels (comma-separated)</label>
            <input
              value={formatList(config.eligibility.channels)}
              onChange={(event) => updateEligibility("channels", parseList(event.target.value))}
              placeholder="POS, ONLINE"
            />
          </div>
          <div className="field">
            <label>MCCs (comma-separated)</label>
            <input
              value={formatList(config.eligibility.mccs)}
              onChange={(event) => updateEligibility("mccs", parseList(event.target.value))}
              placeholder="5812, 5814"
            />
          </div>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label>Days of week</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {DAYS.map((day) => (
                <label key={day.value} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={config.eligibility.daysOfWeek?.includes(day.value) ?? false}
                    onChange={(event) => {
                      const current = new Set(config.eligibility.daysOfWeek ?? []);
                      if (event.target.checked) {
                        current.add(day.value);
                      } else {
                        current.delete(day.value);
                      }
                      updateEligibility("daysOfWeek", Array.from(current).sort());
                    }}
                  />
                  {day.label}
                </label>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Time window start</label>
            <input
              type="time"
              value={config.eligibility.timeWindows?.[0]?.start ?? ""}
              onChange={(event) => {
                const windows = [...(config.eligibility.timeWindows ?? [])];
                if (!windows[0]) windows[0] = { start: "", end: "" };
                windows[0] = { ...windows[0], start: event.target.value };
                updateEligibility("timeWindows", windows);
              }}
            />
          </div>
          <div className="field">
            <label>Time window end</label>
            <input
              type="time"
              value={config.eligibility.timeWindows?.[0]?.end ?? ""}
              onChange={(event) => {
                const windows = [...(config.eligibility.timeWindows ?? [])];
                if (!windows[0]) windows[0] = { start: "", end: "" };
                windows[0] = { ...windows[0], end: event.target.value };
                updateEligibility("timeWindows", windows);
              }}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>Reward rules</h3>
          <Button type="button" onClick={addRule}>
            Add rule
          </Button>
        </div>
        <table className="table" style={{ marginTop: 16 }}>
          <thead>
            <tr>
              <th>Enabled</th>
              <th>Name</th>
              <th>Every N</th>
              <th>Reward</th>
              <th>Priority</th>
              <th>Daily cap</th>
              <th>Total cap</th>
              <th>Implied</th>
              <th>Effective</th>
              <th>Message</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {config.rewardRules.map((rule) => {
              const rate = rewardRateMap.get(rule.id);
              return (
                <tr key={rule.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(event) => updateRule(rule.id, { enabled: event.target.checked })}
                    />
                  </td>
                  <td>
                    <input
                      value={rule.name}
                      onChange={(event) => updateRule(rule.id, { name: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      value={rule.nth}
                      onChange={(event) => {
                        const nth = Math.max(1, Number(event.target.value || 1));
                        updateRule(rule.id, { nth });
                      }}
                    />
                  </td>
                  <td>
                    <select
                      value={rule.rewardTemplateId}
                      onChange={(event) => updateRule(rule.id, { rewardTemplateId: event.target.value })}
                    >
                      {rewardTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      value={rule.priority}
                      onChange={(event) => updateRule(rule.id, { priority: Number(event.target.value || 0) })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      value={rule.dailyCap ?? ""}
                      placeholder="∞"
                      onChange={(event) =>
                        updateRule(rule.id, {
                          dailyCap: event.target.value ? Number(event.target.value) : null
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      value={rule.totalCap ?? ""}
                      placeholder="∞"
                      onChange={(event) =>
                        updateRule(rule.id, {
                          totalCap: event.target.value ? Number(event.target.value) : null
                        })
                      }
                    />
                  </td>
                  <td>{rate ? `${(rate.impliedRate * 100).toFixed(2)}%` : "-"}</td>
                  <td>{rate ? `${(rate.effectiveRate * 100).toFixed(2)}%` : "-"}</td>
                  <td>
                    <select
                      value={rule.messageTemplateId ?? ""}
                      onChange={(event) =>
                        updateRule(rule.id, { messageTemplateId: event.target.value || null })
                      }
                    >
                      <option value="">None</option>
                      {messageTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <Button type="button" onClick={() => removeRule(rule.id)}>
                      Remove
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ marginTop: 16 }} className="pill pill-neutral">
          Total reward rate: {(rewardRates.totalRate * 100).toFixed(2)}% · Non-reward rate:{" "}
          {(nonRewardRate * 100).toFixed(2)}%
        </div>
      </div>

      <div className="card">
        <h3>Competition entry (when no reward)</h3>
        <div className="form-grid">
          <div className="field">
            <label>Entry rule</label>
            <select
              value={config.competitionRule.type}
              onChange={(event) => updateCompetitionRule("type", event.target.value)}
            >
              <option value="none">No entry</option>
              <option value="all_non_reward">Every non-reward</option>
              <option value="probability">Probability</option>
              <option value="nth_non_reward">Every Nth non-reward</option>
            </select>
          </div>
          {config.competitionRule.type === "probability" ? (
            <div className="field">
              <label>Probability (0-1)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                max={1}
                value={config.competitionRule.probability ?? 0}
                onChange={(event) => updateCompetitionRule("probability", Number(event.target.value || 0))}
              />
            </div>
          ) : null}
          {config.competitionRule.type === "nth_non_reward" ? (
            <div className="field">
              <label>Every Nth</label>
              <input
                type="number"
                min={1}
                value={config.competitionRule.nth ?? 1}
                onChange={(event) => updateCompetitionRule("nth", Number(event.target.value || 1))}
              />
            </div>
          ) : null}
          <div className="field">
            <label>Entry message template</label>
            <select
              value={config.competitionRule.messageTemplateId ?? ""}
              onChange={(event) => updateCompetitionRule("messageTemplateId", event.target.value || null)}
            >
              <option value="">None</option>
              {messageTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 16 }} className="pill pill-neutral">
          Entry rate (given non-reward): {(entryRateGivenNonReward * 100).toFixed(2)}% · Effective
          entry rate: {(entryRateOverall * 100).toFixed(2)}%
        </div>
      </div>
    </>
  );
}
