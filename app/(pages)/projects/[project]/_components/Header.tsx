"use client";
import { NextPage } from "next";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Switcher from "./_sub-components/Switcher";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/app/redux/store";
import JSZip from "jszip";

import { TbChartDots3, TbDownload, TbRocket, TbSettings } from "react-icons/tb";
import { usePathname, useRouter } from "next/navigation";
import { useAuthenticated } from "@/app/helpers/useAuthenticated";
import { API } from "@/app/config/publicEnv";
import { setNotification } from "@/app/redux/reducers/NotificationModalReducer";
import { LuLoaderCircle } from "react-icons/lu";
import { STARTING_POINTS } from "@/app/config/startingPoints";
import SiteDeployOptionsModal from "./SiteDeployOptionsModal";

type PublishPhase = "idle" | "queued" | "building" | "failed";

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
  const [siteOptionsOpen, setSiteOptionsOpen] = useState(false);

  const [publishSubmitting, setPublishSubmitting] = useState(false);
  const [publishPhase, setPublishPhase] = useState<PublishPhase>("idle");

  const fetchPublishStatus = useCallback(async () => {
    const projectId = getProjectId();
    const em = email.value;
    if (!projectId || typeof em !== "string" || !em) return null;
    const response = await fetch(`${API}/publish-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: em, projectId }),
    });
    let data: Record<string, unknown> | null = null;
    try {
      data = (await response.json()) as Record<string, unknown>;
    } catch {
      return {
        success: false,
        message: "Invalid response from server",
      };
    }
    if (!response.ok) {
      return {
        success: false,
        message:
          typeof data?.message === "string"
            ? data.message
            : `Error ${response.status}`,
      };
    }
    return data;
  }, [getProjectId, email.value]);

  /** Hydrate from DB + Bull on load/navigation; keep polling while publish is in flight (survives refresh). */
  useEffect(() => {
    if (previewRuntime === "mobile") return;
    const projectId = getProjectId();
    const em = email.value;
    if (!projectId || typeof em !== "string" || !em) return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const applyStatusPayload = (data: Record<string, unknown>) => {
      if (!data.success) {
        setPublishPhase("idle");
        return;
      }
      let phase = data.phase as PublishPhase;
      if (phase === "failed") phase = "idle";
      setPublishPhase(phase);
    };

    const tick = async () => {
      try {
        const data = await fetchPublishStatus();
        if (cancelled || data == null) return;
        applyStatusPayload(data);
      } catch {
        if (!cancelled) {
          setPublishPhase("idle");
        }
      }
    };

    void tick();

    const inFlight =
      publishSubmitting ||
      publishPhase === "queued" ||
      publishPhase === "building";
    if (inFlight) {
      intervalId = setInterval(tick, 2500);
    }

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [
    previewRuntime,
    getProjectId,
    email.value,
    fetchPublishStatus,
    publishPhase,
    publishSubmitting,
  ]);

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
  const publishBusy =
    !isMobilePreviewRuntime &&
    (publishSubmitting ||
      publishPhase === "queued" ||
      publishPhase === "building");

  const publishStatusSticky =
    !isMobilePreviewRuntime && (publishBusy || publishSubmitting);

  const publishStatusLabel = useMemo(() => {
    if (publishSubmitting) return "Queuing…";
    if (publishPhase === "building") return "Deploying…";
    if (publishPhase === "queued") return "Queued…";
    return "";
  }, [publishSubmitting, publishPhase]);
  /** Publish / download only — profile and settings stay available while streaming. */
  const publishLocked = Boolean(isStreamActive) || !hasExplorerFiles;
  const publishDisabledReason = isStreamActive
    ? "Please wait for generation to finish before taking this action."
    : "No files found in explorer yet.";

  const notifyPublishLocked = useCallback(() => {
    if (!publishLocked) return;
    dispatch(
      setNotification({
        modalOpen: true,
        status: "info",
        text: publishDisabledReason,
      })
    );
  }, [publishLocked, publishDisabledReason, dispatch]);

  const handlePublish = async () => {
    if (publishLocked) {
      notifyPublishLocked();
      return;
    }
    if (publishBusy) return;

    setPublishSubmitting(true);
    setPublishPhase("queued");

    const projectId = getProjectId();

    try {
      const response = await fetch(`${API}/build-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.value, projectId }),
      });
      let data: { success?: boolean; message?: string } = {};
      try {
        data = await response.json();
      } catch {
        setPublishPhase("idle");
        return;
      }

      if (!response.ok || !data.success) {
        setPublishPhase("idle");
      }
    } catch {
      setPublishPhase("idle");
    } finally {
      setPublishSubmitting(false);
    }
  };

  const handleDownloadCode = useCallback(() => {
    if (publishLocked || actionLoading) {
      notifyPublishLocked();
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
    publishLocked,
    actionLoading,
    dispatch,
    getProjectId,
    normalizedFiles,
    notifyPublishLocked,
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
      <SiteDeployOptionsModal
        isOpen={siteOptionsOpen}
        onClose={() => setSiteOptionsOpen(false)}
        projectId={getProjectId()}
      />
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
            publishLocked ? "pointer-events-none opacity-50" : ""
          }`}
        >
          <Switcher />
        </div>
      </div>
      {/* Action Buttons */}
      <div className="hidden shrink-0 items-center space-x-4 md:flex">
        {/* Primary Action */}
        <div className="relative group flex min-w-0 max-w-[min(100%,520px)] items-center gap-x-2 md:gap-x-3">
          {!isMobilePreviewRuntime && (
            <button
              type="button"
              onClick={() => setSiteOptionsOpen(true)}
              className="flex items-center gap-1 rounded-md px-2.5 py-[2px] text-white hover:bg-[#252525]"
              title="Published site title & favicon"
            >
              <TbSettings className="text-lg" />
              <span className="hidden text-xs sm:inline">Options</span>
            </button>
          )}
          {(isMobilePreviewRuntime || !publishBusy) && (
            <button
              onClick={handlePrimaryAction}
              disabled={
                publishLocked ||
                publishBusy ||
                (isMobilePreviewRuntime && actionLoading)
              }
              className={`space-x-2 px-3 py-[2px] rounded-md justify-center items-center flex text-white ${
                publishLocked ||
                publishBusy ||
                (isMobilePreviewRuntime && actionLoading)
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:text-black hover:bg-gray-200"
              }`}
              title={publishLocked ? publishDisabledReason : undefined}
            >
              {isMobilePreviewRuntime && actionLoading ? (
                <LuLoaderCircle className="animate-spin" />
              ) : isMobilePreviewRuntime ? (
                <TbDownload className={"text-lg"} />
              ) : (
                <TbRocket className={"text-lg"} />
              )}
              <span className="text-xs hidden sm:inline">
                {isMobilePreviewRuntime && actionLoading
                  ? "Downloading..."
                  : isMobilePreviewRuntime
                    ? "Download Code"
                    : "Publish"}
              </span>
            </button>
          )}

          {publishStatusSticky && publishStatusLabel ? (
            <div
              className="flex min-w-0 max-w-[240px] flex-col text-zinc-400"
              title={publishStatusLabel}
              role="status"
              aria-live="polite"
            >
              <div className="flex items-center gap-1.5">
                {(publishBusy || publishSubmitting) && (
                  <LuLoaderCircle
                    className="shrink-0 animate-spin opacity-80"
                    size={14}
                    aria-hidden
                  />
                )}
                <span className="truncate text-[11px] leading-tight">
                  {publishStatusLabel}
                </span>
              </div>
            </div>
          ) : null}

          <button
            onClick={() => {
              router.push("/settings");
            }}
            className="cursor-pointer bg-white text-black text-xs font-medium px-2 p-1 rounded-md"
            title="Account & settings"
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
      <div className="flex min-w-0 shrink-0 items-center space-x-2 md:hidden">
        {publishStatusSticky && publishStatusLabel ? (
          <div
            className="min-w-0 max-w-[38vw] truncate text-[10px] leading-tight text-zinc-500"
            title={publishStatusLabel}
            role="status"
            aria-live="polite"
          >
            {(publishBusy || publishSubmitting) && (
              <LuLoaderCircle
                className="mr-0.5 inline-block animate-spin align-middle"
                size={12}
                aria-hidden
              />
            )}
            {publishStatusLabel}
          </div>
        ) : null}
        <div className={publishLocked ? "pointer-events-none opacity-50" : ""}>
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
            setDropdownOpen(!dropdownOpen);
          }}
          className="cursor-pointer text-sm font-sans font-medium text-white px-3 rounded-lg hover:bg-[#252525]"
          type="button"
        >
          <TbChartDots3 className="text-lg" />
        </button>
      </div>
      {dropdownOpen && (
        <div className="md:hidden overflow-hidden absolute right-1 top-9 mt-2 w-30 bg-[#1A1A1A] rounded-md shadow-lg z-40 border border-[#252525]">
          <div
            onClick={() => {
              router.push("/settings");
              setDropdownOpen(false);
            }}
            className="cursor-pointer text-white truncate text-xs font-medium px-4 py-2 rounded-md hover:bg-[#252525]"
          >
            {email.value}
          </div>

          {!isMobilePreviewRuntime && (
            <button
              type="button"
              onClick={() => {
                setSiteOptionsOpen(true);
                setDropdownOpen(false);
              }}
              className="block w-full text-left px-4 py-2 text-xs text-white hover:bg-[#252525]"
            >
              Site options
            </button>
          )}

          {(isMobilePreviewRuntime || !publishBusy) && (
            <button
              onClick={() => {
                if (publishLocked) {
                  notifyPublishLocked();
                  return;
                }
                handlePrimaryAction();
                setDropdownOpen(false);
              }}
              disabled={
                publishLocked ||
                publishBusy ||
                (isMobilePreviewRuntime && actionLoading)
              }
              className={`block w-full text-left px-4 py-2 text-xs text-white ${
                publishLocked ||
                publishBusy ||
                (isMobilePreviewRuntime && actionLoading)
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-[#252525]"
              }`}
              title={publishLocked ? publishDisabledReason : undefined}
            >
              {isMobilePreviewRuntime
                ? actionLoading
                  ? "Downloading..."
                  : "Download Code"
                : "Publish"}
            </button>
          )}
        </div>
      )}

    </div>
  );
};

export default Header;
