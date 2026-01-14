# yoyo-demo

Surprise & Delight Campaign Builder demo for Yoyo.

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:3000` and head to `/admin`.

## Environment

Copy `.env.example` to `.env` and fill in values if you want live integrations.

## Notes

- Mock mode is the default until Earn Gateway and messaging credentials are provided.
- See `ASSUMPTIONS.md` for current constraints.

## Simulator note

Toggle "Call Earn Gateway" in `/admin/simulator` to hit the real Earn Gateway when live env vars are set.
