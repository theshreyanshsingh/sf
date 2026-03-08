"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { API } from "../config/publicEnv";
import { useAuthenticated } from "../helpers/useAuthenticated";

import { useSelector } from "react-redux";
import { RootState } from "../redux/store";

type SubscriptionStatus = {
  success: boolean;
  plan: string;
  promptCount: number;
  promptLimit: number;
  subscriptionStatus: string;
  subscriptionEndDate: string | null;
  // Keep these fields for backward compatibility with the UI
  status?: string;
  amount?: string;
  transactionId?: string;
  date?: string;
};

type UseSubscriptionStatusReturn = {
  isLoading: boolean;
  error: string | null;
  subscriptionData: SubscriptionStatus | null;
};

export function useSubscriptionStatus(
  customerSessionToken: string | null
): UseSubscriptionStatusReturn {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionData, setSubscriptionData] =
    useState<SubscriptionStatus | null>(null);
  const fetchAttempted = useRef<boolean>(false);
  const cachedData = useRef<{
    data: SubscriptionStatus | null;
    timestamp: number;
  } | null>(null);
  const CACHE_DURATION = 60000; // Cache duration in milliseconds (1 minute)
  const router = useRouter();
  const { email, isAuthenticated } = useAuthenticated();
  const { id } = useSelector((state: RootState) => state.basicData);

  // Reset cache when email or authentication changes
  useEffect(() => {
    if (!email.value || !isAuthenticated.value) {
      cachedData.current = null;
      fetchAttempted.current = false;
    }
  }, [email.value, isAuthenticated.value]);

  useEffect(() => {
    // Don't proceed if no authentication and no token
    if (!customerSessionToken || !isAuthenticated.value || !email.value) {
      setError("Authentication required");
      setIsLoading(false);
      // Redirect to projects page if trying to access without proper authentication
      router.push("/projects/settings");
      return;
    }

    // Check if we have valid cached data
    const now = Date.now();
    if (
      cachedData.current &&
      now - cachedData.current.timestamp < CACHE_DURATION
    ) {
      setSubscriptionData(cachedData.current.data);
      setIsLoading(false);
      return;
    }

    // Prevent multiple fetches for the same email
    if (fetchAttempted.current) return;

    const verifySub = async () => {
      try {
        fetchAttempted.current = true;
        setIsLoading(true);
        setError(null);

        // const check = await verifySubscription({
        //   session: customerSessionToken,
        // });
        // console.log(check, "data");
        // localStorage.setItem("ss", check.status);
        const response = await fetch(`${API}/sub-status`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.value,
            id: id,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to verify subscription");
        }

        const data = await response.json();
        cachedData.current = { data, timestamp: Date.now() };
        setSubscriptionData(data);
      } catch (err) {
        console.error("Subscription verification error:", err);
        setError(
          err instanceof Error ? err.message : "Payment verification failed"
        );
        // Redirect to projects page on error
        router.push("/projects");
      } finally {
        setIsLoading(false);
      }
    };

    verifySub();
  }, [email.value, customerSessionToken, id, isAuthenticated.value]);

  return { isLoading, error, subscriptionData };
}
