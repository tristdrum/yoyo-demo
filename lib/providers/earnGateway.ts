export type EarnGatewayCustomer = {
  type: "ALIAS";
  reference: string;
  msisdn?: string;
};

export type EarnGatewayStore = {
  type: "WIGROUP" | "REMOTE";
  reference: string;
};

export type EarnGatewayTransaction = {
  reference: string;
  amount: number;
  customer: EarnGatewayCustomer;
  store: EarnGatewayStore;
  products?: Array<{ id: string; units: number; pricePerUnit: number }>;
  intent?: "REASSIGN_ALIAS";
};

export type EarnGatewayResult =
  | { status: "success"; raw: unknown }
  | { status: "customer_not_found"; registrationUrl?: string; raw: unknown }
  | { status: "error"; error: string; raw?: unknown };

function baseUrl() {
  const url = process.env.EARN_GATEWAY_BASE_URL;
  if (!url) {
    throw new Error("EARN_GATEWAY_BASE_URL is not set.");
  }
  return url.replace(/\/$/, "");
}

function buildEndpoint(base: string) {
  if (base.endsWith("/api")) {
    return `${base}/earngateway/channel/events/transactional`;
  }
  return `${base}/api/earngateway/channel/events/transactional`;
}

function headers() {
  const apiKey = process.env.EARN_GATEWAY_API_KEY;
  const consumerId = process.env.EARN_GATEWAY_CONSUMER_ID;
  if (!apiKey || !consumerId) {
    throw new Error("Earn Gateway credentials are missing.");
  }
  return {
    "X-consumer-id": consumerId,
    "Content-Type": "application/json",
    Accept: "*/*",
    apiKey
  } as const;
}

async function postTransaction(payload: EarnGatewayTransaction): Promise<EarnGatewayResult> {
  const response = await fetch(buildEndpoint(baseUrl()), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload)
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch (error) {
    body = null;
  }

  if (response.ok) {
    return { status: "success", raw: body };
  }

  if (response.status === 400 || response.status === 404) {
    const errors = (body as any)?.errors ?? [];
    const customerMissing = errors.find((err: any) => err.code === "0103");
    if (customerMissing) {
      return {
        status: "customer_not_found",
        registrationUrl: (body as any)?.registrationUrl,
        raw: body
      };
    }
  }

  return {
    status: "error",
    error: `Earn Gateway request failed (${response.status})`,
    raw: body
  };
}

export async function verifyTransaction(
  payload: EarnGatewayTransaction
): Promise<EarnGatewayResult> {
  return postTransaction(payload);
}

export async function registerTransaction(
  payload: EarnGatewayTransaction
): Promise<EarnGatewayResult> {
  return postTransaction(payload);
}
