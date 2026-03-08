export type PublicEnvKey =
  | "NEXT_PUBLIC_API"
  | "NEXT_PUBLIC_APP_URL"
  | "NEXT_PUBLIC_RELICS_API"
  | "NEXT_PUBLIC_POSTHOG_KEY"
  | "NEXT_PUBLIC_POSTHOG_HOST"
  | "NEXT_PUBLIC_NEXTAUTH_URL"
  | "NEXT_PUBLIC_SNACK_WEB_PLAYER_URL"
  | "NEXT_PUBLIC_PREVIEW_RUNTIME_DEFAULT";

export type PublicEnv = Partial<Record<PublicEnvKey, string>>;

const readServerEnv = (key: PublicEnvKey): string | undefined => {
  if (typeof process === "undefined") {
    return undefined;
  }
  const raw = process.env ? process.env[key] : undefined;
  if (typeof raw !== "string") {
    return undefined;
  }
  const normalized = raw.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const readWindowEnv = (): PublicEnv | undefined => {
  if (typeof window === "undefined") {
    return undefined;
  }
  const env = (window as typeof window & { __SB_ENV__?: PublicEnv }).__SB_ENV__;
  if (!env || typeof env !== "object") {
    return undefined;
  }
  return env;
};

export const getPublicEnv = (): PublicEnv => {
  const windowEnv = readWindowEnv();
  if (windowEnv) {
    return windowEnv;
  }

  return {
    NEXT_PUBLIC_API: readServerEnv("NEXT_PUBLIC_API"),
    NEXT_PUBLIC_APP_URL: readServerEnv("NEXT_PUBLIC_APP_URL"),
    NEXT_PUBLIC_RELICS_API: readServerEnv("NEXT_PUBLIC_RELICS_API"),
    NEXT_PUBLIC_POSTHOG_KEY: readServerEnv("NEXT_PUBLIC_POSTHOG_KEY"),
    NEXT_PUBLIC_POSTHOG_HOST: readServerEnv("NEXT_PUBLIC_POSTHOG_HOST"),
    NEXT_PUBLIC_NEXTAUTH_URL: readServerEnv("NEXT_PUBLIC_NEXTAUTH_URL"),
    NEXT_PUBLIC_SNACK_WEB_PLAYER_URL: readServerEnv(
      "NEXT_PUBLIC_SNACK_WEB_PLAYER_URL",
    ),
    NEXT_PUBLIC_PREVIEW_RUNTIME_DEFAULT: readServerEnv(
      "NEXT_PUBLIC_PREVIEW_RUNTIME_DEFAULT",
    ),
  };
};

export const API = (() => {
  const { NEXT_PUBLIC_API } = getPublicEnv();
  return NEXT_PUBLIC_API;
})();

export const NEXT_PUBLIC_APP_URL = (() => {
  const { NEXT_PUBLIC_APP_URL } = getPublicEnv();
  return NEXT_PUBLIC_APP_URL;
})();

export const NEXT_PUBLIC_RELICS_API = (() => {
  const { NEXT_PUBLIC_RELICS_API } = getPublicEnv();
  return NEXT_PUBLIC_RELICS_API;
})();

export const NEXT_PUBLIC_POSTHOG_KEY = (() => {
  const { NEXT_PUBLIC_POSTHOG_KEY } = getPublicEnv();
  return NEXT_PUBLIC_POSTHOG_KEY;
})();

export const NEXT_PUBLIC_POSTHOG_HOST = (() => {
  const { NEXT_PUBLIC_POSTHOG_HOST } = getPublicEnv();
  return NEXT_PUBLIC_POSTHOG_HOST;
})();

export const NEXT_PUBLIC_NEXTAUTH_URL = (() => {
  const { NEXT_PUBLIC_NEXTAUTH_URL } = getPublicEnv();
  return NEXT_PUBLIC_NEXTAUTH_URL;
})();

export const NEXT_PUBLIC_SNACK_WEB_PLAYER_URL = (() => {
  const { NEXT_PUBLIC_SNACK_WEB_PLAYER_URL } = getPublicEnv();
  return NEXT_PUBLIC_SNACK_WEB_PLAYER_URL;
})();

export const NEXT_PUBLIC_PREVIEW_RUNTIME_DEFAULT = (() => {
  const { NEXT_PUBLIC_PREVIEW_RUNTIME_DEFAULT } = getPublicEnv();
  return NEXT_PUBLIC_PREVIEW_RUNTIME_DEFAULT;
})();
