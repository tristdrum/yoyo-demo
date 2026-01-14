import { NextResponse } from "next/server";
import { processTransaction } from "@/lib/decisionEngine";
import { simulateBatch, previewDecision } from "@/lib/simulator";
import { getStore } from "@/lib/store";
import type { TransactionEvent } from "@/lib/types";

export async function POST(request: Request) {
  const payload = await request.json();
  const store = getStore();
  const mode = String(payload.mode ?? "preview");

  if (mode === "live") {
    const event: TransactionEvent = {
      transactionId: String(payload.transactionId ?? `demo-${Date.now()}`),
      programId: String(payload.programId ?? "kfc"),
      timestamp: String(payload.timestamp ?? new Date().toISOString()),
      amount: Number(payload.amount ?? 0),
      storeId: String(payload.storeId ?? "store-1"),
      channel: payload.channel ? String(payload.channel) : null,
      mcc: payload.mcc ? String(payload.mcc) : null,
      eligibility: payload.eligibility ?? undefined
    };
    const result = await processTransaction(event);
    return NextResponse.json(result);
  }

  const campaignId = String(payload.campaignId ?? "");
  if (!campaignId) {
    return NextResponse.json({ error: "campaignId is required." }, { status: 400 });
  }
  const campaign = await store.getCampaign(campaignId);
  if (!campaign || !campaign.currentVersion) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }
  const rewardTemplates = await store.listRewardTemplates();

  if (mode === "batch") {
    const counterStart = Number(payload.counterStart ?? 0);
    const count = Number(payload.count ?? 1000);
    const nonRewardCounterStart = Number(payload.nonRewardCounterStart ?? 0);
    const result = simulateBatch(counterStart, count, campaign.currentVersion.config, nonRewardCounterStart);
    return NextResponse.json(result);
  }

  const counterValue = Number(payload.counterValue ?? 1);
  const result = previewDecision(counterValue, campaign.currentVersion.config, rewardTemplates);
  return NextResponse.json(result);
}
