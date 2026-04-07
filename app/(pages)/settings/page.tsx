"use client";
import React, { Suspense, useEffect, useState } from "react";

import { motion } from "framer-motion";
import { useAuthenticated } from "@/app/helpers/useAuthenticated";
import { useSettings } from "@/app/helpers/useSettings";
import PricingModal from "@/app/(pages)/_modals/PricingModal";
import { useDispatch } from "react-redux";
import { setPricingModalOpen } from "@/app/redux/reducers/basicData";
import moment from "moment";
import { BsLightningChargeFill } from "react-icons/bs";
import { setNotification } from "@/app/redux/reducers/NotificationModalReducer";
import { LuLoaderCircle } from "react-icons/lu";
import { Meteors } from "@/components/magicui/meteors";
import {
  ensureProjectCompletionNotificationPreference,
  setProjectCompletionNotificationEnabled,
} from "@/app/helpers/notificationPreferences";
import { useSearchParams } from "next/navigation";

const SettingsPageContent = () => {
  const [isManaging, setIsManaging] = useState(false);
  const [playCompletionNotification, setPlayCompletionNotification] =
    useState(false);

  const dispatch = useDispatch();
  const { email } = useAuthenticated();
  const { data: settings, isLoading: settingsLoading, refetch } = useSettings();
  const searchParams = useSearchParams();
  const maxPrompts =
    typeof settings?.maxPrompts === "number"
      ? settings.maxPrompts
      : settings?.plan === "scale"
        ? 100
        : 5;
  const promptsUsed =
    typeof settings?.promptsUsed === "number" ? settings.promptsUsed : 0;
  const remainingPrompts =
    typeof settings?.remainingPrompts === "number"
      ? settings.remainingPrompts
      : Math.max(0, maxPrompts - promptsUsed);
  const promptUsagePercent =
    maxPrompts > 0 ? Math.min(100, (promptsUsed / maxPrompts) * 100) : 0;

  useEffect(() => {
    setPlayCompletionNotification(
      ensureProjectCompletionNotificationPreference(),
    );
  }, []);

  // After Stripe redirects back, refresh settings to pick up webhook updates.
  useEffect(() => {
    const success = searchParams?.get("success");
    const canceled = searchParams?.get("canceled");
    if (success === "1" || canceled === "1") {
      void refetch();
    }
  }, [searchParams, refetch]);

  const formatNumber = (value: number) =>
    new Intl.NumberFormat("en-US").format(value);

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      dispatch(
        setNotification({
          modalOpen: true,
          status: "success",
          text: `${label} copied to clipboard.`,
        }),
      );
    } catch (error) {
      console.error("Clipboard error:", error);
      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: "Unable to copy. Please try again.",
        }),
      );
    }
  };

  const handleManageSubscription = async () => {
    if (isManaging) return;
    if (!email.value) {
      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: "We couldn't identify your billing email yet. Please refresh and try again.",
        }),
      );
      return;
    }

    try {
      setIsManaging(true);
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: settings?.stripeCustomerId || null,
          email: email.value,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to open billing portal");
      }

      const { url } = await response.json();
      if (!url) {
        throw new Error("Billing portal URL missing");
      }

      window.location.href = url;
    } catch (error) {
      console.error("Portal error:", error);
      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: "Unable to open billing portal. Please try again.",
        }),
      );
    } finally {
      setIsManaging(false);
    }
  };

  const handleToggleCompletionNotification = () => {
    const nextValue = !playCompletionNotification;
    setPlayCompletionNotification(nextValue);
    setProjectCompletionNotificationEnabled(nextValue);
  };

  return (
    <div className="h-[85vh] bg-[#000000] relative overflow-hidden">
      {/* Blue Gradient Background */}
      <div
        className="absolute inset-0 z-10 opacity-75 pointer-events-none"
        style={{
          backgroundImage: `
  radial-gradient(at 20% 90%, hsla(220, 70%, 25%, 0.3) 0px, transparent 50%),
  radial-gradient(at 50% 50%, hsla(240, 80%, 30%, 0.25) 0px, transparent 50%)
`,
        }}
      />

      {/* Grain Effect */}
      <div
        className="absolute inset-0 z-20"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 600 600' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
          opacity: 0.08,
          pointerEvents: "none",
        }}
      />

      <Meteors />

      <div className="relative z-30 flex flex-col space-y-4 p-4">
        <PricingModal />

        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-4"
        >
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1 font-sans">
            Settings
          </h1>
          <p className="text-[#b1b1b1] text-sm">
            Manage your account and preferences
          </p>
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.45fr)]">
          {/* User Profile Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="space-y-6"
          >
            <div className="bg-[#141415] border border-[#2a2a2b] rounded-xl p-6 backdrop-blur-sm">
              {/* Profile Header */}
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-[#4a90e2] to-[#5ba0f2] rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold text-xl">
                    {email.value?.charAt(0).toUpperCase() || "U"}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {settingsLoading ? (
                    <div className="h-5 w-32 bg-[#272628] rounded animate-pulse mx-auto"></div>
                  ) : (
                    email.value?.split("@")[0] || "User"
                  )}
                </h3>
                <div className="flex justify-center">
                  <span
                    className={`px-3 py-1 gap-x-1 border rounded-full font-sans font-medium justify-center items-center flex text-xs ${
                      settings?.plan === "scale"
                        ? "text-white bg-gradient-to-r from-[#4a90e2] to-[#5ba0f2] border-[#4a90e2] shadow-[0_0_8px_rgba(74,144,226,0.5)]"
                        : "text-black bg-white border-[#9E9D9F]"
                    }`}
                  >
                    {settings?.plan === "scale" ? "Scale" : "Free"}
                    {settings?.plan === "scale" && <BsLightningChargeFill />}
                  </span>
                </div>
                {settings?.plan === "scale" &&
                  settings?.daysLeftInSubscription > 0 && (
                    <p className="text-xs text-[#9E9D9F] mt-2">
                      {settings.daysLeftInSubscription} days left
                    </p>
                  )}
              </div>

              {/* Action Button */}
              {!settingsLoading && settings?.plan === "free" ? (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  onClick={() => {
                    dispatch(setPricingModalOpen(true));
                  }}
                  className="w-full justify-center items-center flex font-sans py-3 gap-x-2 font-medium text-white bg-[#4a90e2] rounded-lg hover:bg-[#5ba0f2] text-sm border border-[#4a90e2] cursor-pointer shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <BsLightningChargeFill />
                  Upgrade to Scale
                </motion.button>
              ) : (
                !settingsLoading && (
                  <div className="space-y-3">
                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      onClick={handleManageSubscription}
                      disabled={isManaging}
                      className="w-full justify-center items-center flex font-sans py-3 gap-x-2 font-medium text-gray-200 rounded-lg text-sm border border-[#272628] cursor-pointer hover:bg-[#1c1c1d] transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isManaging ? (
                        <LuLoaderCircle className="w-4 h-4 animate-spin" />
                      ) : (
                        <BsLightningChargeFill />
                      )}
                      Manage subscription
                    </motion.button>
                    {settings?.subscriptionEndDate && (
                      <p className="text-xs text-[#9E9D9F] text-center">
                        Renews at{" "}
                        {moment(settings?.subscriptionEndDate).format(
                          "DD/MM/YY",
                        )}
                      </p>
                    )}
                  </div>
                )
              )}
            </div>
            <div className="bg-[#141415] border border-[#2a2a2b] rounded-xl p-5 backdrop-blur-sm">
              <div className="mb-3 space-y-1">
                <h3 className="text-base font-semibold text-white">
                  Workspace overview
                </h3>
                <p className="text-sm text-[#9E9D9F]">
                  Track your projects and deployments in one place.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[#252528] bg-[#19191a] px-4 py-3.5">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#8C8C8C]">
                    Deployments
                  </p>
                  {settingsLoading ? (
                    <div className="mt-3 h-8 w-16 rounded bg-[#272628] animate-pulse" />
                  ) : (
                    <p className="mt-3 text-3xl font-semibold text-white">
                      {formatNumber(settings?.deployments ?? 0)}
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-[#252528] bg-[#19191a] px-4 py-3.5">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#8C8C8C]">
                    Projects
                  </p>
                  {settingsLoading ? (
                    <div className="mt-3 h-8 w-16 rounded bg-[#272628] animate-pulse" />
                  ) : (
                    <p className="mt-3 text-3xl font-semibold text-white">
                      {formatNumber(settings?.projectCount ?? 0)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Preferences and Billing */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="space-y-6"
          >
            <div className="bg-[#141415] border border-[#2a2a2b] rounded-xl p-5 backdrop-blur-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-white">
                    Project completion notification
                  </h3>
                  <p className="text-sm text-[#9E9D9F]">
                    Play the completion tone when a project finishes building.
                  </p>
                </div>

                <button
                  type="button"
                  aria-pressed={playCompletionNotification}
                  aria-label="Toggle project completion notification"
                  onClick={handleToggleCompletionNotification}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-200 ${
                    playCompletionNotification
                      ? "border-[#4a90e2] bg-[#4a90e2]"
                      : "border-[#303033] bg-[#202022]"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      playCompletionNotification
                        ? "translate-x-6"
                        : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="bg-[#141415] border border-[#2a2a2b] rounded-xl p-6 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-white">Usage</h4>
              </div>

              {!settingsLoading && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-white font-medium">Messages</p>
                    <p className="text-xs text-[#8C8C8C]">
                      {formatNumber(promptsUsed)}/{formatNumber(maxPrompts)} used
                    </p>
                  </div>
                  <div className="w-full bg-[#272628] h-3 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-[#7c5cff] to-[#a28bff] h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${promptUsagePercent}%`,
                      }}
                    ></div>
                  </div>
                  <p className="text-xs text-[#8C8C8C] text-center mt-2">
                    {formatNumber(remainingPrompts)} messages remaining.
                  </p>
                </div>
              )}

              {!settingsLoading && (
                <p className="text-xs text-[#8C8C8C] text-center">
                  {settings?.plan === "scale"
                    ? "Scale includes 100 messages per month."
                    : "Free includes 5 prompts to get started."}
                </p>
              )}
            </div>

            <div className="bg-[#141415] border border-[#2a2a2b] rounded-xl p-6 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-white">Billing</h4>
                <span className="text-xs text-[#8C8C8C]">
                  Managed via Stripe
                </span>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[#8C8C8C]">
                      Billing Email
                    </p>
                    <p className="text-sm text-white">
                      {settings?.email || email.value || "Not available"}
                    </p>
                  </div>
                  {(settings?.email || email.value) && (
                    <button
                      onClick={() =>
                        handleCopy(
                          settings?.email || email.value || "",
                          "Billing email",
                        )
                      }
                      className="text-xs text-[#8C8C8C] hover:text-white transition-colors"
                    >
                      Copy
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[#8C8C8C]">
                      Stripe Customer ID
                    </p>
                    <p className="text-sm text-white">
                      {settings?.stripeCustomerId
                        ? `${settings.stripeCustomerId.slice(0, 8)}...${settings.stripeCustomerId.slice(-4)}`
                        : "Not available yet"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

const Page = () => (
  <Suspense
    fallback={
      <div className="flex min-h-[85vh] items-center justify-center bg-[#000000]">
        <LuLoaderCircle className="h-8 w-8 animate-spin text-[#4a90e2]" />
      </div>
    }
  >
    <SettingsPageContent />
  </Suspense>
);

export default Page;
