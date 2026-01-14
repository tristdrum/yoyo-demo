import { NextResponse } from "next/server";
import { buildDefaultConfig } from "@/lib/ruleEngine";
import { getStore } from "@/lib/store";

export async function GET(_: Request, context: { params: { id: string } }) {
  const store = getStore();
  const versions = await store.listCampaignVersions(context.params.id);
  return NextResponse.json(versions);
}

export async function POST(request: Request, context: { params: { id: string } }) {
  const store = getStore();
  const payload = await request.json();
  let config = buildDefaultConfig();
  if (payload.fromVersionId) {
    const source = await store.getCampaignVersion(String(payload.fromVersionId));
    if (source) {
      config = source.config;
    }
  }
  const version = await store.createCampaignVersion(context.params.id, config, "draft");
  return NextResponse.json(version, { status: 201 });
}
