"use client";
import { NextPage } from "next";
import React, { useCallback, useMemo, useState } from "react";
import Switcher from "./_sub-components/Switcher";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/app/redux/store";
import JSZip from "jszip";

import { TbChartDots3, TbDownload, TbRocket } from "react-icons/tb";
import { usePathname, useRouter } from "next/navigation";
import { useAuthenticated } from "@/app/helpers/useAuthenticated";
import { API } from "@/app/config/publicEnv";
import { setNotification } from "@/app/redux/reducers/NotificationModalReducer";
import { LuLoaderCircle } from "react-icons/lu";
import { STARTING_POINTS } from "@/app/config/startingPoints";

const Header: NextPage = () => {
  const { title, startingPoint, isStreamActive, previewRuntime } = useSelector(
    (state: RootState) => state.projectOptions
  );
  const projectData = useSelector((state: RootState) => state.projectFiles.data);

  const startingPointLabel = STARTING_POINTS.find(
    (item) => item.id === startingPoint
  )?.label;

  const [actionLoading, setActionLoading] = useState(false);
  const pathname = usePathname();
  const getProjectId = useCallback(() => {
    const segments = pathname.split("/");
    const id = segments[2] || "";
    return id;
  }, [pathname]);

  const { email } = useAuthenticated();
  const router = useRouter();
  const dispatch = useDispatch();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const normalizedFiles = useMemo(() => {
    if (!projectData || typeof projectData !== "object") return {};
    const result: Record<string, string> = {};

    Object.entries(projectData as Record<string, unknown>).forEach(
      ([path, value]) => {
        if (typeof value === "string") {
          result[path] = value;
          return;
        }
        if (
          value &&
          typeof value === "object" &&
          "code" in value &&
          typeof (value as { code?: unknown }).code === "string"
        ) {
          result[path] = (value as { code: string }).code;
        }
      }
    );

    return result;
  }, [projectData]);

  const hasExplorerFiles = Object.keys(normalizedFiles).length > 0;
  const isMobilePreviewRuntime = previewRuntime === "mobile";
  const actionsLocked = Boolean(isStreamActive) || !hasExplorerFiles;
  const disabledReason = isStreamActive
    ? "Please wait for generation to finish before taking this action."
    : "No files found in explorer yet.";

  const notifyActionsLocked = useCallback(() => {
    if (!actionsLocked) return;
    dispatch(
      setNotification({
        modalOpen: true,
        status: "info",
        text: disabledReason,
      })
    );
  }, [actionsLocked, disabledReason, dispatch]);

  const handlePublish = async () => {
    if (actionsLocked || actionLoading) {
      notifyActionsLocked();
      return;
    }

    setActionLoading(true);
    const projectId = getProjectId();

    const response = await fetch(`${API}/build-code`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: email.value, projectId }),
    });
    const data = await response.json();

    if (data.success) {
      dispatch(
        setNotification({
          modalOpen: true,
          status: "success",
          text: "Publish started. You will receive an email soon.",
        })
      );
    } else {
      dispatch(
        setNotification({
          modalOpen: true,
          status: "error",
          text: data.message,
        })
      );
    }
    setActionLoading(false);
  };

  const handleDownloadCode = useCallback(() => {
    if (actionsLocked || actionLoading) {
      notifyActionsLocked();
      return;
    }

    const createAndDownloadZip = async () => {
      setActionLoading(true);
      try {
        const projectId = getProjectId();
        const zip = new JSZip();

        Object.entries(normalizedFiles).forEach(([rawPath, content]) => {
          const normalizedPath = rawPath.replace(/^\/+/, "");
          if (!normalizedPath) return;
          zip.file(normalizedPath, content);
        });

        const zipBlob = await zip.generateAsync({
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: { level: 6 },
        });

        const blobUrl = URL.createObjectURL(zipBlob);
        const anchor = document.createElement("a");
        anchor.href = blobUrl;
        anchor.download = `${projectId || "project"}-code.zip`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(blobUrl);
      } catch {
        dispatch(
          setNotification({
            modalOpen: true,
            status: "error",
            text: "Failed to generate ZIP. Please try again.",
          })
        );
      } finally {
        setActionLoading(false);
      }
    };

    void createAndDownloadZip();
  }, [
    actionsLocked,
    actionLoading,
    dispatch,
    getProjectId,
    normalizedFiles,
    notifyActionsLocked,
  ]);

  const handlePrimaryAction = () => {
    if (isMobilePreviewRuntime) {
      handleDownloadCode();
      return;
    }
    void handlePublish();
  };

  return (
    <div className="sticky top-0 z-50 flex h-11 w-full shrink-0 items-center justify-between border-b border-[#2a2a2a] bg-[#111214]/95 px-2 shadow-md backdrop-blur-sm md:px-3">
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        <button
          onClick={() => {
            router.push("/");
          }}
          className="hidden shrink-0 cursor-pointer text-sm font-[insSerifIt] font-semibold tracking-tight text-white sm:block"
        >
          Superblocks
        </button>

        {/* Title */}
        {title ? (
          <>
            <span className="text-sm  hidden sm:block text-gray-500">
              {"/"}
            </span>
            <h3 className="ml-1 max-w-full truncate whitespace-nowrap text-xs font-sans font-medium text-white md:text-sm">
              {title}
            </h3>
            {startingPointLabel && (
              <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full border border-[#2a2a2b] text-[#a0a0a8] hidden sm:inline-flex">
                {startingPointLabel}
              </span>
            )}
          </>
        ) : (
          <h3 className="ml-1 max-w-full truncate whitespace-nowrap text-xs font-sans font-medium text-[#a0a0a8] md:text-sm">
          </h3>
        )}
      </div>

      <div className="pointer-events-none absolute inset-y-0 left-1/2 hidden -translate-x-1/2 items-center md:flex">
        <div
          className={`pointer-events-auto px-2 ${
            actionsLocked ? "pointer-events-none opacity-50" : ""
          }`}
        >
          <Switcher />
        </div>
      </div>
      {/* Action Buttons */}
      <div className="hidden shrink-0 items-center space-x-4 md:flex">
        {/* Primary Action */}
        <div className="relative group flex items-center w-fit gap-x-3">
          <button
            onClick={handlePrimaryAction}
            disabled={actionLoading || actionsLocked}
            className={`space-x-2 px-3 py-[2px] rounded-md justify-center items-center flex text-white ${
              actionLoading || actionsLocked
                ? "opacity-50 cursor-not-allowed"
                : "hover:text-black hover:bg-gray-200"
            }`}
            title={actionsLocked ? disabledReason : undefined}
          >
            {actionLoading ? (
              <LuLoaderCircle className="animate-spin" />
            ) : isMobilePreviewRuntime ? (
              <TbDownload className={"text-lg"} />
            ) : (
              <TbRocket className={"text-lg"} />
            )}
            <span className="text-xs hidden sm:inline">
              {actionLoading
                ? isMobilePreviewRuntime
                  ? "Downloading..."
                  : "Publishing..."
                : isMobilePreviewRuntime
                  ? "Download Code"
                  : "Publish"}
            </span>
          </button>

          <button
            onClick={() => {
              if (actionsLocked) {
                notifyActionsLocked();
                return;
              }
              router.push("/settings");
            }}
            disabled={actionsLocked}
            className={`bg-white text-black text-xs font-medium px-2 p-1 rounded-md ${
              actionsLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
            }`}
            title={actionsLocked ? disabledReason : undefined}
          >
            {email.value !== null &&
            email.value !== undefined &&
            typeof email.value === "string"
              ? email.value.charAt(0).toUpperCase()
              : "Get Started"}
          </button>
        </div>
      </div>

      {/* Mobile Action buttons */}
      <div className="flex shrink-0 items-center space-x-2 md:hidden">
        <div className={actionsLocked ? "pointer-events-none opacity-50" : ""}>
          <Switcher />
        </div>
        {/* Mobile Chat Trigger */}
        {/* <button
          onClick={() => {
            dispatch(setMobileChatOpen());
          }}
          className="text-sm font-sans font-medium text-white hover:bg-[#252525] px-3 rounded-lg"
        >
          <TbMessageCircle className="text-lg" />
        </button> */}
        {/* Share */}
        <button
          onClick={() => {
            if (actionsLocked) {
              notifyActionsLocked();
              return;
            }
            setDropdownOpen(!dropdownOpen);
          }}
          className={`text-sm font-sans font-medium text-white px-3 rounded-lg ${
            actionsLocked ? "opacity-50 cursor-not-allowed" : "hover:bg-[#252525]"
          }`}
          disabled={actionsLocked}
          title={actionsLocked ? disabledReason : undefined}
        >
          <TbChartDots3 className="text-lg" />
        </button>
      </div>
      {dropdownOpen && (
        <div className="md:hidden overflow-hidden absolute right-1 top-9 mt-2 w-30 bg-[#1A1A1A] rounded-md shadow-lg z-40 border border-[#252525]">
          <div
            onClick={() => {
              if (actionsLocked) {
                notifyActionsLocked();
                return;
              }
              router.push("/settings");
              setDropdownOpen(false);
            }}
            className={`text-white truncate text-xs font-medium px-4 py-2 rounded-md ${
              actionsLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-[#252525]"
            }`}
          >
            {email.value}
          </div>

          <button
            onClick={() => {
              if (actionsLocked) {
                notifyActionsLocked();
                return;
              }
              handlePrimaryAction();
              setDropdownOpen(false);
            }}
            disabled={actionLoading || actionsLocked}
            className={`block w-full text-left px-4 py-2 text-xs text-white ${
              actionLoading || actionsLocked
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-[#252525]"
            }`}
            title={actionsLocked ? disabledReason : undefined}
          >
            {isMobilePreviewRuntime
              ? actionLoading
                ? "Downloading..."
                : "Download Code"
              : actionLoading
                ? "Publishing..."
                : "Publish"}
          </button>
        </div>
      )}
    </div>
  );
};

export default Header;
