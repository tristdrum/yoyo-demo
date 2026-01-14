# Surprise & Delight Rule Engine

## Overview
This demo adds a global (universe-based) Nth-transaction rule engine and campaign builder portal
for Surprise & Delight rewards. Transactions are evaluated per retailer/program, with a single
global counter per program.

## Earn Gateway → Rule Engine API
**Endpoint:** `POST /api/rule-engine`

**Request (JSON)**
```json
{
  "retailer_program_id": "kfc",
  "transaction_id": "tx-123",
  "timestamp": "2024-05-01T12:34:56.000Z",
  "amount": 2599,
  "store_id": "store-1",
  "channel": "POS",
  "mcc": "5814"
}
```

**Response (JSON)**
```json
{
  "decisionId": "uuid",
  "transactionId": "tx-123",
  "programId": "kfc",
  "counterValue": 100,
  "outcomeType": "reward",
  "status": "issued",
  "reward": {
    "templateId": "uuid",
    "templateName": "Big Reward",
    "voucherCode": "ABC123",
    "status": "issued"
  },
  "competitionEntry": {
    "granted": false,
    "messageTemplateId": null
  },
  "campaignVersionId": "uuid",
  "campaignVersionNumber": 1,
  "matchedRuleId": "rule-100",
  "matchedRuleN": 100,
  "matchedRulePriority": 100,
  "reason": "reward_issued",
  "trace": [
    { "step": "schedule", "detail": "active" },
    { "step": "eligibility", "detail": "eligible" },
    { "step": "counter", "detail": "100" },
    { "step": "rule", "detail": "Every 100th (100)" },
    { "step": "cvs", "detail": "issued" }
  ]
}
```

**Idempotency**
- `transaction_id` is unique. Replays return the same decision without incrementing counters.

## Rule Engine → CVS Issuer Integration
The rule engine calls the CVS issuer via `lib/providers/rewards.ts`.

**Env vars**
- `CVS_ISSUER_URL`
- `CVS_ISSUER_API_ID`
- `CVS_ISSUER_API_PASSWORD`
- `CVS_ISSUER_NUM_EXPIRY_DAYS` (optional)

**Payload (example)**
```json
{
  "userRef": "tx-123",
  "campaignId": 52441,
  "additionalInfo": "kfc:tx-123",
  "numExpiryDays": 7
}
```

## Data Model (Supabase)
Core tables:
- `sd_programs`: retailer/program registry (e.g., `kfc`).
- `sd_campaigns`: campaign container with status + schedule.
- `sd_campaign_versions`: published configs + rule sets (JSON config).
- `sd_program_counters`: global counter per program.
- `sd_non_reward_counters`: counter for every-Nth non-reward entries.
- `sd_decisions`: idempotent decision log per transaction.
- `reward_templates`: CVS template/product mapping.
- `message_templates`: optional WhatsApp/SMS content references.

RPCs:
- `sd_reserve_decision(...)`: atomic counter increment + decision reservation.
- `sd_increment_non_reward_counter(...)`: atomic non-reward counter increment.

## Operational Notes
- **Global counters:** Only eligible transactions increment the program counter.
- **Priority handling:** Highest priority matching rule wins (e.g., 100th > 20th > 5th).
- **Caps:** Optional daily/total caps are enforced per rule using decision logs.
- **Failure mode:** If CVS issuance fails, the decision is marked `issue_failed` and replayed requests
  do not double-increment counters.
- **Competition entry:** Granted only on non-reward outcomes, with optional probability or Nth rule.
