"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuthenticated } from "@/app/helpers/useAuthenticated";
import { useProject } from "@/app/helpers/useProject";
import { Meteors } from "@/components/magicui/meteors";

import { LuLoaderCircle } from "react-icons/lu";

import { WebContainerProvider } from "@/app/redux/useWebContainerContext";

const ProjectLayoutContent = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthenticated();

  // custom hook to fetch project data efficiently
  useProject();

  return (
    <div className="sm:max-md:w-full h-screen flex flex-col overflow-hidden bg-[#000000] ">
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

      <div className="relative z-30 flex-1 min-h-0 overflow-hidden">
        <AnimatePresence mode="wait">
          {isAuthenticated.value ? (
            <motion.div
              key="sheet"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="h-full min-h-0 md:flex-grow md:min-h-0"
            >
              {children}
            </motion.div>
          ) : (
            <motion.div
              key="line"
              className="flex justify-center items-center p-10 h-[90%] mt-1 flex-col space-y-4"
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <LuLoaderCircle className="text-white animate-spin" size={24} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <WebContainerProvider>
      <ProjectLayoutContent>{children}</ProjectLayoutContent>
    </WebContainerProvider>
  );
};

export default Layout;
