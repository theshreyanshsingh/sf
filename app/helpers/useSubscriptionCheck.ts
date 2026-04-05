"use client";

import { useCallback, useEffect, useState } from "react";
import { API } from "@/app/config/publicEnv";

type UseSubscriptionCheckProps = {
  isAuthenticated: boolean;
  email: string;
};

/**
 * Tracks whether the user is out of prompts (promptCount <= 0) for any plan.
 * Uses React state so the landing Hero updates after /sub-status resolves.
 */
export function useSubscriptionCheck({
  isAuthenticated,
  email,
}: UseSubscriptionCheckProps) {
  const [needsUpgrade, setNeedsUpgrade] = useState<boolean | null>(() =>
    !isAuthenticated ? false : null,
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setNeedsUpgrade(false);
      return;
    }
    setNeedsUpgrade(null);
  }, [isAuthenticated, email]);

  const checkSubscriptionStatus = useCallback(async () => {
    if (!isAuthenticated || !email) {
      setNeedsUpgrade(false);
      return false;
    }

    try {
      const response = await fetch(`${API}/sub-status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch subscription status");
      }

      const data = await response.json();
      const promptCount =
        typeof data.promptCount === "number" ? data.promptCount : null;
      const blocked = promptCount !== null && promptCount <= 0;
      setNeedsUpgrade(blocked);
      return blocked;
    } catch (error) {
      console.error("Error checking subscription status:", error);
      setNeedsUpgrade(false);
      return false;
    }
  }, [isAuthenticated, email]);

  return {
    needsUpgrade: !isAuthenticated ? false : needsUpgrade,
    /** Authenticated but /sub-status not completed yet */
    needsUpgradePending: Boolean(isAuthenticated && needsUpgrade === null),
    checkSubscriptionStatus,
  };
}
