"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { type TemplateDefinition } from "@/app/config/templates";

const PREVIEW_W = 1280;
const PREVIEW_H = 800;

const avatarGlow = {
  collage: "from-sky-500/35 via-cyan-400/20 to-transparent",
  paper: "from-stone-100 via-sky-100/30 to-transparent",
  gallery: "from-violet-500/30 via-transparent to-transparent",
  orbital: "from-emerald-400/25 via-cyan-400/15 to-transparent",
  dashboard: "from-sky-500/20 via-indigo-500/15 to-transparent",
  studio: "from-cyan-500/20 via-indigo-500/15 to-transparent",
  signal: "from-amber-400/25 via-orange-500/15 to-transparent",
  mobile: "from-fuchsia-500/20 via-cyan-500/15 to-transparent",
} as const;

function ScaledPreview({
  url,
  title,
  className,
}: {
  url: string;
  title: string;
  className: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ scale: 0.2, left: 0, top: 0 });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      if (cw < 2 || ch < 2) return;
      const scale = Math.min(cw / PREVIEW_W, ch / PREVIEW_H);
      const w = PREVIEW_W * scale;
      const h = PREVIEW_H * scale;
      setLayout({ scale, left: (cw - w) / 2, top: (ch - h) / 2 });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className={`relative overflow-hidden rounded-md bg-[#0d0f16] ${className}`}>
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-hidden rounded-md bg-[#0a0b0f]"
      >
        <div
          className="pointer-events-none absolute overflow-hidden"
          style={{
            left: layout.left,
            top: layout.top,
            width: PREVIEW_W * layout.scale,
            height: PREVIEW_H * layout.scale,
          }}
        >
          <div
            style={{
              width: PREVIEW_W,
              height: PREVIEW_H,
              transform: `scale(${layout.scale})`,
              transformOrigin: "top left",
            }}
          >
            <iframe
              key={url}
              src={url}
              title={`Preview of ${title}`}
              width={PREVIEW_W}
              height={PREVIEW_H}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="block border-0 bg-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FullPreview({
  url,
  title,
  className,
}: {
  url: string;
  title: string;
  className: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-md bg-[#0d0f16] ${className}`}>
      <iframe
        key={url}
        src={url}
        title={`Preview of ${title}`}
        className="absolute inset-0 h-full w-full border-0 bg-white"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

export default function TemplateArtwork({
  template,
  className = "",
  titleClassName = "",
  interactivePreview = false,
}: {
  template: TemplateDefinition;
  className?: string;
  titleClassName?: string;
  interactivePreview?: boolean;
}) {
  const shellClass = `relative overflow-hidden rounded-md bg-[#0d0f16] ${className}`;

  if (template.previewUrl) {
    return interactivePreview ? (
      <FullPreview
        url={template.previewUrl}
        title={template.title}
        className={className}
      />
    ) : (
      <ScaledPreview
        url={template.previewUrl}
        title={template.title}
        className={className}
      />
    );
  }

  if (template.previewImageUrl) {
    return (
      <div className={shellClass}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={template.previewImageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
      </div>
    );
  }

  switch (template.visual) {
    case "paper":
      return (
        <div className={shellClass}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.18),_transparent_35%),linear-gradient(180deg,#fafaf9_0%,#f3f4f6_48%,#e7edf5_100%)]" />
          <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(15,23,42,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.08)_1px,transparent_1px)] [background-size:56px_56px]" />
          <div className="relative flex h-full flex-col justify-between p-5 text-black sm:p-6">
            <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.22em] text-black/45">
              <span>{template.heroEyebrow}</span>
              <span>Preview</span>
            </div>
            <div className="space-y-3">
              <div className={`max-w-[85%] text-3xl font-semibold leading-[0.94] tracking-tight sm:text-5xl ${titleClassName}`}>
                {template.title.split(" - ")[0]}
              </div>
              <div className="max-w-[70%] text-sm text-black/55 sm:text-base">
                {template.heroSubtitle}
              </div>
              <div className="inline-flex items-center rounded-full border border-black/10 bg-black/5 px-3 py-1 text-xs font-medium text-black/65">
                Start building
              </div>
            </div>
          </div>
        </div>
      );
    case "gallery":
      return (
        <div className={shellClass}>
          <div className="absolute inset-0 bg-black" />
          <div className={`absolute inset-0 bg-gradient-to-br ${avatarGlow.gallery}`} />
          <div className="relative flex h-full flex-col justify-between p-5 text-white sm:p-6">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-white/45">
              <span>{template.heroEyebrow}</span>
              <span>Editorial</span>
            </div>
            <div className="grid grid-cols-[1.35fr_0.9fr] gap-4">
              <div className="flex h-32 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04] text-center text-2xl font-semibold italic text-white/90 sm:h-40 sm:text-4xl">
                I create, therefore I am
              </div>
              <div className="flex flex-col gap-3">
                <div className="h-16 rounded-2xl bg-white/[0.06] ring-1 ring-white/10" />
                <div className="flex h-24 items-center justify-center rounded-2xl bg-white/[0.08] text-xs font-medium text-white/70 sm:h-[7.5rem]">
                  3D gallery module
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    case "orbital":
      return (
        <div className={shellClass}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(34,197,94,0.12),_transparent_30%),radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_30%),#0b1016]" />
          <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15" />
          <div className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
          <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80" />
          <div className="absolute left-[28%] top-[34%] h-3 w-3 rounded-full bg-emerald-300/80 shadow-[0_0_18px_rgba(52,211,153,0.8)]" />
          <div className="absolute right-[28%] top-[61%] h-2.5 w-2.5 rounded-full bg-sky-300/80 shadow-[0_0_18px_rgba(125,211,252,0.8)]" />
          <div className="relative flex h-full flex-col justify-between p-5 text-white sm:p-6">
            <div className="text-[11px] uppercase tracking-[0.22em] text-white/50">
              Technical launch
            </div>
            <div>
              <div className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {template.title}
              </div>
              <div className="mt-2 max-w-md text-sm text-white/60">
                {template.heroSubtitle}
              </div>
            </div>
          </div>
        </div>
      );
    case "dashboard":
      return (
        <div className={shellClass}>
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(14,165,233,0.13),transparent_35%),#0c1220]" />
          <div className="relative grid h-full grid-cols-2 gap-3 p-4 sm:grid-cols-3 sm:p-5">
            {["Traffic", "MRR", "Activation", "Retention", "Revenue", "Latency"].map((metric, index) => (
              <div
                key={metric}
                className={`rounded-2xl border border-white/10 bg-white/[0.05] p-3 ${index === 0 ? "sm:col-span-2" : ""}`}
              >
                <div className="text-[11px] uppercase tracking-[0.2em] text-white/35">{metric}</div>
                <div className="mt-6 h-10 rounded-xl bg-gradient-to-r from-white/10 via-white/5 to-transparent" />
              </div>
            ))}
          </div>
        </div>
      );
    case "studio":
      return (
        <div className={shellClass}>
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(56,189,248,0.18),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(129,140,248,0.18),transparent_30%),#090b11]" />
          <div className="relative flex h-full flex-col justify-between p-5 text-white sm:p-6">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-white/45">
              <span>Creative Studio</span>
              <span>Work</span>
            </div>
            <div className="grid gap-3">
              <div className="text-4xl font-semibold tracking-tight sm:text-5xl">Grok</div>
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div
                    key={index}
                    className={`aspect-video rounded-xl border border-white/10 ${index % 3 === 0 ? "bg-sky-500/20" : index % 3 === 1 ? "bg-indigo-500/20" : "bg-white/10"}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    case "signal":
      return (
        <div className={shellClass}>
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),transparent_40%),#0d0f15]" />
          <div className={`absolute inset-0 bg-gradient-to-br ${avatarGlow.signal}`} />
          <div className="relative flex h-full flex-col justify-between p-5 text-white sm:p-6">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-white/40">
              <span>{template.heroEyebrow}</span>
              <span>Premium</span>
            </div>
            <div className="grid gap-3">
              <div className="h-28 rounded-[20px] border border-white/10 bg-white/[0.06] p-4 sm:h-40">
                <div className="h-3 w-24 rounded-full bg-white/10" />
                <div className="mt-6 grid grid-cols-3 gap-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={index}
                      className={`h-10 rounded-xl ${index % 2 === 0 ? "bg-white/[0.08]" : "bg-white/[0.12]"}`}
                    />
                  ))}
                </div>
              </div>
              <div className="text-lg font-semibold sm:text-2xl">{template.title}</div>
            </div>
          </div>
        </div>
      );
    case "mobile":
      return (
        <div className={shellClass}>
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(168,85,247,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.2),transparent_28%),#0b0f17]" />
          <div className="relative flex h-full items-center justify-center p-5">
            <div className="flex h-full max-h-[18rem] w-[14rem] max-w-full rounded-[30px] border border-white/15 bg-[#0f1625] p-3 shadow-[0_0_50px_rgba(14,165,233,0.14)]">
              <div className="flex w-full flex-col rounded-[24px] border border-white/8 bg-black/20 p-3">
                <div className="mx-auto h-1.5 w-16 rounded-full bg-white/10" />
                <div className="mt-4 h-20 rounded-[18px] bg-gradient-to-br from-white/12 to-transparent" />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="h-16 rounded-2xl bg-white/10" />
                  <div className="h-16 rounded-2xl bg-white/5" />
                  <div className="col-span-2 h-20 rounded-2xl bg-white/8" />
                </div>
                <div className="mt-auto grid grid-cols-4 gap-2 pt-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="h-8 rounded-xl bg-white/8" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    case "collage":
    default:
      return (
        <div className={shellClass}>
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(59,130,246,0.22),transparent_30%),radial-gradient(circle_at_top_left,rgba(34,211,238,0.2),transparent_20%),#0b0f17]" />
          <div className="relative flex h-full flex-col justify-between p-5 text-white sm:p-6">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.24em] text-white/50">
                Playground
              </div>
              <div className="rounded-full border border-white/10 px-3 py-1 text-sm text-white/80">
                {template.label}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className={`aspect-square rounded-xl border border-white/10 ${index % 4 === 0 ? "bg-sky-400/35" : index % 4 === 1 ? "bg-amber-200/35" : index % 4 === 2 ? "bg-orange-400/30" : "bg-indigo-300/30"}`}
                />
              ))}
            </div>
          </div>
        </div>
      );
  }
}
