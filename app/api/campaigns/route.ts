import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export async function GET() {
  const store = getStore();
  const campaigns = await store.listCampaigns();
  return NextResponse.json(campaigns);
}

export async function POST(request: Request) {
  const store = getStore();
  const payload = await request.json();
  const campaign = await store.createCampaign(payload);
  return NextResponse.json(campaign, { status: 201 });
}
