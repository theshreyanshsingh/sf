"use client";

import { type ReactNode, useEffect, useState } from "react";
import { CiDesktop, CiMobile1 } from "react-icons/ci";
import { FaExpand } from "react-icons/fa6";
import { IoOpenOutline } from "react-icons/io5";
import { LuTabletSmartphone } from "react-icons/lu";

import { type TemplateDefinition } from "@/app/config/templates";
import TemplateArtwork from "./TemplateArtwork";

type PreviewMode = "web" | "tablet" | "mobile";

const previewFrameClasses: Record<PreviewMode, string> = {
  web: "h-[320px] w-full sm:h-[420px] lg:h-[620px]",
  tablet: "mx-auto h-[320px] w-full max-w-[860px] sm:h-[420px] lg:h-[620px]",
  mobile: "mx-auto h-[320px] w-full max-w-[340px] sm:h-[420px] lg:h-[620px]",
};

const previewModeIcons: Record<PreviewMode, ReactNode> = {
  web: <CiDesktop className="text-base" />,
  tablet: <LuTabletSmartphone className="text-[15px]" />,
  mobile: <CiMobile1 className="text-base" />,
};

export default function TemplatePreviewViewport({
  template,
  previewTargetId,
}: {
  template: TemplateDefinition;
  previewTargetId: string;
}) {
  const [previewMode, setPreviewMode] = useState<PreviewMode>("web");
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const previewElement = document.getElementById(previewTargetId);
      setIsFullscreen(document.fullscreenElement === previewElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [previewTargetId]);

  const handleFullscreen = async () => {
    const previewElement = document.getElementById(previewTargetId);
    if (!previewElement) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await previewElement.requestFullscreen();
  };

  const handleOpenInNewTab = () => {
    if (typeof window === "undefined") return;
    if (template.previewUrl) {
      window.open(template.previewUrl, "_blank", "noopener,noreferrer");
    }
  };

  const activePreviewFrameClass = isFullscreen
    ? previewMode === "web"
      ? "h-[calc(100vh-92px)] w-full"
      : previewMode === "tablet"
        ? "mx-auto h-[calc(100vh-92px)] w-full max-w-[860px]"
        : "mx-auto h-[calc(100vh-92px)] w-full max-w-[340px]"
    : previewFrameClasses[previewMode];

  return (
    <div
      id={previewTargetId}
      className={`overflow-hidden rounded-md border border-white/10 bg-[#050608] ${isFullscreen ? "h-screen w-screen rounded-none" : ""}`}
    >
      <div className="flex flex-nowrap items-center justify-between gap-2 border-b border-white/10 px-3 py-3">
        <div className="flex min-w-0 flex-1 items-center justify-start sm:justify-center">
          <div className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-2 py-1.5">
            <div className="hidden items-center gap-1.5 sm:flex">
              {(["web", "tablet", "mobile"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPreviewMode(mode)}
                  title={mode.charAt(0).toUpperCase() + mode.slice(1)}
                  aria-label={`${mode} preview`}
                  className={`inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-xs font-medium transition ${
                    previewMode === mode
                      ? "bg-white text-black"
                      : "bg-transparent text-white/60 hover:bg-white/[0.08] hover:text-white"
                  }`}
                >
                  {previewModeIcons[mode]}
                </button>
              ))}
            </div>
            <div className="min-w-0 truncate text-xs text-white/45 sm:max-w-none">
              /templates/{template.slug}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleOpenInNewTab}
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-white/[0.04] text-white/70 transition hover:bg-white/[0.08] hover:text-white"
            aria-label="Open preview in new tab"
            title="Open preview in new tab"
          >
            <IoOpenOutline className="text-sm" />
          </button>

          <button
            type="button"
            onClick={handleFullscreen}
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-white/[0.04] text-white/70 transition hover:bg-white/[0.08] hover:text-white"
            aria-label="Toggle fullscreen preview"
            title="Toggle fullscreen preview"
          >
            <FaExpand className="text-xs" />
          </button>
        </div>
      </div>

      <div className="bg-black px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6">
        <div className={activePreviewFrameClass}>
          <TemplateArtwork
            template={template}
            className="h-full w-full border-0"
            titleClassName="max-w-full"
            interactivePreview
          />
        </div>
      </div>
    </div>
  );
}
