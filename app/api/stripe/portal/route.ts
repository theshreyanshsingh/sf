import { NextResponse } from "next/server";
import { createBillingPortalSession } from "@/app/config/stripe";
import { NEXT_PUBLIC_APP_URL } from "@/app/config/publicEnv";
import { STRIPE_PORTAL_RETURN_URL } from "@/app/config/Config";
import { getToken } from "next-auth/jwt";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXT_PUBLIC_NEXTAUTH_SECRET,
    });

    if (!token) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { customerId, returnUrl, email } = await request.json();
    const tokenEmail =
      typeof (token as any)?.email === "string" ? String((token as any).email) : "";
    const resolvedEmail =
      tokenEmail.trim().length > 0 ? tokenEmail.trim() : typeof email === "string" ? email : "";

    if (!customerId && !resolvedEmail) {
      return NextResponse.json(
        { error: "Stripe customer ID or email is required" },
        { status: 400 }
      );
    }

    const envReturnUrl =
      (typeof STRIPE_PORTAL_RETURN_URL === "string" &&
        STRIPE_PORTAL_RETURN_URL.length > 0 &&
        STRIPE_PORTAL_RETURN_URL) ||
      (typeof NEXT_PUBLIC_APP_URL === "string" &&
        NEXT_PUBLIC_APP_URL.length > 0 &&
        NEXT_PUBLIC_APP_URL) ||
      null;

    const origin =
      (typeof returnUrl === "string" && returnUrl.length > 0
        ? returnUrl
        : request.headers.get("origin")) ||
      "http://localhost:3000";

    const finalReturnUrl = envReturnUrl
      ? envReturnUrl
      : `${origin.replace(/\/$/, "")}/workspace/profile`;

    const portal = await createBillingPortalSession({
      customerId,
      email: resolvedEmail,
      returnUrl: finalReturnUrl,
    });

    if (!portal || !portal.url) {
      throw new Error("Invalid portal response: URL is missing");
    }

    return NextResponse.json({ url: portal.url });
  } catch (error) {
    console.error("Portal session error:", error);

    if (error instanceof Error) {
      if (error.message.includes("Stripe secret key")) {
        return NextResponse.json(
          { error: "Stripe secret key is not configured" },
          { status: 500 }
        );
      }
      if (error.message.includes("Stripe customer ID")) {
        return NextResponse.json(
          {
            error:
              "No billing profile found yet. Please upgrade once before using the billing portal.",
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}
