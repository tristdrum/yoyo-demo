import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export async function GET() {
  const store = getStore();
  const messages = await store.listMessageTemplates();
  return NextResponse.json(messages);
}

export async function POST(request: Request) {
  const store = getStore();
  const payload = await request.json();
  const message = await store.createMessageTemplate(payload);
  return NextResponse.json(message, { status: 201 });
}
