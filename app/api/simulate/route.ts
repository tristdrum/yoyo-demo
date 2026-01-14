import crypto from "crypto";
import { NextResponse } from "next/server";
import { evaluateCampaign } from "@/lib/evaluator";
import { registerTransaction, verifyTransaction } from "@/lib/providers/earnGateway";
import { getMessagingProvider } from "@/lib/providers/messaging";
import { getRewardsProvider } from "@/lib/providers/rewards";
import { getStore } from "@/lib/store";
import type { MessageTemplate, RewardIssue, TransactionEvent } from "@/lib/types";
import { toIso } from "@/lib/utils";

function renderTemplate(template: string, data: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? "");
}

function normalizeMsisdn(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.startsWith("+")) {
    return trimmed;
  }
  if (/^0\d{9}$/.test(trimmed)) {
    return `+27${trimmed.slice(1)}`;
  }
  return trimmed;
}

export async function POST(request: Request) {
  const payload = await request.json();
  const store = getStore();
  const now = new Date();
  const msisdn = normalizeMsisdn(payload.msisdn ? String(payload.msisdn) : null);
  const event: TransactionEvent = {
    id: crypto.randomUUID(),
    reference: String(payload.reference ?? "demo-ref"),
    amount: Number(payload.amount ?? 0),
    storeRef: String(payload.storeRef ?? ""),
    customerRef: String(payload.customerRef ?? ""),
    msisdn,
    createdAt: toIso(now)
  };

  await store.addEvent(event);

  let earnGateway: unknown = null;
  if (payload.callEarnGateway) {
    try {
      const verifyResponse = await verifyTransaction({
        reference: event.reference,
        amount: event.amount,
        customer: {
          type: "ALIAS",
          reference: event.customerRef
        },
        store: {
          type: "WIGROUP",
          reference: event.storeRef
        }
      });
      let registerResponse: unknown = null;
      if (verifyResponse.status === "customer_not_found" && event.msisdn) {
        registerResponse = await registerTransaction({
          reference: event.reference,
          amount: event.amount,
          customer: {
            type: "ALIAS",
            reference: event.customerRef,
            msisdn: event.msisdn
          },
          store: {
            type: "WIGROUP",
            reference: event.storeRef
          }
        });
      }
      earnGateway = { verify: verifyResponse, register: registerResponse };
    } catch (error) {
      earnGateway = { error: (error as Error).message };
    }
  }

  const campaigns = await store.listCampaigns();
  const campaign = campaigns.find((item) => item.status === "live") ?? campaigns[0];
  if (!campaign) {
    return NextResponse.json({
      event,
      earnGateway,
      decision: { shouldIssue: false, reason: "no_campaign" }
    });
  }

  const rewardTemplates = await store.listRewardTemplates();
  const logs = await store.listLogs();
  const decision = evaluateCampaign(event, campaign, rewardTemplates, logs.rewardIssues, {
    now
  });

  let rewardIssue: RewardIssue | null = null;
  const messageAttempts: Array<{ channel: string; status: string; error?: string | null }> = [];
  let rewardError: string | null = null;

  if (decision.shouldIssue && decision.rewardTemplateId) {
    const rewardProvider = getRewardsProvider();
    const selectedReward = rewardTemplates.find((reward) => reward.id === decision.rewardTemplateId);
    let rewardResult: { voucherCode: string; expiresAt: string } | null = null;
    try {
      rewardResult = await rewardProvider.issueReward({
        userRef: event.customerRef,
        templateId: decision.rewardTemplateId,
        cvsCampaignId: selectedReward?.cvsCampaignId ?? null,
        metadata: { additionalInfo: event.reference }
      });
    } catch (error) {
      rewardError = (error as Error).message;
    }

    if (!rewardResult) {
      rewardIssue = {
        id: crypto.randomUUID(),
        eventId: event.id,
        campaignId: campaign.id,
        rewardTemplateId: decision.rewardTemplateId,
        customerRef: event.customerRef,
        voucherCode: "ERROR",
        status: "failed",
        createdAt: toIso(now)
      };
      await store.addRewardIssue(rewardIssue);
      return NextResponse.json({ event, earnGateway, campaign, decision, rewardIssue, rewardError, messageAttempts });
    }

    rewardIssue = {
      id: crypto.randomUUID(),
      eventId: event.id,
      campaignId: campaign.id,
      rewardTemplateId: decision.rewardTemplateId,
      customerRef: event.customerRef,
      voucherCode: rewardResult.voucherCode,
      status: "issued",
      createdAt: toIso(now)
    };
    await store.addRewardIssue(rewardIssue);

    const messageTemplate = (await store.listMessageTemplates()).find(
      (template) => template.id === campaign.messageTemplateId
    ) as MessageTemplate | undefined;

    const rewardName =
      rewardTemplates.find((reward) => reward.id === decision.rewardTemplateId)?.name ??
      "Reward";

    const body = renderTemplate(messageTemplate?.body ?? "You earned {{reward}}.", {
      reward: rewardName,
      voucher: rewardResult.voucherCode
    });
    const fallback = renderTemplate(messageTemplate?.fallbackBody ?? "Code: {{voucher}}", {
      reward: rewardName,
      voucher: rewardResult.voucherCode
    });

    const messaging = getMessagingProvider();
    const whatsapp = await messaging.sendWhatsApp({
      to: event.msisdn ?? "unknown",
      body,
      reference: event.reference
    });

    await store.addMessageAttempt({
      id: crypto.randomUUID(),
      eventId: event.id,
      rewardIssueId: rewardIssue.id,
      channel: "whatsapp",
      status: whatsapp.status,
      error: whatsapp.error ?? null,
      createdAt: toIso(now)
    });
    messageAttempts.push({ channel: "whatsapp", status: whatsapp.status, error: whatsapp.error ?? null });

    if (whatsapp.status === "failed") {
      const sms = await messaging.sendSMS({
        to: event.msisdn ?? "unknown",
        body: fallback,
        reference: event.reference
      });
      await store.addMessageAttempt({
        id: crypto.randomUUID(),
        eventId: event.id,
        rewardIssueId: rewardIssue.id,
        channel: "sms",
        status: sms.status,
        error: sms.error ?? null,
        createdAt: toIso(now)
      });
      messageAttempts.push({ channel: "sms", status: sms.status, error: sms.error ?? null });
    }
  }

  return NextResponse.json({ event, earnGateway, campaign, decision, rewardIssue, rewardError, messageAttempts });
}
