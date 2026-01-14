# Assumptions

- Earn Gateway and SMS live mode require env vars; the app defaults to mock mode unless configured.
- Supabase is configured; data is stored in the shared database.
- WhatsApp is mocked; SMS can be live if `SMS_API_URL` and `SMS_API_KEY` are set.
- Campaign evaluation uses a single active campaign (first "live" campaign) for the simulator.
- Reward issuance is simulated with a generated voucher code and a 7-day expiry.
- The demo is optimized for a functional walkthrough rather than production persistence.
