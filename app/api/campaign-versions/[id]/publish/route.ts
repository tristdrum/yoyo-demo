import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export async function POST(_: Request, context: { params: { id: string } }) {
  const store = getStore();
  const version = await store.publishCampaignVersion(context.params.id);
  if (!version) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(version);
}
