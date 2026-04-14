"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";

import { motion } from "framer-motion";
import { useAuthenticated } from "@/app/helpers/useAuthenticated";
import { useSettings } from "@/app/helpers/useSettings";
import PricingModal from "@/app/(pages)/_modals/PricingModal";
import { useDispatch } from "react-redux";
import { setPricingModalOpen } from "@/app/redux/reducers/basicData";
import { setNotification } from "@/app/redux/reducers/NotificationModalReducer";
import { LuChevronDown, LuLoaderCircle } from "react-icons/lu";
import { useSearchParams } from "next/navigation";
import moment from "moment";

const btnOutline =
  "inline-flex shrink-0 items-center justify-center gap-1 rounded-md border border-[#3f3f46] bg-[#18181b] px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-[#27272a]";
const btnLight =
  "inline-flex shrink-0 items-center justify-center gap-1 rounded-md border border-white/20 bg-white px-2 py-1 text-xs font-medium text-black transition-colors hover:bg-white/90";
const btnGhost =
  "inline-flex shrink-0 items-center justify-center gap-1 rounded-md border border-transparent px-2 py-1 text-xs font-medium text-[#a1a1aa] transition-colors hover:bg-[#141415] hover:text-white";
const card =
  "rounded-md border border-[#27272a] bg-[#141414] px-4 py-4 text-xs";

const BillingPageContent = () => {
  const [isManaging, setIsManaging] = useState(false);

  const dispatch = useDispatch();
  const { email } = useAuthenticated();
  const { data: settings, refetch } = useSettings();
  const searchParams = useSearchParams();

  const renewalLabel = useMemo(() => {
    if (!settings?.subscriptionEndDate) return null;
    const end = moment(settings.subscriptionEndDate);
    return `Your subscription will auto renew on ${end.format("MMM D, YYYY")}.`;
  }, [settings?.subscriptionEndDate]);

  const resetHint = useMemo(() => {
    if (!settings?.subscriptionEndDate) return null;
    const end = moment(settings.subscriptionEndDate);
    const days = Math.max(0, end.diff(moment(), "days"));
    return `Resets on ${end.format("MMM D")} (${days} day${days === 1 ? "" : "s"})`;
  }, [settings?.subscriptionEndDate]);

  useEffect(() => {
    const success = searchParams?.get("success");
    const canceled = searchParams?.get("canceled");
    if (success === "1" || canceled === "1") {
      void refetch();
    }
  }, [searchParams, refetch]);

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

  const planIsScale = settings?.plan === "scale";
  const planTitle = planIsScale ? "Scale" : "Free";
  const planPrice = planIsScale ? "" : "$0/mo";

  return (
    <div className="relative w-full min-w-0 text-xs text-white">
      <PricingModal />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-6"
      >
        <h1 className="text-xs font-semibold tracking-tight text-white">
          Billing and spends
        </h1>
        <p className="mt-1 text-xs text-[#a1a1aa]">
          Plan, account details, and invoices.
        </p>
      </motion.div>

      <div className="flex w-full min-w-0 flex-col gap-4">
        <div className="overflow-hidden rounded-md border border-[#27272a] bg-[#141414]">
          <p className="border-b border-[#27272a] px-4 py-2.5 text-[10px] font-medium uppercase tracking-wide text-[#71717a]">
            Plan overview
          </p>
          <div className="grid lg:grid-cols-2 lg:divide-x lg:divide-[#27272a]">
            <div className="p-4 sm:p-5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-[#71717a]">
                Current plan
              </p>
              <p className="mt-2 text-xs font-semibold text-white">
                {planTitle}
                {planPrice ? (
                  <>
                    {" "}
                    <span className="font-normal text-[#a1a1aa]">
                      {planPrice}
                    </span>
                  </>
                ) : null}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-[#a1a1aa]">
                {planIsScale
                  ? "Higher message limits each billing period."
                  : "Get started with core building tools and limited messages each month."}
              </p>
              {renewalLabel ? (
                <p className="mt-2 text-xs text-[#a1a1aa]">{renewalLabel}</p>
              ) : resetHint ? (
                <p className="mt-2 text-xs text-[#a1a1aa]">{resetHint}</p>
              ) : null}
              {!planIsScale ? (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => dispatch(setPricingModalOpen(true))}
                    className={btnGhost}
                  >
                    Compare all plans
                  </button>
                </div>
              ) : null}
            </div>

            <div className="border-t border-[#27272a] bg-[#101012] p-4 sm:p-5 lg:border-t-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-[#71717a]">
                Scale
              </p>
              <p className="mt-2 text-xs leading-relaxed text-[#a1a1aa]">
                Unlock higher monthly message limits and keep building without
                running out.
              </p>
              <div className="mt-4">
                {!planIsScale ? (
                  <button
                    type="button"
                    onClick={() => dispatch(setPricingModalOpen(true))}
                    className={btnLight}
                  >
                    Upgrade
                  </button>
                ) : (
                  <p className="text-xs text-[#71717a]">
                    You&apos;re on Scale. Use Manage in Stripe below for billing
                    changes.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={card}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium text-white">Billing details</p>
              <p className="mt-1 text-xs text-[#a1a1aa]">
                Email and customer ID for support.
              </p>
            </div>
            {(settings?.email || email.value) && (
              <button
                type="button"
                onClick={() =>
                  handleCopy(
                    settings?.email || email.value || "",
                    "Billing email",
                  )
                }
                className={btnGhost}
              >
                Copy email
              </button>
            )}
          </div>
          <div className="mt-3 space-y-2 border-t border-[#27272a] pt-3 text-xs">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="text-[#71717a]">Billing email</span>
              <span className="break-all text-right text-white">
                {settings?.email || email.value || "—"}
              </span>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <span className="text-[#71717a]">Stripe customer ID</span>
              <span className="break-all text-right text-white">
                {settings?.stripeCustomerId
                  ? `${settings.stripeCustomerId.slice(0, 10)}…${settings.stripeCustomerId.slice(-4)}`
                  : "Not available yet"}
              </span>
            </div>
          </div>
        </div>

        <div className={card}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[#a1a1aa]">
              Change your plan, payment method, or cancel in Stripe.
            </p>
            <button
              type="button"
              onClick={handleManageSubscription}
              disabled={isManaging}
              className={btnOutline}
            >
              {isManaging ? (
                <LuLoaderCircle className="h-3 w-3 animate-spin" />
              ) : null}
              Manage in Stripe
            </button>
          </div>
        </div>

        <div className={card}>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-medium text-white">Invoices</p>
            <button
              type="button"
              className={`${btnOutline} border-[#3f3f46]`}
            >
              {moment().format("MMMM YYYY")}
              <LuChevronDown className="h-3 w-3" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-left text-xs">
              <thead className="sticky top-0 z-[1] bg-[#141414]">
                <tr className="border-b border-[#27272a] text-[#71717a]">
                  <th className="whitespace-nowrap py-2 pr-3 font-medium">
                    Date
                  </th>
                  <th className="whitespace-nowrap py-2 pr-3 font-medium">
                    Description
                  </th>
                  <th className="whitespace-nowrap py-2 pr-3 font-medium">
                    Status
                  </th>
                  <th className="whitespace-nowrap py-2 pr-3 font-medium">
                    Amount
                  </th>
                  <th className="whitespace-nowrap py-2 text-right font-medium">
                    Invoice
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="text-[#a1a1aa]">
                  <td colSpan={5} className="py-6 text-center text-xs">
                    No invoices yet.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex justify-end border-t border-[#27272a] pt-3">
            <span className="text-xs text-[#a1a1aa]">Subtotal:</span>
            <span className="ml-2 text-xs text-white">$0.00</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const Page = () => (
  <Suspense
    fallback={
      <div className="flex min-h-[40vh] items-center justify-center text-xs">
        <LuLoaderCircle className="h-6 w-6 animate-spin text-[#4a90e2]" />
      </div>
    }
  >
    <BillingPageContent />
  </Suspense>
);

export default Page;
