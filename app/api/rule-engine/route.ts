import { NextResponse } from "next/server";
import { processTransaction } from "@/lib/decisionEngine";
import type { TransactionEvent } from "@/lib/types";

export async function POST(request: Request) {
  const payload = await request.json();
  const event: TransactionEvent = {
    transactionId: String(payload.transaction_id ?? payload.transactionId ?? ""),
    programId: String(payload.retailer_program_id ?? payload.retailerProgramId ?? payload.programId ?? ""),
    timestamp: String(payload.timestamp ?? new Date().toISOString()),
    amount: Number(payload.amount ?? 0),
    storeId: String(payload.store_id ?? payload.storeId ?? ""),
    channel: payload.channel ? String(payload.channel) : null,
    mcc: payload.mcc ? String(payload.mcc) : null,
    eligibility: payload.eligibility ?? undefined
  };

  if (!event.transactionId || !event.programId) {
    return NextResponse.json(
      { error: "transaction_id and retailer_program_id are required." },
      { status: 400 }
    );
  }

  try {
    const result = await processTransaction(event);
    return NextResponse.json({
      decisionId: result.decision.id,
      transactionId: result.decision.transactionId,
      programId: result.decision.programId,
      counterValue: result.decision.counterValue,
      outcomeType: result.decision.outcomeType,
      status: result.decision.status,
      reward: result.reward,
      competitionEntry: result.competitionEntry,
      campaignVersionId: result.decision.campaignVersionId,
      campaignVersionNumber: result.decision.campaignVersionNumber,
      matchedRuleId: result.decision.matchedRuleId,
      matchedRuleN: result.decision.matchedRuleN,
      matchedRulePriority: result.decision.matchedRulePriority,
      reason: result.reason,
      trace: result.trace
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message ?? "rule_engine_error" },
      { status: 500 }
    );
  }
}
