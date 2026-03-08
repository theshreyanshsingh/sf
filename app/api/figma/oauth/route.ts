import { NextRequest, NextResponse } from "next/server";

// Start OAuth by redirecting to Figma authorize URL
export async function GET(req: NextRequest) {
  const clientId = process.env.NEXT_PUBLIC_FIGMA_CLIENT_ID || "";
  if (!clientId) {
    return new NextResponse("Missing Figma client ID", { status: 500 });
  }

  const nextAuthUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const origin = nextAuthUrl.endsWith("/")
    ? nextAuthUrl.slice(0, -1)
    : nextAuthUrl;
  const redirectUri = `${origin}/api/figma/callback`;

  // Debug logging to see what URI is being generated
  console.log("🔍 Debug - Figma OAuth redirect URI:", redirectUri);
  console.log("🔍 Debug - Domain used from NEXTAUTH_URL:", origin);

  const scope = "files:read";
  const state = Math.random().toString(36).slice(2);

  const url = new URL("https://www.figma.com/oauth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");

  console.log("🔍 Debug - Final Figma OAuth URL:", url.toString());

  const res = NextResponse.redirect(url.toString());
  // Persist state for validation on the response
  res.cookies.set("figma_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
