"use client";

import { useState } from "react";
import { Button, SectionHeader } from "@/components/ui";

export default function SimulatorPage() {
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const payload = {
      reference: String(form.get("reference") || "demo-ref"),
      amount: Number(form.get("amount") || 2000),
      storeRef: String(form.get("storeRef") || "162939"),
      customerRef: String(form.get("customerRef") || "alias-demo"),
      msisdn: String(form.get("msisdn") || "") || undefined,
      callEarnGateway: form.get("callEarnGateway") === "on"
    };
    const res = await fetch("/api/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = (await res.json()) as Record<string, unknown>;
    setResult(data);
    setLoading(false);
  }

  return (
    <>
      <SectionHeader
        title="Transaction Simulator"
        subtitle="Trigger the full decision flow: eligibility, reward issuance, and messaging fallback."
      />
      <div className="card">
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label>Reference</label>
            <input name="reference" defaultValue={`demo-${Date.now()}`} />
          </div>
          <div className="field">
            <label>Amount (cents)</label>
            <input name="amount" type="number" min="100" defaultValue={2000} />
          </div>
          <div className="field">
            <label>Store Ref</label>
            <input name="storeRef" defaultValue="162939" />
          </div>
          <div className="field">
            <label>Customer Alias</label>
            <input name="customerRef" defaultValue="alias-demo" />
          </div>
          <div className="field">
            <label>MSISDN (optional)</label>
            <input name="msisdn" placeholder="+27764119353" />
          </div>
          <div className="field">
            <label>&nbsp;</label>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" name="callEarnGateway" />
              Call Earn Gateway (live mode)
            </label>
          </div>
          <div className="field">
            <label>&nbsp;</label>
            <Button type="submit" disabled={loading}>
              {loading ? "Processing..." : "Send Event"}
            </Button>
          </div>
        </form>
      </div>

      {result ? (
        <div className="card">
          <SectionHeader title="Decision Trace" subtitle="Key outcomes from the last event." />
          <div className="summary-grid">
            <div className="summary-card">
              <h4>Event</h4>
              <p>Ref: {(result as any).event?.reference ?? "-"}</p>
              <p>Store: {(result as any).event?.storeRef ?? "-"}</p>
              <p>Customer: {(result as any).event?.customerRef ?? "-"}</p>
              <p>MSISDN: {(result as any).event?.msisdn ?? "-"}</p>
              <p>Amount: {(result as any).event?.amount ?? "-"}</p>
            </div>
            <div className="summary-card">
              <h4>Earn Gateway</h4>
              {(result as any).earnGateway?.error ? (
                <p className="pill pill-warn">{(result as any).earnGateway.error}</p>
              ) : (
                <p className="pill pill-neutral">No live call</p>
              )}
            </div>
            <div className="summary-card">
              <h4>Decision</h4>
              <p className={`pill ${(result as any).decision?.shouldIssue ? "pill-success" : "pill-warn"}`}>
                {(result as any).decision?.shouldIssue ? "Issued" : "Not issued"}
              </p>
              <p>Reason: {(result as any).decision?.reason ?? "-"}</p>
              <p>Reward: {(result as any).decision?.rewardTemplateId ?? "-"}</p>
            </div>
            <div className="summary-card">
              <h4>Reward Issue</h4>
              <p>Status: {(result as any).rewardIssue?.status ?? "-"}</p>
              <p>Voucher: {(result as any).rewardIssue?.voucherCode ?? "-"}</p>
              <p>Template: {(result as any).rewardIssue?.rewardTemplateId ?? "-"}</p>
            </div>
            <div className="summary-card">
              <h4>Messaging</h4>
              {(result as any).messageAttempts?.length ? (
                (result as any).messageAttempts.map((attempt: any, index: number) => (
                  <p key={`${attempt.channel}-${index}`}>
                    {attempt.channel}: {attempt.status}
                    {attempt.error ? ` (${attempt.error})` : ""}
                  </p>
                ))
              ) : (
                <p>No attempts</p>
              )}
            </div>
          </div>
          <div className="trace-list">
            {(result as any).decision?.trace?.map((step: any, index: number) => (
              <div className="trace-row" key={`${step.step}-${index}`}>
                <strong>{step.step}</strong>
                <span>{step.detail}</span>
              </div>
            ))}
          </div>
          <details style={{ marginTop: 16 }}>
            <summary>Raw response</summary>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </details>
        </div>
      ) : null}
    </>
  );
}
