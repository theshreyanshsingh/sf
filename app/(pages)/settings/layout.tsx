"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { IoIosArrowForward } from "react-icons/io";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

const Layout = ({ children }: { children: React.ReactNode }) => {
  const handleLogout = async () => {
    localStorage.clear();
    sessionStorage.clear();
    signOut({ redirect: true, callbackUrl: "/" });
  };
  const router = useRouter();
  return (
    <div className="min-h-screen bg-[#000000] relative overflow-hidden">
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

      {/* Header */}
      <div className="relative z-30 border-b border-[#2a2a2b] flex justify-between items-center px-4 py-3 backdrop-blur-sm">
        <h2
          onClick={() => {
            router.push("/");
          }}
          className="cursor-pointer font-bold font-[insSerifIt] text-left text-white text-lg"
        >
          Superblocks
        </h2>
        <button
          onClick={handleLogout}
          className="justify-center items-center flex font-sans py-1.5 px-3 font-medium text-[#b1b1b1] hover:bg-[#1c1c1d] hover:text-white text-xs space-x-2 border border-[#2a2a2b] rounded-lg cursor-pointer transition-all duration-300"
        >
          Log out <IoIosArrowForward />
        </button>
      </div>

      {/* Content */}
      <section className="relative z-30 w-full h-full">{children}</section>

      <section className="relative z-30 justify-center w-full items-center flex py-4 border-t border-[#2a2a2b] px-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="text-center"
        >
          <p className="text-[#71717A] text-xs font-sans font-medium mb-1">
            Have feedback? Hit us at
          </p>
          <div className="flex justify-center items-center space-x-3">
            <Link
              href="mailto:support@superblocks.xyz"
              className="text-white cursor-pointer hover:text-[#7163F3] transition-colors duration-300 font-sans font-medium text-xs"
            >
              support@superblocks.xyz
            </Link>
          </div>
        </motion.div>
      </section>
    </div>
  );
};

export default Layout;
