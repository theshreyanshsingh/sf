"use client";
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthenticated } from "@/app/helpers/useAuthenticated";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/app/redux/store";
import { setPricingModalOpen } from "@/app/redux/reducers/basicData";

const PricingModal: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { email } = useAuthenticated();
  const { id } = useSelector((state: RootState) => state.basicData);
  const [displayPrice, setDisplayPrice] = useState<{
    dollars: number;
    suffix: string;
  }>({ dollars: 29, suffix: "/month" });
  // State and dispatch from Redux store for modal open statu
  const { pricingModalOpen } = useSelector(
    (state: RootState) => state.basicData
  );

  const dispatch = useDispatch();

  useEffect(() => {
    let cancelled = false;
    // Only fetch pricing when the modal is open (reduces calls).
    if (!pricingModalOpen) return;
    // Pricing is user-specific; only fetch when we have an email.
    if (!email.value) return;
    (async () => {
      try {
        const res = await fetch("/api/pricing", { method: "GET" });
        if (!res.ok) return;
        const data = (await res.json()) as any;
        const cents =
          typeof data?.scale?.priceCents === "number"
            ? data.scale.priceCents
            : null;
        if (!cancelled && typeof cents === "number" && cents > 0) {
          setDisplayPrice({ dollars: Math.round(cents / 100), suffix: "/month" });
        }
      } catch {
        // Keep default.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pricingModalOpen, email.value]);

  const handleUpgrade = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      // Validate if we have user email
      if (!email.value) {
        setError("User email not found. Please try again or contact support.");
        setIsLoading(false);
        return;
      }

      const response = await fetch("/api/checkout", {
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
        throw new Error("Failed to create checkout session");
      }

      const { checkoutUrl } = await response.json();
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error("Checkout error:", error);
      setError("Failed to process your request. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {pricingModalOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
            onClick={() => {
              dispatch(setPricingModalOpen(false));
            }}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[#141415] p-5 sm:p-6 rounded-2xl shadow-2xl border border-[#2a2a2b] w-[calc(100%-1.5rem)] max-w-lg max-h-[min(88vh,640px)] overflow-y-auto z-50 backdrop-blur-sm"
          >
            {/* Close Button */}
            <button
              onClick={() => dispatch(setPricingModalOpen(false))}
              className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-[#2a2a2b] hover:bg-[#3a3a3b] transition-colors duration-200 group"
            >
              <svg
                className="w-4 h-4 text-[#8C8C8C] group-hover:text-white transition-colors duration-200"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            {/* Header Section */}
            <div className="text-center mb-4">
              <div className="w-11 h-11 bg-gradient-to-br from-[#4a90e2] to-[#5ba0f2] rounded-full flex items-center justify-center mx-auto mb-2">
                <svg
                  className="w-5 h-5 text-white"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-1 font-[insSerifIt]">
                Scale
              </h3>
              <p className="text-[#b1b1b1] text-sm font-sans leading-snug px-1">
                100 messages per month for users ready to ship faster
              </p>
            </div>

            {/* Price Section */}
            <div className="text-center mb-4 py-3 px-4 bg-[#1c1c1d] rounded-xl border border-[#2a2a2b]">
              <div className="text-3xl font-bold text-white mb-0.5">
                ${displayPrice.dollars}
                <span className="text-lg font-normal text-[#71717A] ml-1.5">
                  {displayPrice.suffix}
                </span>
              </div>
              <p className="text-xs text-[#8C8C8C]">
                Built for consistent weekly usage
              </p>
            </div>

            {/* Features Grid */}
            <div className="mb-4">
              <h4 className="text-base font-semibold text-white mb-2 text-center">
                What&apos;s included
              </h4>
              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center gap-2.5 py-2 px-2.5 bg-[#1c1c1d] rounded-lg border border-[#2a2a2b]">
                  <div className="w-7 h-7 bg-[#4a90e2] rounded-full flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-3.5 h-3.5 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm leading-tight">
                      100 messages / month
                    </p>
                    <p className="text-[#8C8C8C] text-xs">
                      Resets monthly
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 py-2 px-2.5 bg-[#1c1c1d] rounded-lg border border-[#2a2a2b]">
                  <div className="w-7 h-7 bg-[#4a90e2] rounded-full flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-3.5 h-3.5 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">
                      Stripe billing portal
                    </p>
                    <p className="text-[#8C8C8C] text-xs">
                      Manage renewals and payment methods
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 py-2 px-2.5 bg-[#1c1c1d] rounded-lg border border-[#2a2a2b]">
                  <div className="w-7 h-7 bg-[#4a90e2] rounded-full flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-3.5 h-3.5 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">
                      Priority support
                    </p>
                    <p className="text-[#8C8C8C] text-xs">
                      Faster responses for billing and plan issues
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-3 p-2 bg-red-900/20 border border-red-500/30 rounded-lg"
              >
                <p className="text-red-400 text-xs text-center">{error}</p>
              </motion.div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2">
              <motion.button
                onClick={handleUpgrade}
                whileHover={{ scale: isLoading ? 1 : 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.2 }}
                disabled={isLoading}
                className={`w-full font-medium py-2.5 rounded-xl transition-all duration-300 text-xs font-sans flex justify-center items-center gap-2 ${
                  isLoading
                    ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-[#4a90e2] to-[#5ba0f2] text-white hover:from-[#5ba0f2] hover:to-[#6bb3f7] shadow-lg hover:shadow-xl"
                }`}
              >
                {isLoading ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Upgrade to Scale
                  </>
                )}
              </motion.button>
              <button
                type="button"
                onClick={() => dispatch(setPricingModalOpen(false))}
                className="w-full text-[#8C8C8C] hover:text-white py-1.5 text-xs font-sans transition-colors duration-200"
              >
                Maybe later
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PricingModal;
