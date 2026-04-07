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
const ONE_DOLLAR_TEST_EMAILS = new Set([
  "theshreyanshsingh7@gmail.com",
  "sheeratgupta@gmail.com",
]);

export const isOneDollarTestUser = (email: string): boolean =>
  ONE_DOLLAR_TEST_EMAILS.has(String(email || "").trim().toLowerCase());

export const getScalePlanPriceCentsForEmail = (email: string): number =>
  isOneDollarTestUser(email) ? 100 : SCALE_PLAN_PRICE_USD_CENTS;

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
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const useOneDollar = isOneDollarTestUser(email);

  const lineItem: Stripe.Checkout.SessionCreateParams.LineItem =
    // For the two test users, force inline `price_data` so the amount is guaranteed $1
    // even if STRIPE_PRICE_ID is configured for normal users.
    useOneDollar || !STRIPE_PRICE_ID
      ? {
          price_data: {
            currency: "usd",
            unit_amount: getScalePlanPriceCentsForEmail(email),
            recurring: {
              interval:
                "month" as Stripe.Checkout.SessionCreateParams.LineItem.PriceData.Recurring.Interval,
            },
            product_data: {
              name: "Superblocks Scale",
              description: `${SCALE_PLAN_MESSAGE_LIMIT} messages per month`,
            },
          },
          quantity: 1,
        }
      : { price: STRIPE_PRICE_ID, quantity: 1 };

  const clientReferenceId =
    typeof id === "string" && id.trim().length > 0 ? id.trim() : undefined;

  return client.checkout.sessions.create({
    mode: "subscription",
    line_items: [lineItem],
    success_url: STRIPE_SUCCESS_URL,
    cancel_url: STRIPE_CANCEL_URL,
    /**
     * Let Stripe manage customer creation/association (previous behavior).
     * This avoids requiring restricted-key customer write permissions.
     */
    customer_email: normalizedEmail,
    ...(clientReferenceId ? { client_reference_id: clientReferenceId } : {}),
    allow_promotion_codes: true,
    metadata: {
      plan: "scale",
      message_limit: String(SCALE_PLAN_MESSAGE_LIMIT),
      email: normalizedEmail,
      ...(clientReferenceId ? { pubId: clientReferenceId } : {}),
      ...(useOneDollar ? { pricing_override: "one_dollar_test" } : {}),
    },
    subscription_data: {
      metadata: {
        plan: "scale",
        message_limit: String(SCALE_PLAN_MESSAGE_LIMIT),
        email: normalizedEmail,
        ...(clientReferenceId ? { pubId: clientReferenceId } : {}),
        ...(useOneDollar ? { pricing_override: "one_dollar_test" } : {}),
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
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (normalizedEmail) {
      const customers = await client.customers.list({
        email: normalizedEmail,
        limit: 1,
      });
      if (customers.data.length > 0) {
        resolvedCustomerId = customers.data[0]!.id;
      }
    }
  }

  if (!resolvedCustomerId) {
    throw new Error(
      "Stripe customer ID is required (no existing billing profile found).",
    );
  }
  return client.billingPortal.sessions.create({
    customer: resolvedCustomerId,
    return_url: returnUrl,
  });
};
