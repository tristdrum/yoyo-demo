"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, SectionHeader } from "@/components/ui";
import type { Campaign, MessageTemplate, RewardTemplate } from "@/lib/types";

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id ?? "");

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [rewardTemplates, setRewardTemplates] = useState<RewardTemplate[]>([]);
  const [messageTemplates, setMessageTemplates] = useState<MessageTemplate[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const [campaignRes, rewardsRes, messagesRes] = await Promise.all([
        fetch(`/api/campaigns/${id}`, { cache: "no-store" }),
        fetch("/api/templates/rewards", { cache: "no-store" }),
        fetch("/api/templates/messages", { cache: "no-store" })
      ]);
      setCampaign((await campaignRes.json()) as Campaign);
      setRewardTemplates((await rewardsRes.json()) as RewardTemplate[]);
      setMessageTemplates((await messagesRes.json()) as MessageTemplate[]);
    }
    if (id) {
      void load();
    }
  }, [id]);

  if (!campaign) {
    return <div className="card">Loading campaign...</div>;
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const selectedRewards = rewardTemplates
      .filter((reward) => form.get(`reward-${reward.id}`) === "on")
      .map((reward) => reward.id);
    const payload = {
      name: String(form.get("name") || campaign.name),
      retailer: String(form.get("retailer") || campaign.retailer),
      status: String(form.get("status") || campaign.status),
      probability: Number(form.get("probability") || campaign.probability),
      capWindow: String(form.get("capWindow") || campaign.capWindow),
      capMax: Number(form.get("capMax") || campaign.capMax),
      startAt: String(form.get("startAt") || campaign.startAt),
      endAt: form.get("endAt") ? String(form.get("endAt")) : null,
      rewardTemplateIds: selectedRewards,
      messageTemplateId: String(form.get("messageTemplateId") || "") || null
    };
    await fetch(`/api/campaigns/${campaign.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <>
      <SectionHeader
        title={campaign.name}
        subtitle="Tune caps, probability, timing, and reward distribution."
      />
      <div className="card">
        <form className="form-grid" onSubmit={handleSave}>
          <div className="field">
            <label>Name</label>
            <input name="name" defaultValue={campaign.name} />
          </div>
          <div className="field">
            <label>Retailer</label>
            <input name="retailer" defaultValue={campaign.retailer} />
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
            <label>Probability</label>
            <input name="probability" type="number" step="0.01" min="0" max="1" defaultValue={campaign.probability} />
          </div>
          <div className="field">
            <label>Cap Window</label>
            <select name="capWindow" defaultValue={campaign.capWindow}>
              <option value="day">Day</option>
              <option value="week">Week</option>
            </select>
          </div>
          <div className="field">
            <label>Cap Max</label>
            <input name="capMax" type="number" min="1" defaultValue={campaign.capMax} />
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
            <label>Message Template</label>
            <select name="messageTemplateId" defaultValue={campaign.messageTemplateId ?? ""}>
              <option value="">None</option>
              {messageTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label>Rewards in Campaign</label>
            <div className="card-grid">
              {rewardTemplates.map((reward) => (
                <label key={reward.id} className="card" style={{ cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    name={`reward-${reward.id}`}
                    defaultChecked={campaign.rewardTemplateIds.includes(reward.id)}
                  />
                  <strong style={{ display: "block", marginTop: 8 }}>{reward.name}</strong>
                  <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                    Weight: {reward.weight}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="field">
            <label>&nbsp;</label>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
