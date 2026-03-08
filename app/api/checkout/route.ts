import { NextResponse } from "next/server";
import { createCheckoutSession } from "@/app/config/stripe";
import { getToken } from "next-auth/jwt";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const token = await getToken({
      req: request,
      secret: process.env.NEXT_PUBLIC_NEXTAUTH_SECRET,
    });

    // If no token exists, user is not authenticated
    if (!token) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    // Get email and id from request body
    const { email, id } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Create checkout session at runtime
    const checkout = await createCheckoutSession({ email, id });

    if (!checkout || !checkout.url) {
      throw new Error("Invalid checkout response: URL is missing");
    }

    // Return checkout URL instead of redirecting
    return NextResponse.json({ checkoutUrl: checkout.url });
  } catch (error) {
    console.error("Checkout creation error:", error);

    // Provide more specific error messages based on the error type
    if (error instanceof Error) {
      if (error.message.includes("Stripe secret key")) {
        return NextResponse.json(
          { error: "Stripe secret key is not configured" },
          { status: 500 }
        );
      } else if (error.message.includes("URL is missing")) {
        return NextResponse.json(
          { error: "Invalid checkout response: URL is missing" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
