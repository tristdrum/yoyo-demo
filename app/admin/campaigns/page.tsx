"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, SectionHeader } from "@/components/ui";
import { computeRewardRates } from "@/lib/ruleEngine";
import type { Campaign, RetailerProgram } from "@/lib/types";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [programs, setPrograms] = useState<RetailerProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [creatingProgram, setCreatingProgram] = useState(false);

  async function loadCampaigns() {
    setLoading(true);
    const [campaignRes, programRes] = await Promise.all([
      fetch("/api/campaigns", { cache: "no-store" }),
      fetch("/api/programs", { cache: "no-store" })
    ]);
    const [campaignData, programData] = await Promise.all([
      campaignRes.json() as Promise<Campaign[]>,
      programRes.json() as Promise<RetailerProgram[]>
    ]);
    setCampaigns(campaignData);
    setPrograms(programData);
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
      name: String(form.get("name") || "New Surprise & Delight Campaign"),
      programId: String(form.get("programId") || "kfc"),
      startAt: String(form.get("startAt") || new Date().toISOString()),
      endAt: form.get("endAt") ? String(form.get("endAt")) : null,
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

  async function handleCreateProgram(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingProgram(true);
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const payload = {
      id: String(form.get("programId") || `program-${Date.now()}`),
      name: String(form.get("programName") || "New Program")
    };
    try {
      await fetch("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      formEl.reset();
      await loadCampaigns();
    } finally {
      setCreatingProgram(false);
    }
  }

  return (
    <>
      <SectionHeader
        title="Campaigns"
        subtitle="Configure Surprise & Delight campaigns per retailer and publish rule versions."
      />

      <div className="card">
        <h3>Create program</h3>
        <form className="form-grid" onSubmit={handleCreateProgram}>
          <div className="field">
            <label>Program ID</label>
            <input name="programId" placeholder="kfc" required />
          </div>
          <div className="field">
            <label>Program name</label>
            <input name="programName" placeholder="KFC" required />
          </div>
          <div className="field">
            <label>&nbsp;</label>
            <Button type="submit" disabled={creatingProgram}>
              {creatingProgram ? "Creating..." : "Add program"}
            </Button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3>Create campaign</h3>
        <form className="form-grid" onSubmit={handleCreate}>
          <div className="field">
            <label>Name</label>
            <input name="name" placeholder="KFC Surprise & Delight" required />
          </div>
          <div className="field">
            <label>Program</label>
            <select name="programId" defaultValue={programs[0]?.id ?? "kfc"}>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name} ({program.id})
                </option>
              ))}
            </select>
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
            <label>Start At</label>
            <input name="startAt" type="datetime-local" defaultValue={new Date().toISOString().slice(0, 16)} />
          </div>
          <div className="field">
            <label>End At</label>
            <input name="endAt" type="datetime-local" defaultValue="" />
          </div>
          <div className="field">
            <label>&nbsp;</label>
            <Button type="submit" disabled={creating}>
              {creating ? "Creating..." : "Create campaign"}
            </Button>
          </div>
        </form>
      </div>

      <div className="section-header">
        <h2>Campaign list</h2>
        <p>{loading ? "Loading campaigns..." : `${campaigns.length} campaign(s)`}</p>
      </div>
      <div className="card-grid">
        {campaigns.map((campaign, index) => {
          const rewardRates = campaign.currentVersion ?
            computeRewardRates(campaign.currentVersion.config.rewardRules) :
            null;
          const programLabel = programs.find((program) => program.id === campaign.programId)?.name ?? campaign.programId;
          return (
            <div className="card" key={campaign.id} style={{ animationDelay: `${index * 80}ms` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3>{campaign.name}</h3>
                <Badge tone={campaign.status}>{campaign.status.toUpperCase()}</Badge>
              </div>
              <p>Program: {programLabel}</p>
              <p>Version: {campaign.currentVersion?.version ?? "Draft"}</p>
              <p>
                Reward rate:{" "}
                {rewardRates ? `${(rewardRates.totalRate * 100).toFixed(2)}%` : "Not configured"}
              </p>
              <p>
                Window: {new Date(campaign.startAt).toLocaleString()}{" "}
                {campaign.endAt ? `→ ${new Date(campaign.endAt).toLocaleString()}` : ""}
              </p>
              <Link href={`/admin/campaigns/${campaign.id}`} className="button button-ghost card-cta">
                Open builder
              </Link>
            </div>
          );
        })}
      </div>
    </>
  );
}
