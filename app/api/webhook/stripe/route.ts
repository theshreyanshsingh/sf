import Stripe from "stripe";
import { NextResponse } from "next/server";
import { API } from "@/app/config/publicEnv";
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from "@/app/config/Config";

export async function POST(request: Request) {
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Stripe webhook is not configured" },
      { status: 500 }
    );
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2024-06-20",
  });

  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Stripe webhook verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const internalWebhookToken = process.env.INTERNAL_WEBHOOK_TOKEN;
    const forwardHeaders: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (internalWebhookToken) {
      forwardHeaders["x-internal-webhook-token"] = internalWebhookToken;
    }

    await fetch(`${API}/webhook-sub`, {
      method: "POST",
      headers: forwardHeaders,
      body: JSON.stringify(event),
    });
  } catch (err) {
    console.error("Failed to forward Stripe webhook:", err);
  }

  return NextResponse.json({ received: true });
}
