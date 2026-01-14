"use client";

import { useEffect, useState } from "react";
import { Button, SectionHeader } from "@/components/ui";
import type { Campaign } from "@/lib/types";

type PreviewResult = {
  counterValue: number;
  matchedRule: { id: string; name: string; nth: number } | null;
  rewardTemplate: { id: string; name: string; cvsCampaignId?: string | null } | null;
  rewardRates: { totalRate: number; perRule: Array<{ ruleId: string; impliedRate: number; effectiveRate: number }> };
};

type BatchResult = {
  counterStart: number;
  count: number;
  rewardCounts: Array<{ id: string; name: string; nth: number; count: number }>;
  totalRewards: number;
  nonRewardCount: number;
  expectedCompetitionEntries: number;
  rewardRates: { totalRate: number; perRule: Array<{ ruleId: string; impliedRate: number; effectiveRate: number }> };
};

type LiveResult = {
  decision: {
    transactionId: string;
    programId: string;
    counterValue: number;
    outcomeType: string;
    status: string;
    matchedRuleId?: string | null;
    matchedRuleN?: number | null;
  };
  reward?: { templateId: string; templateName: string; voucherCode?: string | null; status: string } | null;
  competitionEntry?: { granted: boolean; messageTemplateId?: string | null } | null;
  reason: string;
  trace: Array<{ step: string; detail: string }>;
};

export default function SimulatorPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [liveResult, setLiveResult] = useState<LiveResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/campaigns", { cache: "no-store" });
      setCampaigns((await res.json()) as Campaign[]);
    }
    void load();
  }, []);

  async function handlePreview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const payload = {
      mode: "preview",
      campaignId: String(form.get("campaignId") || ""),
      counterValue: Number(form.get("counterValue") || 1)
    };
    const res = await fetch("/api/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setPreviewResult((await res.json()) as PreviewResult);
    setLoading(false);
  }

  async function handleBatch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const payload = {
      mode: "batch",
      campaignId: String(form.get("campaignId") || ""),
      counterStart: Number(form.get("counterStart") || 0),
      count: Number(form.get("count") || 1000),
      nonRewardCounterStart: Number(form.get("nonRewardCounterStart") || 0)
    };
    const res = await fetch("/api/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setBatchResult((await res.json()) as BatchResult);
    setLoading(false);
  }

  async function handleLive(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const payload = {
      mode: "live",
      transactionId: String(form.get("transactionId") || `tx-${Date.now()}`),
      programId: String(form.get("programId") || "kfc"),
      timestamp: new Date().toISOString(),
      amount: Number(form.get("amount") || 0),
      storeId: String(form.get("storeId") || "store-1"),
      channel: String(form.get("channel") || "POS")
    };
    const res = await fetch("/api/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setLiveResult((await res.json()) as LiveResult);
    setLoading(false);
  }

  return (
    <>
      <SectionHeader
        title="Simulator"
        subtitle="Preview rule outcomes, batch simulate the next transactions, or fire a live rule-engine request."
      />

      <div className="card">
        <h3>Preview next transaction</h3>
        <form className="form-grid" onSubmit={handlePreview}>
          <div className="field">
            <label>Campaign</label>
            <select name="campaignId" defaultValue={campaigns[0]?.id ?? ""}>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Counter value</label>
            <input name="counterValue" type="number" min="1" defaultValue={1} />
          </div>
          <div className="field">
            <label>&nbsp;</label>
            <Button type="submit" disabled={loading}>
              {loading ? "Running..." : "Preview"}
            </Button>
          </div>
        </form>
        {previewResult ? (
          <div className="summary-grid" style={{ marginTop: 16 }}>
            <div className="summary-card">
              <h4>Matched rule</h4>
              <p>{previewResult.matchedRule?.name ?? "None"}</p>
              <p>{previewResult.matchedRule ? `Every ${previewResult.matchedRule.nth}` : "-"}</p>
            </div>
            <div className="summary-card">
              <h4>Reward</h4>
              <p>{previewResult.rewardTemplate?.name ?? "No reward"}</p>
              <p>{previewResult.rewardTemplate?.cvsCampaignId ? `CVS: ${previewResult.rewardTemplate.cvsCampaignId}` : "-"}</p>
            </div>
            <div className="summary-card">
              <h4>Total reward rate</h4>
              <p>{(previewResult.rewardRates.totalRate * 100).toFixed(2)}%</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="card">
        <h3>Batch simulation</h3>
        <form className="form-grid" onSubmit={handleBatch}>
          <div className="field">
            <label>Campaign</label>
            <select name="campaignId" defaultValue={campaigns[0]?.id ?? ""}>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Counter start</label>
            <input name="counterStart" type="number" min="0" defaultValue={0} />
          </div>
          <div className="field">
            <label>Transactions</label>
            <input name="count" type="number" min="1" defaultValue={1000} />
          </div>
          <div className="field">
            <label>Non-reward counter start</label>
            <input name="nonRewardCounterStart" type="number" min="0" defaultValue={0} />
          </div>
          <div className="field">
            <label>&nbsp;</label>
            <Button type="submit" disabled={loading}>
              {loading ? "Running..." : "Run batch"}
            </Button>
          </div>
        </form>
        {batchResult ? (
          <>
            <div className="summary-grid" style={{ marginTop: 16 }}>
              <div className="summary-card">
                <h4>Total rewards</h4>
                <p>{batchResult.totalRewards}</p>
              </div>
              <div className="summary-card">
                <h4>Non-rewards</h4>
                <p>{batchResult.nonRewardCount}</p>
              </div>
              <div className="summary-card">
                <h4>Expected entries</h4>
                <p>{batchResult.expectedCompetitionEntries.toFixed(1)}</p>
              </div>
            </div>
            <div className="card" style={{ marginTop: 16 }}>
              <h4>Reward tier counts</h4>
              <table className="table">
                <thead>
                  <tr>
                    <th>Rule</th>
                    <th>Winners</th>
                  </tr>
                </thead>
                <tbody>
                  {batchResult.rewardCounts.map((rule) => (
                    <tr key={rule.id}>
                      <td>
                        {rule.name} (Every {rule.nth})
                      </td>
                      <td>{rule.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>

      <div className="card">
        <h3>Live rule-engine request</h3>
        <form className="form-grid" onSubmit={handleLive}>
          <div className="field">
            <label>Program ID</label>
            <input name="programId" defaultValue="kfc" />
          </div>
          <div className="field">
            <label>Transaction ID</label>
            <input name="transactionId" defaultValue={`tx-${Date.now()}`} />
          </div>
          <div className="field">
            <label>Store ID</label>
            <input name="storeId" defaultValue="store-1" />
          </div>
          <div className="field">
            <label>Channel</label>
            <input name="channel" defaultValue="POS" />
          </div>
          <div className="field">
            <label>Amount (cents)</label>
            <input name="amount" type="number" min="0" defaultValue={2000} />
          </div>
          <div className="field">
            <label>&nbsp;</label>
            <Button type="submit" disabled={loading}>
              {loading ? "Processing..." : "Send to rule engine"}
            </Button>
          </div>
        </form>
        {liveResult ? (
          <>
            <div className="summary-grid" style={{ marginTop: 16 }}>
            <div className="summary-card">
              <h4>Outcome</h4>
              <p>{liveResult.decision.outcomeType}</p>
              <p>Status: {liveResult.decision.status}</p>
              <p>Counter: {liveResult.decision.counterValue}</p>
              <p>Rule: {liveResult.decision.matchedRuleId ?? "-"}</p>
            </div>
              <div className="summary-card">
                <h4>Reward</h4>
                <p>{liveResult.reward?.templateName ?? "None"}</p>
                <p>{liveResult.reward?.voucherCode ?? "-"}</p>
              </div>
              <div className="summary-card">
                <h4>Competition entry</h4>
                <p>{liveResult.competitionEntry?.granted ? "Granted" : "No entry"}</p>
              </div>
            </div>
            <div className="trace-list" style={{ marginTop: 16 }}>
              {liveResult.trace.map((step, index) => (
                <div className="trace-row" key={`${step.step}-${index}`}>
                  <strong>{step.step}</strong>
                  <span>{step.detail}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
