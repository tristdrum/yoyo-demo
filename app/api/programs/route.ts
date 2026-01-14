import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export async function GET() {
  const store = getStore();
  const programs = await store.listPrograms();
  return NextResponse.json(programs);
}

export async function POST(request: Request) {
  const store = getStore();
  const payload = await request.json();
  const program = await store.createProgram(payload);
  return NextResponse.json(program, { status: 201 });
}
