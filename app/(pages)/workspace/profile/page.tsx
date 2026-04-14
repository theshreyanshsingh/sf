"use client";

import React, { Suspense, useEffect, useState } from "react";

import { motion } from "framer-motion";
import { useAuthenticated } from "@/app/helpers/useAuthenticated";
import { useSettings } from "@/app/helpers/useSettings";
import PricingModal from "@/app/(pages)/_modals/PricingModal";
import moment from "moment";
import { BsLightningChargeFill } from "react-icons/bs";
import { LuLoaderCircle } from "react-icons/lu";
import {
  ensureProjectCompletionNotificationPreference,
  setProjectCompletionNotificationEnabled,
} from "@/app/helpers/notificationPreferences";
import { useSearchParams } from "next/navigation";

const ProfilePageContent = () => {
  const [playCompletionNotification, setPlayCompletionNotification] =
    useState(false);

  const { email } = useAuthenticated();
  const { data: settings, isLoading: settingsLoading, refetch } = useSettings();
  const searchParams = useSearchParams();

  useEffect(() => {
    setPlayCompletionNotification(
      ensureProjectCompletionNotificationPreference(),
    );
  }, []);

  useEffect(() => {
    const success = searchParams?.get("success");
    const canceled = searchParams?.get("canceled");
    if (success === "1" || canceled === "1") {
      void refetch();
    }
  }, [searchParams, refetch]);

  const formatNumber = (value: number) =>
    new Intl.NumberFormat("en-US").format(value);

  const handleToggleCompletionNotification = () => {
    const nextValue = !playCompletionNotification;
    setPlayCompletionNotification(nextValue);
    setProjectCompletionNotificationEnabled(nextValue);
  };

  return (
    <div className="relative w-full min-w-0 text-xs">
      <PricingModal />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-6"
      >
        <h1 className="mb-1 font-sans text-xs font-semibold text-white">
          User profile
        </h1>
        <p className="text-xs text-[#b1b1b1]">
          Manage your account and preferences
        </p>
      </motion.div>

      <div className="flex w-full min-w-0 flex-col gap-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-gradient-to-br from-[#4a90e2] to-[#5ba0f2]">
            <span className="text-xs font-bold text-white">
              {email.value?.charAt(0).toUpperCase() || "U"}
            </span>
          </div>
          <h3 className="mb-2 text-xs font-semibold text-white">
            {settingsLoading ? (
              <div className="mx-auto h-5 w-32 animate-pulse rounded-md bg-white/10" />
            ) : (
              email.value?.split("@")[0] || "User"
            )}
          </h3>
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-3 py-1 font-sans text-xs font-medium text-[#e4e4e7] backdrop-blur-sm">
              {settings?.plan === "scale" ? "Scale" : "Free"}
              {settings?.plan === "scale" ? (
                <BsLightningChargeFill className="h-3 w-3 text-[#a1a1aa]" />
              ) : null}
            </span>
          </div>
          {settings?.plan === "scale" &&
            settings?.daysLeftInSubscription > 0 && (
              <p className="mt-2 text-xs text-[#9E9D9F]">
                {settings.daysLeftInSubscription} days left
              </p>
            )}
          {!settingsLoading &&
          settings?.plan === "scale" &&
          settings?.subscriptionEndDate ? (
            <p className="mt-4 text-xs text-[#9E9D9F]">
              Renews at{" "}
              {moment(settings.subscriptionEndDate).format("DD/MM/YY")}
            </p>
          ) : null}
        </div>

        <div className="rounded-md border border-[#2a2a2b]/80 bg-[#141415]/80 p-4 backdrop-blur-sm">
          <div className="mb-3 space-y-1">
            <h3 className="text-xs font-semibold text-white">
              Overview
            </h3>
            <p className="text-xs text-[#9E9D9F]">
              Track your projects and deployments in one place.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-[#252528] bg-[#19191a]/90 px-3 py-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#8C8C8C]">
                Deployments
              </p>
              {settingsLoading ? (
                <div className="mt-2 h-6 w-14 animate-pulse rounded-md bg-[#272628]" />
              ) : (
                <p className="mt-2 text-xs font-semibold text-white">
                  {formatNumber(settings?.deployments ?? 0)}
                </p>
              )}
            </div>

            <div className="rounded-md border border-[#252528] bg-[#19191a]/90 px-3 py-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#8C8C8C]">
                Projects
              </p>
              {settingsLoading ? (
                <div className="mt-2 h-6 w-14 animate-pulse rounded-md bg-[#272628]" />
              ) : (
                <p className="mt-2 text-xs font-semibold text-white">
                  {formatNumber(settings?.projectCount ?? 0)}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-md border border-[#2a2a2b]/80 bg-[#141415]/80 p-4 backdrop-blur-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h3 className="text-xs font-semibold text-white">
                Project completion notification
              </h3>
              <p className="text-xs text-[#9E9D9F]">
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
      </div>
    </div>
  );
};

const Page = () => (
  <Suspense
    fallback={
      <div className="flex min-h-[40vh] items-center justify-center">
        <LuLoaderCircle className="h-8 w-8 animate-spin text-[#4a90e2]" />
      </div>
    }
  >
    <ProfilePageContent />
  </Suspense>
);

export default Page;
