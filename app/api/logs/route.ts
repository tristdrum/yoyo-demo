import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export async function GET() {
  const store = getStore();
  const decisions = await store.listDecisions();
  return NextResponse.json({ decisions });
}
