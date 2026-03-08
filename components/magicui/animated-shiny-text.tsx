import { ComponentPropsWithoutRef, CSSProperties, FC } from "react";

import { cn } from "@/lib/utils";

export interface AnimatedShinyTextProps
  extends ComponentPropsWithoutRef<"span"> {
  shimmerWidth?: number;
}

export const AnimatedShinyText: FC<AnimatedShinyTextProps> = ({
  children,
  className,
  shimmerWidth = 100,
  ...props
}) => {
  return (
    <span
      style={
        {
          "--shiny-width": `${shimmerWidth}px`,
        } as CSSProperties
      }
      className={cn(
        "mx-auto max-w-md text-blue-500",

        // Shine effect
        "bg-clip-text bg-no-repeat [background-position:0_0] [background-size:var(--shiny-width)_100%] [animation:shiny-text_8s_infinite]",

        // Shine gradient - stronger silver shimmer effect
        "bg-gradient-to-r from-transparent via-red-500 via-50% to-gray-500",

        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
