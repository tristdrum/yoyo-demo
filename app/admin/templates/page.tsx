"use client";

import { useEffect, useState } from "react";
import { Button, SectionHeader } from "@/components/ui";
import type { MessageTemplate, RewardTemplate } from "@/lib/types";

export default function TemplatesPage() {
  const [rewardTemplates, setRewardTemplates] = useState<RewardTemplate[]>([]);
  const [messageTemplates, setMessageTemplates] = useState<MessageTemplate[]>([]);

  async function loadTemplates() {
    const [rewardsRes, messagesRes] = await Promise.all([
      fetch("/api/templates/rewards", { cache: "no-store" }),
      fetch("/api/templates/messages", { cache: "no-store" })
    ]);
    setRewardTemplates((await rewardsRes.json()) as RewardTemplate[]);
    setMessageTemplates((await messagesRes.json()) as MessageTemplate[]);
  }

  useEffect(() => {
    void loadTemplates();
  }, []);

  async function handleRewardCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const payload = {
      name: String(form.get("name") || "New Reward"),
      type: String(form.get("type") || "voucher"),
      cvsCampaignId: String(form.get("cvsCampaignId") || ""),
      weight: Number(form.get("weight") || 50)
    };
    await fetch("/api/templates/rewards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    formEl.reset();
    await loadTemplates();
  }

  async function handleMessageCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const payload = {
      name: String(form.get("name") || "New Message"),
      channel: String(form.get("channel") || "whatsapp"),
      body: String(form.get("body") || "You earned {{reward}}. Code: {{voucher}}"),
      fallbackBody: String(form.get("fallbackBody") || "You earned {{reward}}. Code: {{voucher}}")
    };
    await fetch("/api/templates/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    formEl.reset();
    await loadTemplates();
  }

  return (
    <>
      <SectionHeader
        title="Templates"
        subtitle="Define reward types and the message copy used in WhatsApp and SMS."
      />

      <div className="card">
        <h3>Create reward template</h3>
        <form className="form-grid" onSubmit={handleRewardCreate}>
          <div className="field">
            <label>Name</label>
            <input name="name" placeholder="Free pastry" />
          </div>
          <div className="field">
            <label>Type</label>
            <select name="type" defaultValue="voucher">
              <option value="voucher">Voucher</option>
              <option value="free_item">Free item</option>
              <option value="percent_off">Percent off</option>
            </select>
          </div>
          <div className="field">
            <label>CVS Campaign ID</label>
            <input name="cvsCampaignId" placeholder="CVS-CAMPAIGN-ID" />
          </div>
          <div className="field">
            <label>Weight</label>
            <input name="weight" type="number" min="0" defaultValue={50} />
          </div>
          <div className="field">
            <label>&nbsp;</label>
            <Button type="submit">Add reward</Button>
          </div>
        </form>
      </div>

      <div className="card-grid">
        {rewardTemplates.map((reward, index) => (
          <div className="card" key={reward.id} style={{ animationDelay: `${index * 80}ms` }}>
            <h3>{reward.name}</h3>
            <p>Type: {reward.type}</p>
            <p>Weight: {reward.weight}</p>
            <p>CVS: {reward.cvsCampaignId || "Not set"}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Create message template</h3>
        <form className="form-grid" onSubmit={handleMessageCreate}>
          <div className="field">
            <label>Name</label>
            <input name="name" placeholder="Default WhatsApp" />
          </div>
          <div className="field">
            <label>Channel</label>
            <select name="channel" defaultValue="whatsapp">
              <option value="whatsapp">WhatsApp</option>
              <option value="sms">SMS</option>
            </select>
          </div>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label>Body</label>
            <textarea name="body" placeholder="You earned {{reward}}. Code: {{voucher}}" />
          </div>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label>Fallback body</label>
            <textarea name="fallbackBody" placeholder="Fallback SMS copy" />
          </div>
          <div className="field">
            <label>&nbsp;</label>
            <Button type="submit">Add message</Button>
          </div>
        </form>
      </div>

      <div className="card-grid">
        {messageTemplates.map((template, index) => (
          <div className="card" key={template.id} style={{ animationDelay: `${index * 80}ms` }}>
            <h3>{template.name}</h3>
            <p>Channel: {template.channel}</p>
            <p>{template.body}</p>
            <p>Fallback: {template.fallbackBody || "-"}</p>
          </div>
        ))}
      </div>
    </>
  );
}
