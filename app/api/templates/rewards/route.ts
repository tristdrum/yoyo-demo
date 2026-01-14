import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export async function GET() {
  const store = getStore();
  const rewards = await store.listRewardTemplates();
  return NextResponse.json(rewards);
}

export async function POST(request: Request) {
  const store = getStore();
  const payload = await request.json();
  const reward = await store.createRewardTemplate(payload);
  return NextResponse.json(reward, { status: 201 });
}
