# yoyo-demo

Surprise & Delight Campaign Builder + Rule Engine demo for YoYo.

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:3000` and head to `/admin`.

## Environment

Copy `.env.example` to `.env` and fill in values if you want live integrations.

## Notes

- Mock mode is the default until CVS issuer and Earn Gateway credentials are provided.
- See `docs/rule-engine.md` for API contracts, data model, and operational notes.
- See `ASSUMPTIONS.md` for current constraints.

## Simulator

Use `/admin/simulator` to preview Nth rules, run batch simulations, or fire a live rule-engine request.
