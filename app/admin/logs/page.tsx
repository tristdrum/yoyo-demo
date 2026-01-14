"use client";

import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui";
import type { DecisionLog } from "@/lib/types";

export default function LogsPage() {
  const [decisions, setDecisions] = useState<DecisionLog[]>([]);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/logs", { cache: "no-store" });
      const data = (await res.json()) as { decisions: DecisionLog[] };
      setDecisions(data.decisions ?? []);
    }
    void load();
  }, []);

  return (
    <>
      <SectionHeader title="Decision logs" subtitle="Inspect evaluated transactions and outcomes." />

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Transaction</th>
              <th>Program</th>
              <th>Counter</th>
              <th>Rule</th>
              <th>Outcome</th>
              <th>Voucher</th>
              <th>Entry</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {decisions.map((decision) => (
              <tr key={decision.id}>
                <td>{decision.transactionId}</td>
                <td>{decision.programId}</td>
                <td>{decision.counterValue}</td>
                <td>{decision.matchedRuleId ?? "-"}</td>
                <td>
                  {decision.outcomeType} · {decision.status}
                </td>
                <td>{decision.voucherCode ?? "-"}</td>
                <td>{decision.competitionEntry ? "Yes" : "No"}</td>
                <td>{new Date(decision.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
