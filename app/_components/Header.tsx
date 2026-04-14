"use client";

import React, { useState } from "react";
import Link from "next/link";
import { FaEllipsisVertical } from "react-icons/fa6";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { useDispatch } from "react-redux";

import { useAuthenticated } from "../helpers/useAuthenticated";
import { setPricingModalOpen } from "../redux/reducers/basicData";

/** First letter of the mailbox name, skipping stray punctuation (avoids odd glyphs next to the initial). */
function accountInitialFromEmail(email: string | null | undefined): string | null {
  if (!email || typeof email !== "string") return null;
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  const local = (at === -1 ? trimmed : trimmed.slice(0, at)).trim();
  const cleaned = local.replace(/^[^a-zA-Z0-9]+/, "");
  if (!cleaned.length) return null;
  return cleaned.charAt(0).toUpperCase();
}

const Header = ({ withBannerOffset = false }: { withBannerOffset?: boolean }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const router = useRouter();
  const dispatch = useDispatch();
  const pathname = usePathname();
  const { email, isAuthenticated } = useAuthenticated();

  const handleUpgrade = () => {
    dispatch(setPricingModalOpen(true));
  };

  const accountButtonClass =
    "flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border border-black/10 bg-white text-[9px] font-semibold leading-none text-black shadow-sm transition-colors hover:bg-white/95";

  const menuVariants = {
    hidden: { opacity: 0, y: -50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  };

  const modalVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.3, ease: "easeOut" },
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.2, ease: "easeIn" },
    },
  };

  const hoverEffect = {
    hover: {
      scale: 1.05,
      filter: "brightness(1.5) drop-shadow(0 0 8px rgba(255,255,255,0.25))",
      transition: { duration: 0.2 },
    },
  };

  const topOffsetClass = withBannerOffset ? "top-[52px] sm:top-[60px]" : "top-0";

  const handleSectionNavigation = (sectionId: "pricing" | "faq") => {
    setMenuOpen(false);

    if (pathname === "/") {
      document.getElementById(sectionId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }

    router.push(`/#${sectionId}`);
  };

  const handleGetStarted = () => {
    router.push("/login");
  };

  const handleSignIn = () => {
    if (isAuthenticated.value) {
      window.location.href = "/workspace/profile";
      return;
    }
    window.location.href = "/login";
  };

  const renderAccountText = accountInitialFromEmail(email.value);

  return (
    <>
      <motion.header
        initial="hidden"
        animate="visible"
        variants={menuVariants}
        className={`fixed ${topOffsetClass} left-0 right-0 z-10 bg-transparent backdrop-blur-md supports-[backdrop-filter]:bg-[#0a1220]/8`}
      >
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between md:hidden">
            <motion.div
              className="flex items-center space-x-1"
              whileHover="hover"
              variants={hoverEffect}
            >
              <Link href="/" className="flex items-center justify-center group">
                <span className="ml-2.5 text-sm font-[insSerifIt] font-semibold tracking-tight text-white">
                  Superblocks
                </span>
              </Link>
            </motion.div>

            <div className="flex items-center gap-2">
              {isAuthenticated.value ? (
                <>
                  <motion.button
                    type="button"
                    onClick={handleUpgrade}
                    className="inline-flex items-center justify-center rounded-md border border-white/15 bg-[#111214]/90 px-2 py-1 text-xs font-medium leading-none text-white"
                  >
                    Upgrade
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={handleSignIn}
                    aria-label="Open account"
                    className={accountButtonClass}
                  >
                    {renderAccountText ?? "U"}
                  </motion.button>
                </>
              ) : (
                <>
                  <motion.button
                    type="button"
                    onClick={handleGetStarted}
                    className="inline-flex items-center justify-center rounded-md border border-white/10 bg-white/95 px-2 py-1 text-xs font-medium leading-none text-black"
                  >
                    Get Started
                  </motion.button>
                  <button type="button" onClick={() => setMenuOpen(true)}>
                    <FaEllipsisVertical className="h-4 w-4 text-white" />
                  </button>
                </>
              )}
            </div>
          </div>

          {isAuthenticated.value ? (
            <div className="hidden h-14 items-center justify-between md:flex">
              <motion.div
                className="flex items-center space-x-1 sm:space-x-2"
                whileHover="hover"
                variants={hoverEffect}
              >
                <Link href="/" className="flex items-center justify-center group">
                  <span className="ml-2.5 text-sm font-[insSerifIt] font-semibold tracking-tight text-white sm:text-lg">
                    Superblocks
                  </span>
                </Link>
              </motion.div>

              <div className="flex items-center gap-2">
                <motion.button
                  type="button"
                  onClick={handleUpgrade}
                  whileHover="hover"
                  variants={hoverEffect}
                  className="inline-flex cursor-pointer items-center justify-center rounded-md border border-white/15 bg-[#111214]/90 px-2 py-1 text-xs font-medium leading-none text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:border-white/25"
                >
                  Upgrade
                </motion.button>
                <motion.button
                  type="button"
                  onClick={handleSignIn}
                  whileHover="hover"
                  variants={hoverEffect}
                  aria-label="Open account"
                  className={`${accountButtonClass} cursor-pointer`}
                >
                  {renderAccountText ?? "U"}
                </motion.button>
              </div>
            </div>
          ) : (
            <div className="hidden h-14 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 md:grid">
              <motion.div
                className="flex items-center justify-self-start space-x-1 sm:space-x-2"
                whileHover="hover"
                variants={hoverEffect}
              >
                <Link href="/" className="flex items-center justify-center group">
                  <span className="ml-2.5 text-sm font-[insSerifIt] font-semibold tracking-tight text-white sm:text-lg">
                    Superblocks
                  </span>
                </Link>
              </motion.div>

              <div className="hidden items-center justify-self-center space-x-8 md:flex">
                <motion.div whileHover="hover" variants={hoverEffect}>
                  <Link
                    href="/templates"
                    className="cursor-pointer text-xs font-medium text-gray-400 transition-colors hover:text-white"
                  >
                    Templates
                  </Link>
                </motion.div>
                <motion.div whileHover="hover" variants={hoverEffect}>
                  <button
                    type="button"
                    onClick={() => handleSectionNavigation("pricing")}
                    className="cursor-pointer text-xs font-medium text-gray-400 transition-colors hover:text-white"
                  >
                    Pricing
                  </button>
                </motion.div>
                <motion.div whileHover="hover" variants={hoverEffect}>
                  <button
                    type="button"
                    onClick={() => handleSectionNavigation("faq")}
                    className="cursor-pointer text-xs font-medium text-gray-400 transition-colors hover:text-white"
                  >
                    FAQ
                  </button>
                </motion.div>
              </div>

              <div className="hidden items-center justify-self-end space-x-2 md:flex">
                <motion.button
                  type="button"
                  onClick={handleSignIn}
                  whileHover="hover"
                  variants={hoverEffect}
                  className="inline-flex cursor-pointer items-center justify-center rounded-md border border-white/15 bg-[#111214]/90 px-2 py-1 text-xs font-medium leading-none text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors hover:border-white/25"
                >
                  Sign In
                </motion.button>
                <motion.button
                  type="button"
                  onClick={handleGetStarted}
                  whileHover="hover"
                  variants={hoverEffect}
                  className="inline-flex cursor-pointer items-center justify-center rounded-md border border-white/10 bg-white/95 px-2 py-1 text-xs font-medium leading-none text-black"
                >
                  Get Started
                </motion.button>
              </div>
            </div>
          )}
        </div>
      </motion.header>

      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={modalVariants}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0A0A0D]/85 text-white backdrop-blur-lg"
          >
            <button
              onClick={() => setMenuOpen(false)}
              className="absolute top-6 right-6 text-sm text-gray-400 transition-colors hover:text-white"
            >
              ✕
            </button>

            <nav className="flex flex-col items-center gap-5 text-center text-lg">
              <Link
                href="/templates"
                className="text-center text-sm font-medium text-gray-300 transition-colors hover:text-white"
                onClick={() => setMenuOpen(false)}
              >
                Templates
              </Link>
              <button
                type="button"
                className="text-center text-sm font-medium text-gray-300 transition-colors hover:text-white"
                onClick={() => handleSectionNavigation("pricing")}
              >
                Pricing
              </button>
              <button
                type="button"
                className="text-center text-sm font-medium text-gray-300 transition-colors hover:text-white"
                onClick={() => handleSectionNavigation("faq")}
              >
                FAQ
              </button>
              {!isAuthenticated.value ? (
                <Link
                  href="/login"
                  className="text-center text-sm font-medium text-gray-300 transition-colors hover:text-white"
                  onClick={() => setMenuOpen(false)}
                >
                  Sign In
                </Link>
              ) : null}
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>

    </>
  );
};

export default Header;
