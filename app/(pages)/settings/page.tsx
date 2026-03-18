"use client";
import React, { useState } from "react";

import { motion, AnimatePresence } from "framer-motion";
import { useAuthenticated } from "@/app/helpers/useAuthenticated";
import { useSettings } from "@/app/helpers/useSettings";
import { GoInfo } from "react-icons/go";
import PricingModal from "@/app/(pages)/_modals/PricingModal";
import { useDispatch } from "react-redux";
import { setPricingModalOpen } from "@/app/redux/reducers/basicData";
import moment from "moment";
import { BsLightningChargeFill } from "react-icons/bs";
import { setNotification } from "@/app/redux/reducers/NotificationModalReducer";
import { LuLoaderCircle } from "react-icons/lu";
import { Meteors } from "@/components/magicui/meteors";

const Page = () => {
  const [showDeploymentsTooltip, setShowDeploymentsTooltip] = useState(false);
  const [showProjectsTooltip, setShowProjectsTooltip] = useState(false);
  const [isManaging, setIsManaging] = useState(false);

  const dispatch = useDispatch();
  const { email } = useAuthenticated();
  const { data: settings, isLoading: settingsLoading } = useSettings();
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Profile Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="lg:col-span-1"
          >
            <div className="bg-[#141415] border border-[#2a2a2b] rounded-xl p-6 backdrop-blur-sm h-full">
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
          </motion.div>

          {/* Stats and Usage Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="lg:col-span-2 space-y-6"
          >
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Deployments Card */}
              <div className="bg-[#141415] border border-[#2a2a2b] rounded-xl p-4 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-white">
                    Deployments
                  </h4>
                  <div
                    className="cursor-pointer"
                    onMouseEnter={() => setShowDeploymentsTooltip(true)}
                    onMouseLeave={() => setShowDeploymentsTooltip(false)}
                  >
                    <GoInfo className="text-[#71717A] hover:text-white transition-colors" />
                    <AnimatePresence>
                      {showDeploymentsTooltip && (
                        <motion.div
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          className="absolute left-full ml-2 p-2 bottom-[1px] z-10 bg-[#28272a] rounded-md text-xs text-white whitespace-nowrap"
                        >
                          Number of deployments
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                {settingsLoading ? (
                  <div className="h-8 w-16 bg-[#272628] rounded animate-pulse"></div>
                ) : (
                  <p className="text-2xl font-bold text-white">
                    {settings?.deployments ?? 0}
                  </p>
                )}
              </div>

              {/* Projects Card */}
              <div className="bg-[#141415] border border-[#2a2a2b] rounded-xl p-4 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-white">Projects</h4>
                  <div
                    className="cursor-pointer"
                    onMouseEnter={() => setShowProjectsTooltip(true)}
                    onMouseLeave={() => setShowProjectsTooltip(false)}
                  >
                    <GoInfo className="text-[#71717A] hover:text-white transition-colors" />
                    <AnimatePresence>
                      {showProjectsTooltip && (
                        <motion.div
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          className="absolute left-full ml-2 p-2 bottom-[1px] z-10 bg-[#28272a] rounded-md text-xs text-white whitespace-nowrap"
                        >
                          Number of active projects
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                {settingsLoading ? (
                  <div className="h-8 w-16 bg-[#272628] rounded animate-pulse"></div>
                ) : (
                  <p className="text-2xl font-bold text-white">
                    {settings?.projectCount ?? 0}
                  </p>
                )}
              </div>
            </div>

            {/* Usage Card */}
            <div className="bg-[#141415] border border-[#2a2a2b] rounded-xl p-6 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-white">Usage</h4>
                <div className="text-right"></div>
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
                    ? "Scale includes 100 messages per billing cycle."
                    : "Free includes 5 prompts to get started."}
                </p>
              )}
            </div>

            {/* Billing Card */}
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

export default Page;
