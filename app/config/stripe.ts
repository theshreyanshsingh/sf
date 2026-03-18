import Stripe from "stripe";
import {
  STRIPE_SECRET_KEY,
  STRIPE_SUCCESS_URL,
  STRIPE_CANCEL_URL,
  STRIPE_PRICE_ID,
} from "./Config";

let stripe: Stripe | null = null;
const SCALE_PLAN_PRICE_USD_CENTS = 2900;
const SCALE_PLAN_MESSAGE_LIMIT = 100;

const getStripe = () => {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("Stripe secret key is not configured");
  }
  if (!stripe) {
    stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20",
    });
  }
  return stripe;
};

export const createCheckoutSession = async ({
  email,
  id,
}: {
  email: string;
  id: string;
}) => {
  if (!STRIPE_SUCCESS_URL || !STRIPE_CANCEL_URL) {
    throw new Error("Stripe success/cancel URLs are not configured");
  }

  const client = getStripe();
  const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = STRIPE_PRICE_ID
    ? { price: STRIPE_PRICE_ID, quantity: 1 }
      : {
        price_data: {
          currency: "usd",
          unit_amount: SCALE_PLAN_PRICE_USD_CENTS,
          recurring: { interval: "month" as Stripe.Checkout.SessionCreateParams.LineItem.PriceData.Recurring.Interval },
          product_data: {
            name: "Superblocks Scale",
            description: `${SCALE_PLAN_MESSAGE_LIMIT} messages per billing cycle`,
          },
        },
        quantity: 1,
      };

  const clientReferenceId =
    typeof id === "string" && id.trim().length > 0 ? id.trim() : undefined;

  return client.checkout.sessions.create({
    mode: "subscription",
    line_items: [lineItem],
    success_url: STRIPE_SUCCESS_URL,
    cancel_url: STRIPE_CANCEL_URL,
    customer_email: email,
    ...(clientReferenceId ? { client_reference_id: clientReferenceId } : {}),
    allow_promotion_codes: true,
    metadata: {
      plan: "scale",
      message_limit: String(SCALE_PLAN_MESSAGE_LIMIT),
    },
    subscription_data: {
      metadata: {
        plan: "scale",
        message_limit: String(SCALE_PLAN_MESSAGE_LIMIT),
      },
    },
  });
};

export const createBillingPortalSession = async ({
  customerId,
  email,
  returnUrl,
}: {
  customerId?: string | null;
  email?: string | null;
  returnUrl: string;
}) => {
  const client = getStripe();
  let resolvedCustomerId = customerId || undefined;

  if (!resolvedCustomerId && email) {
    const customers = await client.customers.list({
      email,
      limit: 1,
    });
    if (customers.data.length > 0) {
      resolvedCustomerId = customers.data[0].id;
    }
  }

  if (!resolvedCustomerId) {
    throw new Error("Stripe customer ID is required");
  }
  return client.billingPortal.sessions.create({
    customer: resolvedCustomerId,
    return_url: returnUrl,
  });
};
