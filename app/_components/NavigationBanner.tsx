"use client";

import React from "react";
import Link from "next/link";

const NavigationBanner = () => {
  return (
    <div className="fixed top-0 left-0 right-0 w-full bg-[#007be1] z-20">
      <div className="px-2 sm:px-6 lg:px-8">
        <div className="py-1 sm:py-3">
          <div className="mx-auto">
            <div className="flex flex-row items-center justify-between gap-1 sm:gap-4 whitespace-nowrap">
              {/* Left Column - Logo and Text */}
              <div className="flex items-center sm:items-end gap-1 sm:gap-3 flex-wrap justify-center ">
                <div className="flex-shrink-0">
                  <div className="w-[45px] h-[21px] sm:w-[80px] sm:h-[25px]">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="100%"
                      height="100%"
                      viewBox="0 0 84.074 20.729"
                      className="text-white"
                    >
                      <path
                        id="Banzai Logo"
                        d="M24132.961,6409.842h-.279a1.478,1.478,0,0,1-1.477,1.477h-3.2v-19.45h4.9v5.851h.279c.541-.668,1.713-1.446,4.035-1.446,3.627,0,6.719,2.37,6.719,7.662s-3.092,7.662-6.719,7.662C24134.9,6411.6,24133.586,6410.832,24132.961,6409.842Zm-.279-5.906c0,2.729,1.227,4.1,3.146,4.1s3.148-1.367,3.148-4.1-1.223-4.1-3.148-4.1S24132.682,6401.2,24132.682,6403.936Zm57.693,3.038c0-2.983,2.283-4.277,5.127-4.569l3.313-.334c.893-.085,1.313-.4,1.313-1.087,0-.924-.783-1.477-2.145-1.477-1.332,0-2.248.553-2.316,1.543,0,.006-.006.018-.012.018h-4.387v-.425c.334-2.7,2.867-4.423,6.8-4.423,3.957,0,6.629,1.726,6.629,5.791v9.291a.016.016,0,0,1-.018.018h-2.965a1.369,1.369,0,0,1-1.367-1.367h-.273a4.909,4.909,0,0,1-4.125,1.592C24192.8,6411.543,24190.375,6409.842,24190.375,6406.974Zm7.717-1.98-1.283.14c-.861.1-1.641.529-1.641,1.586,0,1.009.725,1.592,2.061,1.592a2.705,2.705,0,0,0,2.844-2.929v-.808h-.279A4.886,4.886,0,0,1,24198.092,6404.993Zm-53.52,1.98c0-2.983,2.285-4.277,5.129-4.569l3.316-.334c.887-.085,1.307-.4,1.307-1.087,0-.924-.777-1.477-2.145-1.477-1.336,0-2.254.553-2.314,1.562h-4.4v-.419c.334-2.7,2.869-4.429,6.8-4.429,3.957,0,6.631,1.726,6.631,5.791v9.309h-2.967a1.365,1.365,0,0,1-1.379-1.349v-.018h-.279c-.693.808-1.787,1.592-4.125,1.592C24147,6411.543,24144.572,6409.842,24144.572,6406.974Zm7.723-1.98-1.287.14c-.863.1-1.641.529-1.641,1.586,0,1.009.723,1.592,2.059,1.592a2.7,2.7,0,0,0,2.844-2.929v-.808h-.279A4.838,4.838,0,0,1,24152.295,6404.993Zm53.877,6.325v-14.765h4.9v14.765Zm-29.711,0v-3.16l6.914-8h-6.914v-3.6h12.93v3.16l-6.908,8h7.133v3.6Zm-6.277,0v-8.731a2.088,2.088,0,0,0-2.322-2.145c-1.5,0-2.582.753-2.582,2.983v7.893h-4.9v-14.765h3.123a1.559,1.559,0,0,1,1.561,1.556h.273c.492-.693,1.646-1.835,4.236-1.835,3.432,0,5.523,1.92,5.523,5.432v9.612Zm37.643-16.09a1.653,1.653,0,0,1-1.654-1.659v-1.7h4.9v3.36Z"
                        transform="translate(-24127.502 -6391.369)"
                        fill="currentColor"
                        stroke="rgba(0,0,0,0)"
                        strokeMiterlimit="10"
                        strokeWidth="1"
                      />
                    </svg>
                  </div>
                </div>
                <div className="text-white text-xs font-sans whitespace-nowrap">
                  Superblocks is part of the Banzai family.
                </div>
              </div>

              {/* Right Column - Button */}
              <Link
                href="https://www.banzai.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 sm:gap-2 text-white hover:text-gray-200 transition-colors group flex-shrink-0"
                aria-label="Click to learn more about Banzai"
              >
                <span className="hidden sm:flex text-[10px] sm:text-sm font-sans font-medium whitespace-nowrap">
                  Learn more
                </span>
                <div className="w-2 h-2 sm:w-3 sm:h-3  flex-shrink-0 transform group-hover:translate-x-1 transition-transform">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="100%"
                    height="100%"
                    viewBox="0 0 10.58 10.389"
                    className="text-current"
                  >
                    <path
                      d="M10.567,1.552a1.4,1.4,0,0,0-.084-.474A1.442,1.442,0,0,0,9.73.287,1.423,1.423,0,0,0,9.2.169l-.017,0L2.227,0A1.5,1.5,0,0,0,.766,1.394,1.426,1.426,0,0,0,2.16,2.853l3.517.084L.443,7.931A1.426,1.426,0,0,0,2.411,10L7.646,5,7.56,8.6a1.427,1.427,0,0,0,1.394,1.459h.034a1.425,1.425,0,0,0,1.425-1.392l.167-7.045c0-.025-.013-.048-.013-.072"
                      transform="translate(-0.001)"
                      fill="currentColor"
                    />
                  </svg>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NavigationBanner;
