import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export async function GET(_: Request, context: { params: { id: string } }) {
  const store = getStore();
  const version = await store.getCampaignVersion(context.params.id);
  if (!version) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(version);
}

export async function PUT(request: Request, context: { params: { id: string } }) {
  const store = getStore();
  const payload = await request.json();
  const version = await store.updateCampaignVersion(context.params.id, payload.config);
  if (!version) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(version);
}
