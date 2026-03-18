import Sidebar from "../../_components/Sidebar";
import React from "react";
import { Meteors } from "@/components/magicui/meteors";

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen w-screen flex flex-col md:flex-row justify-start items-center bg-[#000000] relative overflow-hidden">
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

      {/* Sidebar */}
      {/* <Sidebar /> */}

      <div className="relative z-30 flex-1 overflow-hidden">{children}</div>
    </div>
  );
};

export default Layout;
