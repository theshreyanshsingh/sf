"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { IoIosArrowForward } from "react-icons/io";
import {
  LuChevronLeft,
  LuCreditCard,
  LuEllipsisVertical,
  LuFolderKanban,
  LuLayoutTemplate,
  LuUser,
  LuX,
} from "react-icons/lu";

import NavigationBanner from "@/app/_components/NavigationBanner";
import { Meteors } from "@/components/magicui/meteors";

const NAV_ITEMS = [
  {
    href: "/workspace/profile",
    label: "User profile",
    Icon: LuUser,
  },
  {
    href: "/workspace/list",
    label: "Projects",
    Icon: LuFolderKanban,
  },
  {
    href: "/workspace/your-templates",
    label: "Your templates",
    Icon: LuLayoutTemplate,
  },
  {
    href: "/workspace/billing",
    label: "Billing and spends",
    Icon: LuCreditCard,
  },
] as const;

function HubStarfallBackdrop() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 z-0 min-h-full w-full opacity-95"
        style={{
          backgroundImage: `
  radial-gradient(ellipse 120% 80% at 30% 20%, hsla(220, 75%, 30%, 0.55) 0px, transparent 55%),
  radial-gradient(ellipse 100% 70% at 70% 60%, hsla(240, 80%, 28%, 0.45) 0px, transparent 50%),
  radial-gradient(ellipse 80% 50% at 50% 100%, hsla(210, 70%, 22%, 0.35) 0px, transparent 45%)
`,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-0 min-h-full w-full"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 600 600' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
          opacity: 0.1,
        }}
      />
      <div className="pointer-events-none absolute inset-0 z-0 min-h-full w-full overflow-hidden">
        <Meteors />
      </div>
    </>
  );
}

/** Full-viewport cosmic shower behind the hub (under banner, header, sidebar, and main). */
function HubStarfallViewportLayer() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[5] min-h-[100dvh] overflow-hidden bg-[#030014]"
      aria-hidden
    >
      <HubStarfallBackdrop />
    </div>
  );
}

function SidebarNav({
  pathname,
  onNavClick,
  headerAction,
}: {
  pathname: string;
  onNavClick?: () => void;
  /** Mobile drawer only: top-right close control */
  headerAction?: React.ReactNode;
}) {
  return (
    <>
      {headerAction ? (
        <div className="flex shrink-0 items-center justify-end border-b border-white/10 px-3 py-2">
          {headerAction}
        </div>
      ) : null}
      <div className="flex flex-1 flex-col overflow-y-auto px-3 py-3">
        <nav className="space-y-0.5" aria-label="Account">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            const Icon = item.Icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavClick}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                  active
                    ? "bg-white/15 text-white"
                    : "text-[#a1a1aa] hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}

export default function ProjectsHubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const hubChromeRef = useRef<HTMLDivElement>(null);
  /** Measured height of Banzai + hub bar — single source of truth for sidebar top & main offset (no guessed px). */
  const [hubChromePx, setHubChromePx] = useState(84);

  useLayoutEffect(() => {
    const el = hubChromeRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const measure = () => {
      const h = el.getBoundingClientRect().height;
      if (h > 0) setHubChromePx(h);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  const handleLogout = async () => {
    localStorage.clear();
    sessionStorage.clear();
    signOut({ redirect: true, callbackUrl: "/" });
  };

  return (
    <div className="relative flex min-h-dvh min-h-0 w-full min-w-0 flex-1 flex-col bg-transparent text-xs text-white">
      <HubStarfallViewportLayer />

      {/* Single fixed stack — height is measured so sidebar `top` and main margin always match (zero seam). */}
      <div
        ref={hubChromeRef}
        className="fixed top-0 right-0 left-0 z-40 flex flex-col bg-transparent"
      >
        <NavigationBanner
          fixed={false}
          className="border-b border-white/10 bg-[#007be1]/88 backdrop-blur-md"
        />
        <header className="flex h-9 shrink-0 items-center justify-between gap-1 border-b border-white/10 bg-black/45 px-0 pr-2 backdrop-blur-md sm:h-10 sm:gap-2 sm:pl-0.5 sm:pr-3">
          <div className="flex min-h-9 min-w-0 flex-1 items-center gap-0.5 sm:min-h-10">
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[#a1a1aa] transition-colors hover:bg-white/10 hover:text-white sm:h-10 md:hidden"
              aria-expanded={mobileNavOpen}
              aria-controls="hub-mobile-nav"
              aria-label="Open account menu"
              onClick={() => setMobileNavOpen(true)}
            >
              <LuEllipsisVertical className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => { window.location.href = "/"; }}
              className="inline-flex min-h-9 min-w-0 flex-1 items-center gap-1 rounded-md py-0 pr-2 pl-0 text-xs font-medium leading-none text-[#a1a1aa] transition-colors cursor-pointer hover:text-white sm:min-h-10 md:flex-initial md:pl-0.5"
            >
              <LuChevronLeft
                className="hidden h-2.5 w-2.5 shrink-0 md:inline"
                aria-hidden
              />
              <span className="truncate">Back to building</span>
            </button>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/15 bg-black/25 px-2 py-0.5 text-xs font-medium leading-none text-[#e4e4e7] transition-colors hover:bg-white/10 hover:text-white sm:py-1"
          >
            Log out <IoIosArrowForward className="h-3 w-3" aria-hidden />
          </button>
        </header>
      </div>

      <div
        className="flex min-h-0 flex-1 flex-col md:flex-row"
        style={{
          marginTop: hubChromePx,
          minHeight: `calc(100dvh - ${hubChromePx}px)`,
        }}
      >
        <aside
          className="hidden w-full shrink-0 flex-col border-b border-white/10 bg-black/45 backdrop-blur-xl md:flex md:fixed md:left-0 md:z-30 md:w-72 md:max-w-[18rem] md:border-b-0 md:border-r md:border-white/10"
          style={{
            top: hubChromePx,
            height: `calc(100dvh - ${hubChromePx}px)`,
          }}
        >
          <div className="flex h-full min-h-0 flex-col md:overflow-hidden">
            <SidebarNav pathname={pathname} />
          </div>
        </aside>

        <AnimatePresence>
          {mobileNavOpen ? (
            <>
              <motion.button
                type="button"
                key="hub-nav-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                style={{ top: hubChromePx }}
                className="fixed right-0 bottom-0 left-0 z-[45] bg-black/50 backdrop-blur-[2px] md:hidden"
                aria-label="Close menu"
                onClick={() => setMobileNavOpen(false)}
              />
              <motion.aside
                id="hub-mobile-nav"
                key="hub-nav-panel"
                role="dialog"
                aria-modal="true"
                aria-label="Account navigation"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "tween", duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                style={{ top: hubChromePx }}
                className="fixed bottom-0 left-0 z-[50] flex w-[min(18rem,88vw)] max-w-[18rem] flex-col border-r border-white/10 bg-black/55 shadow-xl backdrop-blur-xl md:hidden"
              >
                <div className="flex h-full min-h-0 flex-col overflow-hidden">
                  <SidebarNav
                    pathname={pathname}
                    onNavClick={() => setMobileNavOpen(false)}
                    headerAction={
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#a1a1aa] transition-colors hover:bg-[#141415] hover:text-white"
                        aria-label="Close menu"
                        onClick={() => setMobileNavOpen(false)}
                      >
                        <LuX className="h-4 w-4" aria-hidden />
                      </button>
                    }
                  />
                </div>
              </motion.aside>
            </>
          ) : null}
        </AnimatePresence>

        <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col md:ml-72">
          <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 sm:px-4 md:px-5 md:py-4">
              {children}
            </div>
            <footer className="relative z-10 shrink-0 border-t border-[#2a2a2b]/80 bg-black/30 px-2 py-2.5 backdrop-blur-sm sm:px-4">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="text-center text-xs"
              >
                <p className="mb-1 font-medium text-[#71717A]">
                  Have feedback? Hit us at
                </p>
                <Link
                  href="mailto:support@superblocks.xyz"
                  className="font-medium text-white transition-colors hover:text-[#7163F3]"
                >
                  support@superblocks.xyz
                </Link>
              </motion.div>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
