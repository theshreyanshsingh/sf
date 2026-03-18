"use client";

import { signIn } from "next-auth/react";
import { API } from "../config/publicEnv";

const getSignInCallbackUrl = (): string => {
  const projectId = sessionStorage.getItem("projectId");
  if (projectId) {
    return `/projects/${projectId}`;
  }

  return "/";
};

export const signInWithProvider = async (providerId: "github" | "google") => {
  const callbackUrl = getSignInCallbackUrl();

  await signIn(providerId, { callbackUrl });
};

export const EmailLogin = async ({
  email,
}: {
  email: string;
}): Promise<{
  success: boolean;
  message: string;
  redirectUrl: string;
  error?: string;
}> => {
  try {
    const response = await fetch(`${API}/email-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const result = await response.json();
    return {
      success: result.success,
      message: result.message,
      redirectUrl: result.redirectUrl ?? "/",
    };
  } catch (error) {
    console.error("Login error:", error);
    return {
      success: false,
      message: "Something went wrong!",
      error: error instanceof Error ? error.message : String(error),
      redirectUrl: "/",
    };
  }
};

export const VerifyEmailLogin = async ({
  email,
  otp,
}: {
  email: string;
  otp: string;
}): Promise<{
  success: boolean;
  message: string;
  redirectUrl: string;
  email?: string;
  error?: string;
}> => {
  try {
    const response = await fetch(`${API}/verify-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp }),
    });

    const result = await response.json();

    if (result.success) {
      localStorage.setItem("email", result.email);
      localStorage.setItem("session", result.session);
    }

    return {
      success: result.success,
      message: result.message,
      redirectUrl: result.redirectUrl ?? "/",
      email: result.email,
    };
  } catch (error) {
    return {
      success: false,
      message: "Something went wrong!",
      error: error instanceof Error ? error.message : String(error),
      redirectUrl: "/",
    };
  }
};

export const regUser = async ({
  email,
  provider,
}: {
  email: string;
  provider: string;
}): Promise<{
  success: boolean;
  message: string;
  redirectUrl: string;
  email?: string;
  error?: string;
}> => {
  try {
    if (!email.trim()) {
      return {
        success: false,
        message: "Something went wrong!",
        error: "Invalid email",
        redirectUrl: "/",
      };
    }
    const response = await fetch(`${API}/user-provider`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, provider }),
    });

    const result = await response.json();

    if (result.success) {
      localStorage.setItem("email", result.email);
      localStorage.setItem("session", result.session);
    }

    return {
      success: result.success,
      message: result.message,
      redirectUrl: result.redirectUrl ?? "/",
      email: result.email,
    };
  } catch (error) {
    return {
      success: false,
      message: "Something went wrong!",
      error: error instanceof Error ? error.message : String(error),
      redirectUrl: "/",
    };
  }
};

export const sessionHelper = async ({
  email,
  session,
}: {
  email: string;
  session: string;
}) => {
  try {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Invalid email format");
    }

    const response = await fetch(`${API}/session-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, sessionId: session }),
    });

    const result = await response.json();

    return {
      success: result.success,
      message: result.message,
      redirectUrl: result.redirectUrl ?? "/",
    };
  } catch (error) {
    return {
      success: false,
      message: "Something went wrong!",
      error: error instanceof Error ? error.message : String(error),
      redirectUrl: "/",
    };
  }
};

export const JoinBeta = async ({
  email,
  name,
}: {
  email: string;
  name: string;
}) => {
  const response = await fetch(`${API}/join-beta`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name }),
  });
  const responseData = await response.json();

  return response.ok && responseData.success
    ? { success: true, message: "Request success!", redirectUrl: "/" }
    : {
        success: false,
        message: responseData.message,
        error: response.statusText,
      };
};

export const VerifyBeta = async ({
  email,
  name,
  otp,
}: {
  email: string;
  name: string;
  otp: string;
}) => {
  try {
    const response = await fetch(`${API}/verify-beta`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, otp }),
    });
    const result = await response.json();
    return {
      success: result.success,
      message: result.message,
      redirectUrl: result.redirectUrl ?? "/",
    };
  } catch (error) {
    return {
      success: false,
      message: "Something went wrong!",
      error: error instanceof Error ? error.message : String(error),
      redirectUrl: "/",
    };
  }
};
