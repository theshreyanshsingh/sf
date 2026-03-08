import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = {
    NEXT_PUBLIC_API: process.env.NEXT_PUBLIC_API,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_RELICS_API: process.env.NEXT_PUBLIC_RELICS_API,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_NEXTAUTH_URL: process.env.NEXT_PUBLIC_NEXTAUTH_URL,
    NEXT_PUBLIC_SNACK_WEB_PLAYER_URL:
      process.env.NEXT_PUBLIC_SNACK_WEB_PLAYER_URL,
    NEXT_PUBLIC_PREVIEW_RUNTIME_DEFAULT:
      process.env.NEXT_PUBLIC_PREVIEW_RUNTIME_DEFAULT,
  };

  const body = `window.__SB_ENV__ = ${JSON.stringify(env)};`;

  return new NextResponse(body, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-store, max-age=0",
    },
  });
}
