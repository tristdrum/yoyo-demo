import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export async function GET() {
  const store = getStore();
  const logs = await store.listLogs();
  return NextResponse.json(logs);
}
