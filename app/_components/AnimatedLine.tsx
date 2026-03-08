"use client";
import React from "react";

const AnimatedLine: React.FC = () => {
  return (
    <div className="px-6 py-4 relative overflow-hidden flex justify-center items-center rounded-xl space-x-3 border border-[#2a2a2a] shadow-2xl backdrop-blur-sm">
      {/* Animated gradient border */}
      <div className="absolute inset-0 rounded-xl animate-pulse" />

      {/* Grain Effect */}
      <div
        className="absolute inset-0 z-20 rounded-xl"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 600 600' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
          opacity: 0.05,
          pointerEvents: "none",
        }}
      />

      {/* Animated dots */}
      <div className="flex space-x-1">
        <div
          className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
          style={{ animationDelay: "0ms" }}
        />
        <div
          className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
          style={{ animationDelay: "150ms" }}
        />
        <div
          className="w-2 h-2 bg-pink-400 rounded-full animate-bounce"
          style={{ animationDelay: "300ms" }}
        />
      </div>

      <p className="text-sm font-medium text-white/90 tracking-wide">
        Loading your workspace
      </p>

      {/* Shimmer effect */}
      <div
        className="absolute inset-0 -top-1 -left-1 h-full animate-pulse transform -skew-x-12"
        style={{ animation: "shimmer 2s infinite" }}
      />
    </div>
  );
};

export default AnimatedLine;
