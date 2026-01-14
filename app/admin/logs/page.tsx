"use client";

import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui";
import type { LogsSnapshot } from "@/lib/types";

const emptyLogs: LogsSnapshot = { events: [], rewardIssues: [], messageAttempts: [] };

export default function LogsPage() {
  const [logs, setLogs] = useState<LogsSnapshot>(emptyLogs);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/logs", { cache: "no-store" });
      setLogs((await res.json()) as LogsSnapshot);
    }
    void load();
  }, []);

  return (
    <>
      <SectionHeader title="Logs" subtitle="Inspect events, rewards, and message attempts." />

      <div className="card">
        <h3>Recent events</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Customer</th>
              <th>Store</th>
              <th>Amount</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {logs.events.map((event) => (
              <tr key={event.id}>
                <td>{event.reference}</td>
                <td>{event.customerRef}</td>
                <td>{event.storeRef}</td>
                <td>{event.amount}</td>
                <td>{new Date(event.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Reward issues</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Reward</th>
              <th>Voucher</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {logs.rewardIssues.map((issue) => (
              <tr key={issue.id}>
                <td>{issue.campaignId.slice(0, 8)}</td>
                <td>{issue.rewardTemplateId.slice(0, 8)}</td>
                <td>{issue.voucherCode}</td>
                <td>{issue.status}</td>
                <td>{new Date(issue.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Message attempts</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Channel</th>
              <th>Status</th>
              <th>Error</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {logs.messageAttempts.map((attempt) => (
              <tr key={attempt.id}>
                <td>{attempt.channel}</td>
                <td>{attempt.status}</td>
                <td>{attempt.error ?? "-"}</td>
                <td>{new Date(attempt.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
