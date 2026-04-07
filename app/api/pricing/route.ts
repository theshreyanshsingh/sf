import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getScalePlanPriceCentsForEmail } from "@/app/config/stripe";

export async function GET(request: Request) {
  try {
    const token = await getToken({
      req: request as any,
      secret: process.env.NEXT_PUBLIC_NEXTAUTH_SECRET,
    });

    if (!token || typeof (token as any).email !== "string") {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const email = String((token as any).email || "").trim();
    const priceCents = getScalePlanPriceCentsForEmail(email);

    return NextResponse.json({
      success: true,
      scale: {
        priceCents,
        currency: "usd",
        interval: "month",
      },
    });
  } catch (error) {
    console.error("Pricing route error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load pricing" },
      { status: 500 },
    );
  }
}

