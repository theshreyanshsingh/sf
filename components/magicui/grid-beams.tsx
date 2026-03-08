"use client";

import { motion } from "motion/react";
import React, { HTMLAttributes, useMemo } from "react";
import { cn } from "@/lib/utils";

const generateRayConfig = (index: number, total: number) => {
  const progress = index / Math.max(total - 1, 1);
  const leftPercent = 2 + progress * 96;
  const rotation = 28 - progress * 56;
  const variation = (index * 0.618) % 1;

  return {
    left: `${leftPercent}%`,
    rotation,
    width: 40 + variation * 25,
    duration: 6 + variation * 5,
    delay: -variation * 10,
    swayDuration: 12 + variation * 9,
    swayDelay: -variation * 10,
    blur: 24 + variation * 9,
    strongSway: index % 2 === 0,
  };
};

interface GridBeamsProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  rayCount?: number;
  rayOpacity?: number;
  raySpeed?: number;
  rayLength?: string;
  backgroundColor?: string;
}

interface LightRayProps {
  left: string;
  rotation: number;
  width: number;
  delay: number;
  duration: number;
  swayDuration: number;
  swayDelay: number;
  blurAmount: number;
  isStrongerSway: boolean;
  opacity: number;
  speed: number;
  length: string;
}

const LightRay = React.memo<LightRayProps>(function LightRay({
  left,
  rotation,
  width,
  delay,
  duration,
  swayDuration,
  swayDelay,
  blurAmount,
  isStrongerSway,
  opacity,
  speed,
  length,
}) {
  return (
    <motion.div
      className="absolute pointer-events-none -top-[5%] left-[var(--ray-left)] w-[var(--ray-width)] h-[var(--ray-height)] origin-top mix-blend-screen bg-[linear-gradient(to_bottom,rgba(200,220,255,var(--ray-opacity)),rgba(200,220,255,0))] blur-[var(--ray-blur)] translate-x-[-50%] rotate-[var(--ray-rotation)]"
      style={
        {
          "--ray-left": left,
          "--ray-width": `${width}px`,
          "--ray-height": length,
          "--ray-opacity": opacity,
          "--ray-blur": `${blurAmount}px`,
          "--ray-rotation": `${rotation}deg`,
        } as React.CSSProperties
      }
      animate={{
        opacity: [0.3, 0.7, 0.3],
        transform: [
          `translateX(-50%) rotate(${rotation}deg)`,
          `translateX(-50%) rotate(${rotation + (isStrongerSway ? 1 : 0.5)}deg)`,
          `translateX(-50%) rotate(${rotation}deg)`,
        ],
      }}
      transition={{
        opacity: {
          duration: duration / speed,
          delay: delay / speed,
          repeat: Infinity,
          ease: "easeInOut",
        },
        transform: {
          duration: swayDuration / speed,
          delay: swayDelay / speed,
          repeat: Infinity,
          ease: "easeInOut",
        },
      }}
    />
  );
});

export const GridBeams: React.FC<GridBeamsProps> = ({
  children,
  className,
  rayCount = 15,
  rayOpacity = 0.35,
  raySpeed = 1,
  rayLength = "45vh",
  backgroundColor = "#b5b5bc",
}) => {
  const rayConfigs = useMemo(() => {
    return Array.from({ length: rayCount }, (_, i) =>
      generateRayConfig(i, rayCount)
    );
  }, [rayCount]);

  return (
    <div
      className={cn("h-full", className)}
      style={
        {
          "--bg-color": backgroundColor,
        } as React.CSSProperties
      }
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {rayConfigs.map((config, index) => (
          <LightRay
            key={index}
            left={config.left}
            rotation={config.rotation}
            width={config.width}
            delay={config.delay}
            duration={config.duration}
            swayDuration={config.swayDuration}
            swayDelay={config.swayDelay}
            blurAmount={config.blur}
            isStrongerSway={config.strongSway}
            opacity={rayOpacity}
            speed={raySpeed}
            length={rayLength}
          />
        ))}
      </div>

      <div className="relative z-10">{children}</div>
    </div>
  );
};
