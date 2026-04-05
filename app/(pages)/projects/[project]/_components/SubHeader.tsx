"use client";
import { NextPage } from "next";
import React, { useState } from "react";
import { RiPlayCircleLine, RiRefreshLine, RiRestartLine } from "react-icons/ri";

import { CiMobile1, CiLaptop } from "react-icons/ci";

import { LuLayoutTemplate, LuMousePointer2 } from "react-icons/lu";
import { TiPen } from "react-icons/ti";

import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/app/redux/store";
import {
  refreshPreview,
  setResponsivess,
  setInspectorMode,
  setEditMode,
  setShowTemplateBlocks,
  setShowPreviewPageBar,
} from "@/app/redux/reducers/projectOptions";

// const dropdownVariants = {
//   hidden: { opacity: 0, scale: 0.95, y: -5 },
//   visible: { opacity: 1, scale: 1, y: 0 },
// };

const SubHeader: NextPage = () => {
  const {
    responsive,
    inspectorMode,
    editMode,
    showTemplateBlocks,
    showPreviewPageBar,
    previewUrl,
    previewRuntime,
    isStreamActive,
  } = useSelector((state: RootState) => state.projectOptions);
  const isMobilePreviewRuntime = previewRuntime === "mobile";

  const isPreviewReady = !!previewUrl;
  /** Same gates as Inspector/Edit: no live preview URL yet (e.g. “Agent is cooking!”) or active stream. */
  const previewChromeLocked = !isPreviewReady || !!isStreamActive;
  /** WebContainer reported `server-ready` — dev server is listening at `previewUrl`. */
  const isWebDevServerRunning =
    !isMobilePreviewRuntime && Boolean(previewUrl?.trim());

  const reduxDispatch = useDispatch();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshFeedbackMs = isMobilePreviewRuntime ? 1800 : 1000;
  const handleRefresh = () => {
    // Set refreshing state to true to trigger animation
    setIsRefreshing(true);

    // After a short delay, dispatch the refresh action
    setTimeout(() => {
      // Dispatch the refreshPreview action to trigger iframe refresh
      reduxDispatch(refreshPreview());

      // Keep the animation running longer for mobile runtime reboot retries.
      setTimeout(() => {
        setIsRefreshing(false);
      }, refreshFeedbackMs);
    }, 50);
  };

  return (
    <div className="w-full p-2 flex justify-between items-center bg-[#141415] h-7 border-b border-[#2a2a2a] space-x-5">
      <div className="flex items-center space-x-4">
        <button
          onClick={handleRefresh}
          className="flex items-center cursor-pointer text-xs text-white gap-1 justify-center hover:text-gray-300 transition-colors"
          disabled={isRefreshing}
          title={isMobilePreviewRuntime ? "Retry mobile preview" : "Refresh Preview"}
        >
          <RiRefreshLine className={isRefreshing ? "animate-spin" : ""} />
          {isMobilePreviewRuntime ? "Retry" : "Refresh"}
        </button>

        {!isMobilePreviewRuntime && (
          <>
            <button
              onClick={() => {
                if (isPreviewReady) {
                  reduxDispatch(setInspectorMode(!inspectorMode));
                }
              }}
              disabled={!isPreviewReady}
              className={`flex items-center cursor-pointer text-xs gap-1 justify-center transition-colors ${
                !isPreviewReady
                  ? "text-gray-500 cursor-not-allowed"
                  : inspectorMode
                    ? "text-[#4a90e2]"
                    : "text-white hover:text-gray-300"
              }`}
              title={!isPreviewReady ? "Wait for preview to load" : "Toggle Element Inspector"}
            >
              <LuMousePointer2 />
              Inspector
            </button>

            <button
              onClick={() => {
                if (isPreviewReady) {
                  reduxDispatch(setEditMode(!editMode));
                }
              }}
              disabled={!isPreviewReady}
              className={`flex items-center cursor-pointer text-xs gap-1 justify-center transition-colors ${
                !isPreviewReady
                  ? "text-gray-500 cursor-not-allowed"
                  : editMode
                    ? "text-[#4a90e2]"
                    : "text-white hover:text-gray-300"
              }`}
              title={!isPreviewReady ? "Wait for preview to load" : "Toggle WYSIWYG Edit Mode"}
            >
              <TiPen />
              Edit
            </button>

            {editMode && (
              <button
                onClick={() => reduxDispatch(setShowTemplateBlocks(!showTemplateBlocks))}
                className={`flex items-center cursor-pointer text-xs gap-1 justify-center transition-colors ${
                  showTemplateBlocks ? "text-[#4a90e2]" : "text-white hover:text-gray-300"
                }`}
                title="Toggle Template Blocks panel"
              >
                <LuLayoutTemplate className="text-sm" />
                Blocks
              </button>
            )}
          </>
        )}
      </div>

      {/* Fullscreen & Device Toggle */}
      <div className="flex items-center space-x-4">
        {!isMobilePreviewRuntime && (
          <button
            onClick={() =>
              reduxDispatch(setShowPreviewPageBar(!showPreviewPageBar))
            }
            disabled={previewChromeLocked}
            className={`flex items-center text-xs gap-1 justify-center transition-colors ${
              previewChromeLocked
                ? "cursor-not-allowed text-gray-500"
                : showPreviewPageBar
                  ? "cursor-pointer text-[#4a90e2]"
                  : "cursor-pointer text-white hover:text-gray-300"
            }`}
            title={
              !isPreviewReady
                ? "Wait for live preview to load"
                : isStreamActive
                  ? "Navigator becomes available after streaming finishes"
                  : showPreviewPageBar
                    ? "Hide navigator"
                    : "Show navigator"
            }
            type="button"
          >
            Navigator
          </button>
        )}
        {!isMobilePreviewRuntime && (
          <button
            type="button"
            disabled={previewChromeLocked}
            onClick={() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("SB_START_WEB_DEV_SERVER"));
              }
            }}
            className={`flex items-center text-xs gap-1 justify-center transition-colors ${
              previewChromeLocked
                ? "cursor-not-allowed text-gray-500"
                : isWebDevServerRunning
                  ? "cursor-pointer text-[#67C881] hover:text-[#7ad892]"
                  : "cursor-pointer text-white hover:text-gray-300"
            }`}
            title={
              !isPreviewReady
                ? "Wait for live preview to load"
                : isStreamActive
                  ? "Available after streaming finishes"
                  : isWebDevServerRunning
                    ? "Dev server is running (preview is live). Click to interrupt and run npm install + npm run dev again in the Console."
                    : "No dev server URL yet. Runs Ctrl+C, then npm install and npm run dev in the Console terminal."
            }
          >
            {isWebDevServerRunning ? (
              <RiRestartLine className="text-sm" />
            ) : (
              <RiPlayCircleLine className="text-sm" />
            )}
            {isWebDevServerRunning ? "Restart server" : "Start server"}
          </button>
        )}
        {!isMobilePreviewRuntime && (
          <button
            type="button"
            disabled={previewChromeLocked}
            onClick={() => {
              if (responsive === "desktop") {
                reduxDispatch(setResponsivess({ responsive: "mobile" }));
              } else {
                reduxDispatch(setResponsivess({ responsive: "desktop" }));
              }
            }}
            className={`flex items-center text-xs gap-1 justify-center transition-colors ${
              previewChromeLocked
                ? "cursor-not-allowed text-gray-500"
                : "cursor-pointer text-white hover:text-gray-300"
            }`}
            title={
              !isPreviewReady
                ? "Wait for live preview to load"
                : isStreamActive
                  ? "Available after streaming finishes"
                  : responsive === "mobile"
                    ? "Switch to desktop frame"
                    : "Switch to mobile frame"
            }
          >
            {responsive === "mobile" ? (
              <CiLaptop className="text-md" />
            ) : (
              <CiMobile1 className="text-md" />
            )}
            {responsive === "mobile" ? "Laptop" : "Mobile"}
          </button>
        )}
        {/* <button
          onClick={() => {
            if (fullscreen) {
              toggleFullscreen();
            } else {
              toggleFullscreen();
            }
          }}
          className="flex items-center cursor-pointer text-white text-sm mx-1"
        >
          {fullscreen ? (
            <RiFullscreenExitLine className="text-lg" />
          ) : (
            <BiFullscreen className="text-lg" />
          )}
        </button> */}
      </div>
    </div>
  );
};

export default SubHeader;
