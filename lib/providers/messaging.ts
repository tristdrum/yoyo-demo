export type MessagePayload = {
  to: string;
  body: string;
  reference?: string;
};

export type MessageResult = {
  status: "sent" | "failed";
  error?: string;
};

export type MessagingProvider = {
  sendWhatsApp: (payload: MessagePayload) => Promise<MessageResult>;
  sendSMS: (payload: MessagePayload) => Promise<MessageResult>;
};

class MockMessagingProvider implements MessagingProvider {
  constructor(private failureRate: number) {}

  async sendWhatsApp(): Promise<MessageResult> {
    const roll = Math.random();
    if (roll < this.failureRate) {
      return { status: "failed", error: "mock_whatsapp_failed" };
    }
    return { status: "sent" };
  }

  async sendSMS(): Promise<MessageResult> {
    return { status: "sent" };
  }
}

class LiveMessagingProvider implements MessagingProvider {
  private smsUrl: string | null;
  private smsKey: string | null;

  constructor() {
    this.smsUrl = process.env.SMS_API_URL ?? null;
    this.smsKey = process.env.SMS_API_KEY ?? null;
  }

  async sendWhatsApp(): Promise<MessageResult> {
    return { status: "failed", error: "whatsapp_not_configured" };
  }

  async sendSMS(payload: MessagePayload): Promise<MessageResult> {
    if (!this.smsUrl || !this.smsKey) {
      return { status: "failed", error: "sms_not_configured" };
    }

    const response = await fetch(this.smsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apiKey: this.smsKey
      },
      body: JSON.stringify({
        mobile: payload.to,
        text: payload.body,
        reference: payload.reference ?? `sms-${Date.now()}`
      })
    });

    if (!response.ok) {
      return { status: "failed", error: `sms_failed_${response.status}` };
    }

    return { status: "sent" };
  }
}

export function getMessagingProvider(): MessagingProvider {
  const mode = process.env.APP_MODE ?? "mock";
  if (mode === "live") {
    return new LiveMessagingProvider();
  }
  const failureRate = Number(process.env.MOCK_WHATSAPP_FAILURE_RATE ?? "0.35");
  return new MockMessagingProvider(Math.max(0, Math.min(1, failureRate)));
}
