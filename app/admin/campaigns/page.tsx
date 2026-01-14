"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, SectionHeader } from "@/components/ui";
import type { Campaign } from "@/lib/types";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  async function loadCampaigns() {
    setLoading(true);
    const res = await fetch("/api/campaigns", { cache: "no-store" });
    const data = (await res.json()) as Campaign[];
    setCampaigns(data);
    setLoading(false);
  }

  useEffect(() => {
    void loadCampaigns();
  }, []);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const payload = {
      name: String(form.get("name") || "New Campaign"),
      retailer: String(form.get("retailer") || "Yoyo Demo Retailer"),
      probability: Number(form.get("probability") || 0.02),
      capWindow: String(form.get("capWindow") || "week"),
      capMax: Number(form.get("capMax") || 1),
      status: String(form.get("status") || "draft")
    };
    try {
      await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      formEl.reset();
      await loadCampaigns();
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <SectionHeader
        title="Campaigns"
        subtitle="Create and tune Surprise & Delight campaigns with probability and caps."
      />
      <div className="card">
        <form className="form-grid" onSubmit={handleCreate}>
          <div className="field">
            <label>Name</label>
            <input name="name" placeholder="Morning Rush Rewards" required />
          </div>
          <div className="field">
            <label>Retailer</label>
            <input name="retailer" placeholder="Yoyo Demo Retailer" />
          </div>
          <div className="field">
            <label>Status</label>
            <select name="status" defaultValue="draft">
              <option value="draft">Draft</option>
              <option value="live">Live</option>
              <option value="paused">Paused</option>
            </select>
          </div>
          <div className="field">
            <label>Probability</label>
            <input name="probability" type="number" step="0.01" min="0" max="1" defaultValue={0.02} />
          </div>
          <div className="field">
            <label>Cap Window</label>
            <select name="capWindow" defaultValue="week">
              <option value="day">Day</option>
              <option value="week">Week</option>
            </select>
          </div>
          <div className="field">
            <label>Cap Max</label>
            <input name="capMax" type="number" min="1" defaultValue={1} />
          </div>
          <div className="field">
            <label>&nbsp;</label>
            <Button type="submit" disabled={creating}>
              {creating ? "Creating..." : "Create Campaign"}
            </Button>
          </div>
        </form>
      </div>

      <div className="section-header">
        <h2>Active Workspace</h2>
        <p>{loading ? "Loading campaigns..." : `${campaigns.length} campaign(s)`}</p>
      </div>
      <div className="card-grid">
        {campaigns.map((campaign, index) => (
          <div className="card" key={campaign.id} style={{ animationDelay: `${index * 80}ms` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3>{campaign.name}</h3>
              <Badge tone={campaign.status}>{campaign.status.toUpperCase()}</Badge>
            </div>
            <p>Retailer: {campaign.retailer}</p>
            <p>Probability: {(campaign.probability * 100).toFixed(2)}%</p>
            <p>Caps: {campaign.capMax} per {campaign.capWindow}</p>
            <Link href={`/admin/campaigns/${campaign.id}`} className="button button-ghost card-cta">
              Edit rules
            </Link>
          </div>
        ))}
      </div>
    </>
  );
}
