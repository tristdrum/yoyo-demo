import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export async function GET(_: Request, context: { params: { id: string } }) {
  const store = getStore();
  const campaign = await store.getCampaign(context.params.id);
  if (!campaign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(campaign);
}

export async function PUT(request: Request, context: { params: { id: string } }) {
  const store = getStore();
  const payload = await request.json();
  const campaign = await store.updateCampaign(context.params.id, payload);
  if (!campaign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(campaign);
}
