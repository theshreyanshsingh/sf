import "server-only";

const readServerEnv = (key: string): string | undefined => {
  const raw = process.env[key];
  if (typeof raw !== "string") {
    return undefined;
  }
  const normalized = raw.trim();
  return normalized.length > 0 ? normalized : undefined;
};

export const STRIPE_SECRET_KEY = readServerEnv("STRIPE_SECRET_KEY");
export const STRIPE_WEBHOOK_SECRET = readServerEnv("STRIPE_WEBHOOK_SECRET");
export const STRIPE_PRICE_ID = readServerEnv("STRIPE_PRICE_ID");
export const STRIPE_SUCCESS_URL = readServerEnv("STRIPE_SUCCESS_URL");
export const STRIPE_CANCEL_URL = readServerEnv("STRIPE_CANCEL_URL");
export const STRIPE_PORTAL_RETURN_URL = readServerEnv("STRIPE_PORTAL_RETURN_URL");
