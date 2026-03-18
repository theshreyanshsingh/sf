import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) return new NextResponse("Missing code", { status: 400 });
  const returnedState = url.searchParams.get("state");
  const cookieStore = await cookies();
  const savedState = cookieStore.get("figma_state")?.value;
  console.log("figma_state cookie:", savedState);
  console.log("returned state:", returnedState);
  if (!returnedState || !savedState || returnedState !== savedState) {
    return new NextResponse("Invalid state", { status: 400 });
  }

  const clientId = process.env.NEXT_PUBLIC_FIGMA_CLIENT_ID || "";
  const clientSecret = process.env.FIGMA_CLIENT_SECRET || "";
  const nextAuthUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const origin = nextAuthUrl.endsWith("/")
    ? nextAuthUrl.slice(0, -1)
    : nextAuthUrl;
  const redirectUri = `${origin}/api/figma/callback`;

  // Debug logging for callback
  console.log("🔍 Debug - Callback redirect URI:", redirectUri);
  console.log("🔍 Debug - Domain used from NEXTAUTH_URL:", origin);

  const tokenRes = await fetch("https://api.figma.com/v1/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    console.error("Status", tokenRes.status);
    console.error("Body", await tokenRes.text());
    return new NextResponse(text || "Token exchange failed", { status: 400 });
  }
  const tokenJson = await tokenRes.json();
  cookieStore.set("figma_token", tokenJson.access_token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: tokenJson.expires_in || 3600,
  });
  cookieStore.delete("figma_state");

  // Redirect back to app
  return NextResponse.redirect(origin);
}
