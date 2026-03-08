import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("figma_token");
  return NextResponse.json({ connected: Boolean(token?.value) });
}
